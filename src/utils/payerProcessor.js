import * as XLSX from 'xlsx';
import payerMappings from '../config/payerMappings.json' with { type: 'json' };

/**
 * Parse date strings to Date objects
 * Handles various date formats from different payers
 */
const parseDate = (dateString) => {
  if (!dateString) return null;
  if (dateString instanceof Date) return dateString;
  if (typeof dateString !== 'string') return null;
  
  const trimmed = dateString.trim();
  if (trimmed === '') return null;
  
  // Handle MAA Yojana format: "01,February , 2025"
  if (trimmed.includes(',')) {
    const cleanedDate = trimmed.replace(/\s+/g, ' ').replace(/,\s*/g, ' ');
    const parsed = new Date(cleanedDate);
    if (!isNaN(parsed)) return parsed;
  }
  
  // Try standard date parsing
  const parsed = new Date(trimmed);
  if (!isNaN(parsed)) return parsed;
  
  return null;
};

/**
 * Parse numeric values from various formats
 */
const parseNumber = (value) => {
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'string') return 0;
  
  // Remove commas and other non-numeric characters except decimal and minus
  const cleaned = value.toString().replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Identify the payer of a CSV file based on its headers
 * @param {string[]} headers - Array of column headers from the CSV
 * @param {Array} mappings - Payer mapping configuration
 * @returns {Object|null} Matching payer configuration or null if not found
 */
const identifyPayer = (headers, mappings = payerMappings) => {
  // Normalize headers for comparison (lowercase, trim)
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  
  // Check each payer configuration
  for (const mapping of mappings) {
    const identificationHeaders = mapping.identificationHeaders.map(h => h.toLowerCase().trim());
    
    // Check if all identification headers are present
    const allHeadersPresent = identificationHeaders.every(idHeader => 
      normalizedHeaders.some(header => header.includes(idHeader))
    );
    
    if (allHeadersPresent) {
      console.log(`[PayerProcessor] ✓ Identified file as ${mapping.payerName}`);
      return mapping;
    }
  }
  
  console.log('[PayerProcessor] ✗ Unable to identify payer for headers:', headers);
  return null;
};

/**
 * Map a row of data from source format to SDS format
 * @param {Object} row - Row data from CSV
 * @param {Object} mapping - Payer mapping configuration
 * @returns {Object} Mapped data in SDS format
 */
const mapRowToSDS = (row, mapping, isFirstRow = false) => {
  const mappedRow = {
    payerName: mapping.payerName
  };
  
  // Map each field according to the column mapping
  for (const [sourceColumn, sdsField] of Object.entries(mapping.columnMapping)) {
    // Find the actual column name (case-insensitive)
    const actualColumn = Object.keys(row).find(key => 
      key.toLowerCase().trim() === sourceColumn.toLowerCase().trim()
    );
    
    if (actualColumn) {
      const value = row[actualColumn];
      
      // Handle date fields
      if (['serviceDate', 'dischargeDate', 'paymentDate', 'modifiedDate'].includes(sdsField)) {
        mappedRow[sdsField] = parseDate(value);
      }
      // Handle numeric fields
      else if (['claimedAmount', 'approvedAmount', 'paidAmount', 'queryRaised', 'daysToPayment'].includes(sdsField)) {
        mappedRow[sdsField] = parseNumber(value);
      }
      // Handle string fields
      else {
        mappedRow[sdsField] = value ? value.toString().trim() : '';
      }
    } else {
      // Set default values for missing fields
      if (['claimedAmount', 'approvedAmount', 'paidAmount', 'queryRaised', 'daysToPayment'].includes(sdsField)) {
        mappedRow[sdsField] = 0;
      } else if (['serviceDate', 'dischargeDate', 'paymentDate', 'modifiedDate'].includes(sdsField)) {
        mappedRow[sdsField] = null;
      } else {
        mappedRow[sdsField] = '';
      }
    }
  }
  
  // Special handling for RGHS Payment Tracker - preserve original names or use specific placeholders
  if (mapping.payerName === 'RGHS Payment Tracker') {
    if (!mappedRow.patientName) {
      mappedRow.patientName = 'Payment Tracker Patient';
    }
    if (!mappedRow.hospitalName) {
      mappedRow.hospitalName = 'Payment Tracker Hospital';
    }
  }
  
  // Debug log for first row to verify mapping
  if (isFirstRow) {
    console.log(`[PayerProcessor] Sample mapping for ${mapping.payerName}:`);
    console.log('  Original:', Object.keys(row).slice(0, 5).join(', '), '...');
    console.log('  Mapped:', Object.keys(mappedRow).slice(0, 5).join(', '), '...');
  }
  
  return mappedRow;
};

/**
 * Process a single payer file
 * @param {File} file - The file to process
 * @param {Array} mappings - Payer mapping configuration
 * @returns {Promise<Object>} Processing result
 */
const processFile = async (file, mappings = payerMappings) => {
  console.log(`[PayerProcessor] Processing ${file.name}...`);
  
  try {
    // Read file data
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { 
      type: 'array',
      raw: false,
      dateNF: 'yyyy-mm-dd',
      cellDates: true,
      cellText: false
    });
    
    // Get the first sheet
    const firstSheetName = workbook.SheetNames[0];
    const firstSheet = workbook.Sheets[firstSheetName];
    
    // Convert to JSON to get raw data
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { 
      header: 1,
      raw: false,
      dateNF: 'yyyy-mm-dd',
      defval: ''
    });
    
    // Handle cases where Excel leaves empty rows at the top
    let dataStartRow = 0;
    let headers = [];
    
    // Skip empty rows and find headers
    for (let i = 0; i < Math.min(10, jsonData.length); i++) {
      const row = jsonData[i];
      if (row && row.length > 0 && row.some(cell => cell && cell.toString().trim())) {
        // Check if this looks like a header row (has enough non-empty cells)
        const nonEmptyCells = row.filter(cell => cell && cell.toString().trim()).length;
        if (nonEmptyCells >= 3) {
          headers = row.map(h => (h || '').toString().trim()).filter(h => h);
          dataStartRow = i + 1;
          break;
        }
      }
    }
    
    // For MAA Yojana files, check if there's a title row
    if (headers.length > 0 && headers[0].toLowerCase().includes('generic')) {
      // This is likely a title row, real headers are in next row
      if (jsonData[dataStartRow]) {
        headers = jsonData[dataStartRow].map(h => (h || '').toString().trim()).filter(h => h);
        dataStartRow = 2;
      }
    }
    
    // Clean headers of invisible Unicode characters
    headers = headers.map(h => {
      if (typeof h === 'string') {
        // Also clean any weird whitespace characters
        return h.replace(/[\u200B-\u200D\uFEFF\u202C]/g, '').replace(/\s+/g, ' ').trim();
      }
      return h;
    });
    
    // Identify payer
    const payerMapping = identifyPayer(headers, mappings);
    if (!payerMapping) {
      console.log(`[PayerProcessor] Failed to identify payer for ${file.name}. Headers:`, headers.slice(0, 5), '...');
      throw new Error('Unknown file format - unable to identify payer');
    }
    
    // Convert to object format
    let objectData;
    if (dataStartRow > 1) {
      // For files with title rows, we need to manually convert
      const dataRows = jsonData.slice(dataStartRow);
      objectData = dataRows.map(row => {
        const obj = {};
        headers.forEach((header, index) => {
          let value = row[index] || '';
          // Clean Unicode characters from values
          if (typeof value === 'string') {
            value = value.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
          }
          obj[header] = value;
        });
        return obj;
      });
    } else {
      objectData = XLSX.utils.sheet_to_json(firstSheet, {
        raw: false,
        dateNF: 'yyyy-mm-dd',
        defval: ''
      });
      // Clean Unicode characters from all string values
      objectData = objectData.map(row => {
        const cleanRow = {};
        Object.keys(row).forEach(key => {
          let value = row[key];
          if (typeof value === 'string') {
            value = value.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
          }
          cleanRow[key] = value;
        });
        return cleanRow;
      });
    }
    
    // Map data to SDS format
    const mappedData = objectData.map((row, index) => 
      mapRowToSDS(row, payerMapping, index === 0)
    );
    
    // Filter out invalid rows (missing required fields)
    const validData = mappedData.filter(row => 
      row.claimId && 
      (row.patientName || payerMapping.payerName === 'RGHS Payment Tracker')
    );
    
    console.log(`[PayerProcessor] ${file.name}: ${validData.length} valid records (${payerMapping.payerName})`);
    
    return {
      success: true,
      fileName: file.name,
      payerName: payerMapping.payerName,
      data: validData,
      rowCount: validData.length
    };
    
  } catch (error) {
    console.error(`[PayerProcessor] Error processing ${file.name}:`, error.message);
    return {
      success: false,
      fileName: file.name,
      error: error.message
    };
  }
};

/**
 * Process multiple payer files and consolidate the data
 * @param {FileList|File[]} files - List of files to process
 * @param {Array} mappings - Optional custom payer mappings (defaults to payerMappings.json)
 * @returns {Promise<Object>} Object with consolidatedData and processingErrors arrays
 */
export const processPayerFiles = async (files, mappings = payerMappings) => {
  console.log(`[PayerProcessor] Processing ${files.length} files...`);
  
  const consolidatedData = [];
  const processingErrors = [];
  const processingStats = {
    totalFiles: files.length,
    successfulFiles: 0,
    failedFiles: 0,
    totalRecords: 0,
    payerBreakdown: {}
  };
  
  // Convert FileList to array if needed
  const fileArray = Array.from(files);
  
  // Process each file
  for (const file of fileArray) {
    const result = await processFile(file, mappings);
    
    if (result.success) {
      consolidatedData.push(...result.data);
      processingStats.successfulFiles++;
      processingStats.totalRecords += result.rowCount;
      
      // Track payer breakdown
      if (!processingStats.payerBreakdown[result.payerName]) {
        processingStats.payerBreakdown[result.payerName] = {
          files: 0,
          records: 0
        };
      }
      processingStats.payerBreakdown[result.payerName].files++;
      processingStats.payerBreakdown[result.payerName].records += result.rowCount;
      
    } else {
      processingErrors.push({
        fileName: result.fileName,
        error: result.error
      });
      processingStats.failedFiles++;
    }
  }
  
  if (processingStats.successfulFiles > 0) {
    console.log(`[PayerProcessor] ✓ Processed ${processingStats.successfulFiles}/${processingStats.totalFiles} files, ${processingStats.totalRecords} total records`);
  } else {
    console.log(`[PayerProcessor] ✗ Failed to process any files`);
  }
  
  return {
    consolidatedData,
    processingErrors,
    stats: processingStats
  };
};

/**
 * Wrapper function for single file processing with the same API as processPayerFiles
 * This is what's actually imported and used by CSVUpload
 */
export const processFiles = processPayerFiles;

/**
 * Export functions for testing and external use
 */
export { 
  identifyPayer, 
  mapRowToSDS, 
  parseDate, 
  parseNumber 
};