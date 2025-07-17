import { useState, useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/auth/Login';
import UserManagement from './components/auth/UserManagement';
import UserProfile from './components/auth/UserProfile';
import CSVUpload from './components/upload/CSVUpload';
import Dashboard from './components/dashboard/Dashboard';
import ProposalGenerator from './components/proposal/ProposalGenerator';
import { BarChart3, Upload, LogOut, User, Users, Settings, ArrowLeft, FileText } from 'lucide-react';
import { compressDataForStorage, decompressDataFromStorage, calculateStorageSize } from './utils/storageUtils';

// Configuration constants
const STORAGE_KEY_PREFIX = import.meta.env.VITE_STORAGE_KEY_PREFIX || 'eyther_';

// Main App Content Component
const AppContent = () => {
  const [csvData, setCsvData] = useState(null);
  const [selectedScheme, setSelectedScheme] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard'); // dashboard, users, profile, proposal
  const { isAuthenticated, user, logout, isSuperAdmin, isAdmin } = useAuth();
  
  // Multi-payer state
  const [consolidatedData, setConsolidatedData] = useState(null);
  const [identifiedPayers, setIdentifiedPayers] = useState([]);
  const [selectedPayers, setSelectedPayers] = useState([]);
  const [processingErrors, setProcessingErrors] = useState([]);
  const [isMultiPayerMode, setIsMultiPayerMode] = useState(false);

  // Generate user-specific storage keys
  const getUserStorageKeys = (userId) => {
    return {
      csvDataKey: `${STORAGE_KEY_PREFIX}csv_data_${userId}`,
      selectedSchemeKey: `${STORAGE_KEY_PREFIX}selected_scheme_${userId}`,
      consolidatedDataKey: `${STORAGE_KEY_PREFIX}consolidated_data_${userId}`,
      identifiedPayersKey: `${STORAGE_KEY_PREFIX}identified_payers_${userId}`,
      selectedPayersKey: `${STORAGE_KEY_PREFIX}selected_payers_${userId}`,
      isMultiPayerModeKey: `${STORAGE_KEY_PREFIX}is_multi_payer_${userId}`,
      metadataKey: `${STORAGE_KEY_PREFIX}metadata_${userId}`
    };
  };
  
  // Get hospital name from data
  const getHospitalName = (data, scheme) => {
    if (!data || data.length === 0) return '';
    
    // Multi-payer mode
    if (scheme === 'multi_payer' && data[0] && data[0].hospitalName) {
      const counts = {};
      data.forEach(row => {
        const name = row.hospitalName || '';
        if (name && name !== 'RGHS Hospital') { // Ignore placeholder names
          counts[name] = (counts[name] || 0) + 1;
        }
      });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      return sorted.length > 0 ? sorted[0][0] : 'Multi-Payer Network';
    }
    
    return '';
  };

  // Load data from localStorage on component mount
  useEffect(() => {
    if (user?.id) {
      const keys = getUserStorageKeys(user.id);
      
      // Load multi-payer mode preference
      const savedMultiPayerMode = localStorage.getItem(keys.isMultiPayerModeKey);
      if (savedMultiPayerMode !== null) {
        setIsMultiPayerMode(savedMultiPayerMode === 'true');
      }
      
      // Check if we have multi-payer data
      const savedConsolidatedData = localStorage.getItem(keys.consolidatedDataKey);
      const savedIdentifiedPayers = localStorage.getItem(keys.identifiedPayersKey);
      
      if (savedConsolidatedData && savedIdentifiedPayers) {
        try {
          let parsedData = JSON.parse(savedConsolidatedData);
          
          // Check metadata for compression info
          const savedMetadata = localStorage.getItem(keys.metadataKey);
          if (savedMetadata) {
            const metadata = JSON.parse(savedMetadata);
            
            // Handle compressed data
            if (metadata.isCompressed) {
              console.log('Decompressing data...');
              parsedData = decompressDataFromStorage(parsedData);
            }
            
            if (metadata.dataNotPersisted) {
              toast.info('Previous data was too large to save. Please re-upload your files.');
              // Clear the partial data
              setConsolidatedData(null);
              setIdentifiedPayers([]);
              setSelectedPayers([]);
              setIsMultiPayerMode(false);
              setSelectedScheme(null);
              return;
            } else if (metadata.totalRows && parsedData.length < metadata.totalRows) {
              toast.warning(`Data may be incomplete. Showing ${parsedData.length} of ${metadata.totalRows} rows.`);
            }
          }
          
          setConsolidatedData(parsedData);
          setIdentifiedPayers(JSON.parse(savedIdentifiedPayers));
          setSelectedPayers(JSON.parse(localStorage.getItem(keys.selectedPayersKey) || '[]'));
          setIsMultiPayerMode(true);
          setSelectedScheme('multi_payer');
        } catch (error) {
          console.error('Error loading multi-payer data:', error);
          // Clear corrupted data
          localStorage.removeItem(keys.consolidatedDataKey);
          localStorage.removeItem(keys.identifiedPayersKey);
          localStorage.removeItem(keys.selectedPayersKey);
        }
      } else {
        // Fall back to single-scheme data
        const savedData = localStorage.getItem(keys.csvDataKey);
        const savedScheme = localStorage.getItem(keys.selectedSchemeKey);
        
        if (savedData && savedScheme) {
          try {
            setCsvData(JSON.parse(savedData));
            setSelectedScheme(savedScheme);
          } catch (error) {
            console.error('Error loading saved data:', error);
            // Clear corrupted data
            localStorage.removeItem(keys.csvDataKey);
            localStorage.removeItem(keys.selectedSchemeKey);
          }
        }
      }
    }
  }, [user?.id]);

  // Handle processing errors with toast notifications
  useEffect(() => {
    if (processingErrors && processingErrors.length > 0) {
      processingErrors.forEach((error) => {
        const message = error.fileName 
          ? `Could not process '${error.fileName}'. ${error.error || 'Format not recognized.'}`
          : `Could not process file. ${error.error || 'Format not recognized.'}`;
          
        toast.error(message, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      });
    }
  }, [processingErrors]);

  const handleDataLoaded = (data, scheme, stats = null) => {
    setIsLoading(false);
    
    if (scheme === 'multi_payer') {
      // Handle multi-payer data
      setConsolidatedData(data);
      setSelectedScheme(scheme);
      setIsMultiPayerMode(true);
      
      // Extract unique payer names
      // Consolidate RGHS variants into single "RGHS" for display
      const consolidatePayerName = (payerName) => {
        if (payerName.includes('RGHS')) {
          return 'RGHS';
        }
        return payerName;
      };
      
      const payers = [...new Set(data.map(record => consolidatePayerName(record.payerName)))].sort();
      setIdentifiedPayers(payers);
      setSelectedPayers(payers); // Initially select all payers
      
      // Clear processing errors if any
      setProcessingErrors(stats?.processingErrors || []);
      
      // Save to localStorage
      if (user?.id) {
        const keys = getUserStorageKeys(user.id);
        try {
          // Calculate data size
          const dataSizeMB = calculateStorageSize(data);
          console.log(`Data size: ${dataSizeMB} MB`);
          
          // Try to store complete data with compression if needed
          let dataToStore = data;
          let isCompressed = false;
          
          // If data is large, try compression
          if (parseFloat(dataSizeMB) > 2) {
            console.log('Data is large, attempting compression...');
            dataToStore = compressDataForStorage(data);
            isCompressed = true;
            const compressedSizeMB = calculateStorageSize(dataToStore);
            console.log(`Compressed size: ${compressedSizeMB} MB`);
          }
          
          localStorage.setItem(keys.consolidatedDataKey, JSON.stringify(dataToStore));
          localStorage.setItem(keys.identifiedPayersKey, JSON.stringify(payers));
          localStorage.setItem(keys.selectedPayersKey, JSON.stringify(payers));
          localStorage.setItem(keys.isMultiPayerModeKey, 'true');
          localStorage.setItem(keys.selectedSchemeKey, scheme);
          
          // Store metadata including row count and hospital name
          const metadata = {
            totalRows: data.length,
            hospitalName: getHospitalName(data, 'multi_payer'),
            uploadTime: new Date().toISOString(),
            isCompressed,
            originalSizeMB: dataSizeMB
          };
          localStorage.setItem(keys.metadataKey, JSON.stringify(metadata));
          
          // Clear old single-scheme data
          localStorage.removeItem(keys.csvDataKey);
        } catch (error) {
          console.warn('Failed to save multi-payer data to localStorage:', error);
          if (error.name === 'QuotaExceededError') {
            toast.warning('Data is too large to save. The dashboard will work but data won\'t persist after refresh.');
            
            // Clear old data to make space
            try {
              localStorage.removeItem(keys.csvDataKey);
              localStorage.removeItem(keys.consolidatedDataKey);
              
              // Try to save at least the metadata and payer info
              localStorage.setItem(keys.identifiedPayersKey, JSON.stringify(payers));
              localStorage.setItem(keys.selectedPayersKey, JSON.stringify(payers));
              localStorage.setItem(keys.isMultiPayerModeKey, 'true');
              localStorage.setItem(keys.selectedSchemeKey, scheme);
              localStorage.setItem(keys.metadataKey, JSON.stringify({
                totalRows: data.length,
                hospitalName: getHospitalName(data, 'multi_payer'),
                uploadTime: new Date().toISOString(),
                dataNotPersisted: true
              }));
            } catch (retryError) {
              console.error('Failed to save even metadata:', retryError);
            }
          }
        }
      }
    } else {
      // Handle single-scheme data (backward compatibility)
      setCsvData(data);
      setSelectedScheme(scheme);
      setIsMultiPayerMode(false);
      
      // Clear multi-payer state
      setConsolidatedData(null);
      setIdentifiedPayers([]);
      setSelectedPayers([]);
      
      // Save to localStorage with compression - only store essential data
      if (user?.id) {
        const keys = getUserStorageKeys(user.id);
        try {
          // Store complete data - handle quota exceeded errors gracefully
          localStorage.setItem(keys.csvDataKey, JSON.stringify(data));
          localStorage.setItem(keys.selectedSchemeKey, scheme);
          localStorage.setItem(keys.isMultiPayerModeKey, 'false');
          
          // Store metadata
          const metadata = {
            totalRows: Array.isArray(data) ? data.length : 
                      (data.tmsData ? data.tmsData.length : 0),
            uploadTime: new Date().toISOString()
          };
          localStorage.setItem(keys.metadataKey, JSON.stringify(metadata));
          
          // Clear multi-payer data
          localStorage.removeItem(keys.consolidatedDataKey);
          localStorage.removeItem(keys.identifiedPayersKey);
          localStorage.removeItem(keys.selectedPayersKey);
        } catch (error) {
          console.warn('Failed to save data to localStorage:', error);
          if (error.name === 'QuotaExceededError') {
            toast.warning('Data is too large to save. The dashboard will work but data won\'t persist after refresh.');
            
            // Try to save at least the scheme and metadata
            try {
              localStorage.setItem(keys.selectedSchemeKey, scheme);
              localStorage.setItem(keys.isMultiPayerModeKey, 'false');
              localStorage.setItem(keys.metadataKey, JSON.stringify({
                totalRows: Array.isArray(data) ? data.length : 
                          (data.tmsData ? data.tmsData.length : 0),
                uploadTime: new Date().toISOString(),
                dataNotPersisted: true
              }));
            } catch (retryError) {
              console.error('Failed to save even metadata:', retryError);
            }
          }
        }
      }
    }
  };

  const handleNewUpload = () => {
    setCsvData(null);
    setSelectedScheme(null);
    setConsolidatedData(null);
    setIdentifiedPayers([]);
    setSelectedPayers([]);
    setProcessingErrors([]);
    setIsMultiPayerMode(false);
    
    // Clear from localStorage
    if (user?.id) {
      const keys = getUserStorageKeys(user.id);
      localStorage.removeItem(keys.csvDataKey);
      localStorage.removeItem(keys.selectedSchemeKey);
      localStorage.removeItem(keys.consolidatedDataKey);
      localStorage.removeItem(keys.identifiedPayersKey);
      localStorage.removeItem(keys.selectedPayersKey);
      localStorage.removeItem(keys.isMultiPayerModeKey);
    }
  };

  const handleLogout = async () => {
    // Clear current user's data from state
    setCsvData(null);
    setSelectedScheme(null);
    setConsolidatedData(null);
    setIdentifiedPayers([]);
    setSelectedPayers([]);
    setProcessingErrors([]);
    setIsMultiPayerMode(false);
    setCurrentView('dashboard');
    await logout();
  };

  // Show login page if not authenticated
  if (!isAuthenticated()) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div>
                <button 
                  onClick={() => {
                    setCurrentView('dashboard');
                    handleNewUpload(); // This will clear all data
                  }}
                  className="text-3xl font-bold text-[#2a5eb4] font-['Nunito_Sans'] hover:text-[#1e4a8c] transition-colors"
                >
                  Eyther.
                </button>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* User Info */}
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4 text-slate-600" />
                <span className="text-sm text-slate-700">
                  {user?.firstName} {user?.lastName}
                </span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full capitalize">
                  {user?.role?.replace('_', ' ')}
                </span>
              </div>

              {/* Upload New File Button */}
              {(csvData || consolidatedData) && currentView === 'dashboard' && (
                <button
                  onClick={handleNewUpload}
                  className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload New File
                </button>
              )}

              <div className="flex items-center space-x-2">
                {/* Profile Settings */}
                <button
                  onClick={() => setCurrentView('profile')}
                  className="inline-flex items-center p-2 border border-slate-300 rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                  title="Profile Settings"
                >
                  <Settings className="w-5 h-5" />
                </button>

                {/* Super Admin User Management */}
                {isSuperAdmin() && (
                  <button
                    onClick={() => setCurrentView('users')}
                    className="inline-flex items-center p-2 border border-slate-300 rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                    title="User Management"
                  >
                    <Users className="w-5 h-5" />
                  </button>
                )}

                {/* Proposal Generator - Admin and Super Admin only */}
                {isAdmin() && (
                  <button
                    onClick={() => setCurrentView('proposal')}
                    className="inline-flex items-center p-2 border border-slate-300 rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                    title="Proposal Generator"
                  >
                    <FileText className="w-5 h-5" />
                  </button>
                )}

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center px-4 py-2 border border-red-300 rounded-lg text-red-700 bg-white hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'users' ? (
          <UserManagement onBack={() => setCurrentView('dashboard')} />
        ) : currentView === 'profile' ? (
          <UserProfile onBack={() => setCurrentView('dashboard')} />
        ) : currentView === 'proposal' ? (
          <div>
            <button
              onClick={() => setCurrentView('dashboard')}
              className="mb-4 inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </button>
            <ProposalGenerator />
          </div>
        ) : !csvData && !consolidatedData ? (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">
                Eyther Vision
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Upload your hospital claims data to unlock powerful insights into revenue performance, 
                denial patterns, and optimization opportunities with Eyther's advanced analytics.
              </p>
            </div>
            
            <CSVUpload onDataLoaded={handleDataLoaded} isLoading={isLoading} />
            
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-6">
                <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-6 h-6 text-slate-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Easy Upload</h3>
                <p className="text-slate-600">Simply drag and drop your CSV file or click to browse</p>
              </div>
              
              <div className="text-center p-6">
                <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-6 h-6 text-slate-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Rich Analytics</h3>
                <p className="text-slate-600">Get comprehensive insights with interactive charts and statistics</p>
              </div>
              
              <div className="text-center p-6">
                <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <div className="w-6 h-6 text-slate-600 font-bold">₹</div>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Financial Insights</h3>
                <p className="text-slate-600">Track claim amounts, approval rates, and payment trends</p>
              </div>
            </div>
          </div>
        ) : (
          <Dashboard 
            data={isMultiPayerMode ? consolidatedData : csvData} 
            scheme={selectedScheme}
            identifiedPayers={identifiedPayers}
            selectedPayers={selectedPayers}
            onPayerFilterChange={setSelectedPayers}
            isMultiPayerMode={isMultiPayerMode}
          />
        )}
      </main>
    </div>
  );
};

// Main App Component with Auth Provider
function App() {
  return (
    <AuthProvider>
      <AppContent />
      
      {/* Toast Notifications */}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </AuthProvider>
  );
}

export default App;