import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Download, Loader2, Settings } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';

const ProposalGenerator = () => {
  const { token, user } = useAuth();
  const [formData, setFormData] = useState({
    hospitalName: '',
    contactPerson: '',
    email: '',
    title: ''
  });
  
  const [eytherTeamData, setEytherTeamData] = useState({
    contactEmail: '',
    contactPhone: '',
    teamMemberName: ''
  });
  
  const [showEytherConfig, setShowEytherConfig] = useState(false);
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle, success, error
  const [isGenerating, setIsGenerating] = useState(false);
  const [errors, setErrors] = useState({});
  
  // Load saved Eyther team data on component mount
  useEffect(() => {
    const savedData = localStorage.getItem(`eyther_team_${user?.id || 'default'}`);
    if (savedData) {
      try {
        setEytherTeamData(JSON.parse(savedData));
      } catch (e) {
        console.error('Error loading saved Eyther team data:', e);
      }
    }
  }, [user]);
  
  // Save Eyther team data whenever it changes
  const saveEytherTeamData = (data) => {
    setEytherTeamData(data);
    localStorage.setItem(`eyther_team_${user?.id || 'default'}`, JSON.stringify(data));
  };

  // Form validation
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.hospitalName.trim()) {
      newErrors.hospitalName = 'Hospital name is required';
    }
    
    
    if (!file) {
      newErrors.file = 'Please upload a CSV file';
    }
    
    // Email validation if provided
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // File upload handling
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    
    const csvFile = acceptedFiles[0];
    
    // Validate file type
    if (!csvFile.name.endsWith('.csv') && !csvFile.name.endsWith('.xlsx')) {
      toast.error('Please upload a CSV or Excel file');
      setUploadStatus('error');
      return;
    }
    
    // Validate file size (50MB limit)
    if (csvFile.size > 50 * 1024 * 1024) {
      toast.error('File size must be less than 50MB');
      setUploadStatus('error');
      return;
    }
    
    setFile(csvFile);
    setUploadStatus('success');
    
    // Clear file error
    if (errors.file) {
      setErrors(prev => ({
        ...prev,
        file: ''
      }));
    }
  }, [errors.file]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false,
    maxFiles: 1
  });

  // Generate proposal
  const handleGenerateProposal = async () => {
    if (!validateForm()) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setIsGenerating(true);
    
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('csvFile', file);
      formDataToSend.append('hospitalName', formData.hospitalName);
      formDataToSend.append('contactPerson', formData.contactPerson);
      formDataToSend.append('email', formData.email);
      formDataToSend.append('title', formData.title);
      formDataToSend.append('eytherContactEmail', eytherTeamData.contactEmail);
      formDataToSend.append('eytherContactPhone', eytherTeamData.contactPhone);
      formDataToSend.append('eytherTeamMember', eytherTeamData.teamMemberName);
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/proposal/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataToSend
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate proposal');
      }
      
      // Handle PDF download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `proposal_${formData.hospitalName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Proposal generated successfully!');
      
      // Reset form
      setFormData({
        hospitalName: '',
        contactPerson: '',
        email: '',
        title: ''
      });
      setFile(null);
      setUploadStatus('idle');
      
    } catch (error) {
      console.error('Error generating proposal:', error);
      toast.error(error.message || 'Failed to generate proposal');
    } finally {
      setIsGenerating(false);
    }
  };

  const getUploadStatusIcon = () => {
    if (uploadStatus === 'success' && file) {
      return <CheckCircle className="w-8 h-8 text-green-500" />;
    } else if (uploadStatus === 'error') {
      return <AlertCircle className="w-8 h-8 text-red-500" />;
    }
    return <Upload className="w-8 h-8 text-gray-400" />;
  };

  const getUploadMessage = () => {
    if (file) {
      return `Selected: ${file.name}`;
    }
    return 'Drop your CSV file here or click to browse';
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Proposal Generator</h1>
            <p className="text-gray-600">
              Generate professional revenue recovery proposals for healthcare providers
            </p>
          </div>
          <button
            onClick={() => setShowEytherConfig(!showEytherConfig)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span>Eyther Team Settings</span>
          </button>
        </div>

        {/* Eyther Team Configuration */}
        {showEytherConfig && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-blue-800 mb-4">Eyther Team Contact Information</h3>
            <p className="text-sm text-blue-600 mb-4">
              This information will be saved for your user and used in all proposals you generate.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team Member Name
                </label>
                <input
                  type="text"
                  value={eytherTeamData.teamMemberName}
                  onChange={(e) => saveEytherTeamData({...eytherTeamData, teamMemberName: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Bharat"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={eytherTeamData.contactEmail}
                  onChange={(e) => saveEytherTeamData({...eytherTeamData, contactEmail: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="bharat@eyther.ai"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={eytherTeamData.contactPhone}
                  onChange={(e) => saveEytherTeamData({...eytherTeamData, contactPhone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>
          </div>
        )}

        {/* Hospital Information */}
        <div className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Hospital Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hospital Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="hospitalName"
                value={formData.hospitalName}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.hospitalName ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Apollo Hospitals Chennai"
              />
              {errors.hospitalName && (
                <p className="text-red-500 text-sm mt-1">{errors.hospitalName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Person
              </label>
              <input
                type="text"
                name="contactPerson"
                value={formData.contactPerson}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Dr. Rajesh Kumar"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="contact@hospital.com"
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title/Designation
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Chief Financial Officer"
              />
            </div>
          </div>
        </div>

        {/* File Upload Section */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Claims Data <span className="text-red-500">*</span>
          </h2>
          
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
              ${uploadStatus === 'success' ? 'border-green-300 bg-green-50' : ''}
              ${uploadStatus === 'error' || errors.file ? 'border-red-300 bg-red-50' : ''}
              ${isGenerating ? 'pointer-events-none opacity-50' : ''}
            `}
          >
            <input {...getInputProps()} />
            
            <div className="flex flex-col items-center space-y-4">
              {getUploadStatusIcon()}
              
              <div>
                <p className="text-lg font-medium text-gray-700">
                  {getUploadMessage()}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Upload MAA Yojna claims data in CSV format (GenericSearchReport)
                </p>
              </div>

              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <FileSpreadsheet className="w-4 h-4" />
                <span>CSV or Excel files (Max 50MB)</span>
              </div>
            </div>
          </div>
          
          {errors.file && (
            <p className="text-red-500 text-sm mt-2">{errors.file}</p>
          )}
        </div>

        {/* Generate Button */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleGenerateProposal}
            disabled={isGenerating}
            className={`
              px-6 py-3 rounded-md font-medium text-white flex items-center space-x-2
              ${isGenerating 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
              }
              transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            `}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Generating Proposal...</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>Generate Proposal</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProposalGenerator;