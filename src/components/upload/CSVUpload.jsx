import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { processPayerFiles } from '../../utils/payerProcessor';

const CSVUpload = ({ onDataLoaded, isLoading }) => {
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle, uploading, success, error
  const [fileName, setFileName] = useState('');
  const [selectedScheme, setSelectedScheme] = useState('maa_yojna');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isMultiPayerMode, setIsMultiPayerMode] = useState(false);

  const parseCSV = (content) => {
    // More robust CSV parsing that handles multiline fields and complex quoting
    const data = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;
    let headers = null;
    let rowIndex = 0;
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const nextChar = content[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        currentRow.push(currentField.trim());
        currentField = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        // End of row
        if (currentField.trim() || currentRow.length > 0) {
          currentRow.push(currentField.trim());
          
          if (rowIndex === 0) {
            // Header row
            headers = currentRow.map(h => h.replace(/"/g, '').trim());
          } else if (currentRow.length === headers.length) {
            // Data row with correct column count
            const row = {};
            headers.forEach((header, index) => {
              row[header] = currentRow[index]?.replace(/^"|"$/g, '') || '';
            });
            data.push(row);
          }
          // If column count doesn't match, skip the row (malformed)
          
          currentRow = [];
          currentField = '';
          rowIndex++;
        }
        
        // Skip \r\n combination
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
      } else {
        // Regular character
        currentField += char;
      }
    }
    
    // Handle last row if file doesn't end with newline
    if (currentField.trim() || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (headers && currentRow.length === headers.length) {
        const row = {};
        headers.forEach((header, index) => {
          row[header] = currentRow[index]?.replace(/^"|"$/g, '') || '';
        });
        data.push(row);
      }
    }
    
    return data;
  };

  const parseExcel = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          
          // Get the first worksheet
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // Convert to JSON with raw format first to check structure
          let jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });
          
          // Handle Hospital Payment Tracker format - check multiple rows for headers
          let headerRowIndex = -1;
          let headers = null;
          
          // Look for the header row (should contain 'S No.' and 'Transaction Id')
          for (let i = 0; i < Math.min(3, jsonData.length); i++) {
            const row = jsonData[i];
            if (row && (row[0] === 'S No.' || (row.includes && row.includes('Transaction Id')))) {
              headerRowIndex = i;
              headers = row;
              break;
            }
          }
          
          if (headerRowIndex >= 0 && headers) {
            // Hospital Payment Tracker format detected
            const rows = jsonData.slice(headerRowIndex + 1);
            
            const processedData = rows.map(row => {
              const obj = {};
              headers.forEach((header, index) => {
                let value = row[index];
                // Clean up invisible characters
                if (typeof value === 'string') {
                  value = value.replace(/[\u200c\u200d]/g, '').trim();
                }
                obj[header] = value;
              });
              return obj;
            }).filter(row => Object.values(row).some(val => 
              val !== undefined && val !== null && val !== '' && val !== 0
            ));
            
            resolve(processedData);
          } else {
            // Standard Excel format - first row is headers
            let processedData = XLSX.utils.sheet_to_json(worksheet, { 
              raw: false, 
              dateNF: 'yyyy-mm-dd',
              defval: ''
            });
            
            // Clean up any invisible characters in the data
            processedData = processedData.map(row => {
              const cleanRow = {};
              Object.keys(row).forEach(key => {
                let value = row[key];
                if (typeof value === 'string') {
                  value = value.replace(/[\u200c\u200d]/g, '').trim();
                }
                cleanRow[key] = value;
              });
              return cleanRow;
            });
            
            resolve(processedData);
          }
        } catch (error) {
          reject(new Error(`Excel parsing error: ${error.message}`));
        }
      };
      reader.onerror = () => reject(new Error('Error reading Excel file'));
      reader.readAsArrayBuffer(file);
    });
  };

  const validateMAAYojnaColumns = (headers) => {
    const requiredColumns = ['TID', 'Patient Name', 'Hospital Name', 'Status', 'Approved Amount'];
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    return missingColumns;
  };

  const validateRGHSColumns = (headers, fileType) => {
    if (fileType === 'payment_tracker') {
      // Hospital Payment Tracker validation (more flexible)
      const requiredColumns = ['S No.', 'Transaction Id', 'Paid Amount(Rs.)'];
      const missingColumns = requiredColumns.filter(col => !headers.some(h => h.includes(col)));
      
      // Additionally, check for at least one of the claim amount columns
      const hasClaimAmount = headers.some(h => h.includes('Hospital Claim Amount') || h.includes('Claim Amount'));
      if (!hasClaimAmount) {
        missingColumns.push('Hospital Claim Amount');
      }
      
      return missingColumns;
    } else if (fileType === 'tms_data') {
      // TMS data validation
      const requiredColumns = ['PATIENTNAME', 'HOSPITALNAME', 'STATUS', 'TPAAPRROVEDAMOUNT'];
      const missingColumns = requiredColumns.filter(col => !headers.includes(col));
      return missingColumns;
    }
    return [];
  };

  const detectRGHSFileType = (headers, firstRow = null) => {
    // Check for TMS data patterns
    if (headers.includes('PATIENTNAME') && headers.includes('TPAAPRROVEDAMOUNT')) {
      return 'tms_data';
    }
    
    // Check for Hospital Payment Tracker patterns
    if (headers.includes('S No.') && headers.includes('Transaction Id')) {
      return 'payment_tracker';
    }
    
    // Additional check for Excel format where first row might be title
    if (firstRow && (
      firstRow['Hospital Payment Tracker'] === 'S No.' ||
      firstRow['S No.'] !== undefined ||
      headers.includes('Paid Amount(Rs.)') ||
      headers.includes('Hospital Claim Amount')
    )) {
      return 'payment_tracker';
    }
    
    return 'unknown';
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length > 4) {
      toast.error('Maximum 4 files allowed. Please select up to 4 files.');
      setUploadStatus('error');
      return;
    }
    
    // Multi-payer mode using the new processor
    if (isMultiPayerMode) {
      if (acceptedFiles.length === 0) return;
      
      setFileName(acceptedFiles.map(f => f.name).join(', '));
      setUploadStatus('uploading');
      
      try {
        const result = await processPayerFiles(acceptedFiles);
        
        // Processing errors will be shown as toast notifications in App.jsx
        
        if (result.consolidatedData.length > 0) {
          setUploadStatus('success');
          const payerBreakdown = Object.entries(result.stats.payerBreakdown)
            .map(([payer, stats]) => `${payer}: ${stats.records} records`)
            .join(', ');
          
          toast.success(
            `Successfully processed ${result.stats.successfulFiles}/${result.stats.totalFiles} files. ` +
            `Total records: ${result.stats.totalRecords}. ${payerBreakdown}`
          );
          
          // Pass consolidated data with multi-payer flag
          onDataLoaded(result.consolidatedData, 'multi_payer', { 
            ...result.stats, 
            processingErrors: result.processingErrors 
          });
        } else {
          setUploadStatus('error');
          toast.error('No data could be processed from the uploaded files');
        }
      } catch (error) {
        setUploadStatus('error');
        toast.error(`Error processing files: ${error.message}`);
      }
      return;
    }
    
    // Original single-scheme logic
    if (selectedScheme === 'maa_yojna') {
      if (acceptedFiles.length === 0) return;

      const csvFiles = acceptedFiles.filter(file => file.type === 'text/csv' || file.name.endsWith('.csv'));
      if (csvFiles.length === 0) {
        toast.error('Please upload CSV files');
        setUploadStatus('error');
        return;
      }

      setFileName(csvFiles.map(f => f.name).join(', '));
      setUploadStatus('uploading');

      const filePromises = csvFiles.map(file => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const content = e.target.result;
              const parsedData = parseCSV(content);
              if (parsedData.length === 0) {
                throw new Error(`No data found in ${file.name}`);
              }
              const headers = Object.keys(parsedData[0]);
              const missingColumns = validateMAAYojnaColumns(headers);
              if (missingColumns.length > 0) {
                throw new Error(`Missing required columns in ${file.name}: ${missingColumns.join(', ')}`);
              }
              resolve(parsedData);
            } catch (error) {
              reject(error);
            }
          };
          reader.onerror = () => reject(new Error(`Error reading ${file.name}`));
          reader.readAsText(file);
        });
      });

      Promise.all(filePromises)
        .then(allData => {
          // Validate that all files are from the same hospital
          const firstHospitalName = allData[0][0]['Hospital Name'];
          for (let i = 1; i < allData.length; i++) {
            if (allData[i][0]['Hospital Name'] !== firstHospitalName) {
              throw new Error('All CSV files must be from the same hospital.');
            }
          }

          const combinedData = allData.flat();
          setUploadStatus('success');
          toast.success(`Successfully loaded ${combinedData.length} records from ${allData.length} files`);
          onDataLoaded(combinedData, 'maa_yojna');
        })
        .catch(error => {
          setUploadStatus('error');
          toast.error(`Error processing files: ${error.message}`);
        });

    } else if (selectedScheme === 'rghs') {
      // Handle RGHS multiple file upload (Excel only)
      if (acceptedFiles.length === 0) return;

      const validFiles = acceptedFiles.filter(file => 
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.name.endsWith('.xlsx')
      );

      if (validFiles.length === 0) {
        toast.error('Please upload Excel (.xlsx) files for RGHS');
        setUploadStatus('error');
        return;
      }

      setUploadStatus('uploading');
      const filePromises = validFiles.map(file => {
        return new Promise(async (resolve, reject) => {
          try {
            const parsedData = await parseExcel(file);
            
            if (parsedData.length === 0) {
              throw new Error(`No data found in ${file.name}`);
            }

            const headers = Object.keys(parsedData[0]);
            const fileType = detectRGHSFileType(headers, parsedData[0]);
            const missingColumns = validateRGHSColumns(headers, fileType);
            
            if (missingColumns.length > 0) {
              throw new Error(`Missing required columns in ${file.name}: ${missingColumns.join(', ')}`);
            }

            resolve({
              fileName: file.name,
              fileType,
              data: parsedData
            });
          } catch (error) {
            reject(error);
          }
        });
      });

      Promise.all(filePromises)
        .then(results => {
          setUploadedFiles(results);
          setFileName(results.map(r => r.fileName).join(', '));
          setUploadStatus('success');
          
          const totalRecords = results.reduce((sum, r) => sum + r.data.length, 0);
          toast.success(`Successfully loaded ${totalRecords} records from ${results.length} files`);
          
          onDataLoaded(results, 'rghs');
        })
        .catch(error => {
          setUploadStatus('error');
          toast.error(`Error parsing CSV: ${error.message}`);
        });
    }
  }, [onDataLoaded, selectedScheme, isMultiPayerMode]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: isMultiPayerMode ? {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    } : selectedScheme === 'rghs' ? {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    } : {
      'text/csv': ['.csv']
    },
    multiple: true,
    maxFiles: 4
  });

  const getStatusIcon = () => {
    switch (uploadStatus) {
      case 'uploading':
        return <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />;
      case 'success':
        return <CheckCircle className="w-8 h-8 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-8 h-8 text-red-500" />;
      default:
        return <Upload className="w-8 h-8 text-gray-400" />;
    }
  };

  const getStatusMessage = () => {
    switch (uploadStatus) {
      case 'uploading':
        return 'Processing file...';
      case 'success':
        return `Successfully loaded: ${fileName}`;
      case 'error':
        return 'Upload failed - please try again';
      default:
        if (isMultiPayerMode) {
          return 'Drop multiple payer files here (CSV/Excel) - Max 4 files from different payers';
        }
        if (selectedScheme === 'rghs') {
          return 'Drop your Excel files here or click to browse (Max 4 files: Payment Tracker + TMS Data)';
        }
        return 'Drop your CSV file(s) here or click to browse (Max 4 files)';
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Multi-Payer Mode Toggle */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">
            Upload Mode
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isMultiPayerMode}
              onChange={(e) => {
                setIsMultiPayerMode(e.target.checked);
                setUploadStatus('idle');
                setFileName('');
                setUploadedFiles([]);
              }}
              className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">Multi-Payer Mode</span>
          </label>
        </div>
        {isMultiPayerMode && (
          <p className="text-xs text-gray-600 mt-1">
            Upload files from different payers (MAA Yojana, RGHS, etc.) for consolidated analysis
          </p>
        )}
      </div>

      {/* Scheme Selection - only show when not in multi-payer mode */}
      {!isMultiPayerMode && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Scheme
          </label>
          <select
            value={selectedScheme}
            onChange={(e) => {
              setSelectedScheme(e.target.value);
              setUploadStatus('idle');
              setFileName('');
              setUploadedFiles([]);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="maa_yojna">Mukhyamantri Ayushman Arogya (MAA) Yojana</option>
            <option value="rghs">Rajasthan Government Health Scheme (RGHS)</option>
          </select>
        </div>
      )}

      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${uploadStatus === 'success' ? 'border-green-300 bg-green-50' : ''}
          ${uploadStatus === 'error' ? 'border-red-300 bg-red-50' : ''}
          ${isLoading ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center space-y-4">
          {getStatusIcon()}
          
          <div>
            <p className="text-lg font-medium text-gray-700">
              {getStatusMessage()}
            </p>
            {uploadStatus === 'idle' && (
              <p className="text-sm text-gray-500 mt-2">
                {isMultiPayerMode 
                  ? 'Upload files from different healthcare payers. Each file will be automatically identified and processed according to its format.'
                  : selectedScheme === 'maa_yojna' 
                  ? 'Supports multiple CSV files in the GenericSearchReport format. All files must be from the same hospital.'
                  : 'Upload both Hospital Payment Tracker and TMS data files (Excel format only) for comprehensive RGHS analysis'
                }
              </p>
            )}
          </div>

          {uploadStatus === 'idle' && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <FileSpreadsheet className="w-4 h-4" />
              <span>
                {isMultiPayerMode 
                  ? 'CSV and Excel (.xlsx) files supported'
                  : selectedScheme === 'rghs' 
                  ? 'Excel (.xlsx) files only' 
                  : 'CSV files only'
                }
              </span>
            </div>
          )}
        </div>
      </div>

      {uploadStatus === 'success' && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-green-700 font-medium">File uploaded successfully!</span>
          </div>
          <p className="text-green-600 text-sm mt-1">
            Your healthcare claims data is ready for analysis. View the dashboard below.
          </p>
        </div>
      )}
    </div>
  );
};

export default CSVUpload;