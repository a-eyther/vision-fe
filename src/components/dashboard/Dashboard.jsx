import { useMemo, useState, useEffect } from 'react';
import { 
  FileText, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Users, 
  Building2, 
  Calendar,
  Download,
  AlertTriangle,
  XCircle,
  Clock,
  Eye,
  BarChart3
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import StatCard from './StatCard';
import ROICalculator from './ROICalculator';
import QueryImpactAnalysis from './QueryImpactAnalysis';
import SpecialtyPerformanceAnalysis from './SpecialtyPerformanceAnalysis';
import DrillDownTable from './DrillDownTable';
import DateFilter from './DateFilter';
import CustomBarChart from '../charts/BarChart';
import CustomLineChart from '../charts/LineChart';
import CustomPieChart from '../charts/PieChart';
import { generateDashboardStats, generateChartData, generateRCMInsights, calculateTotalSavings, exportToCSV, filterData, generateRGHSDashboardStats, generateRGHSChartData, generateMultiPayerDashboardStats } from '../../utils/dataProcessor';
import { formatCurrency, formatNumber, formatPercentage, formatDays, formatDelayDifference } from '../../utils/formatters';
import PayerFilter from '../PayerFilter';
import DataSourceIndicator from '../ui/DataSourceIndicator';
import { auditDashboardMetrics } from '../../utils/metricsAudit';

// Define base tabs - Additional tabs will be added conditionally based on user role
const BASE_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'insights', label: 'Insights' }
];

const ROI_TAB = { key: 'roi', label: 'ROI Calculator' };

const getHospitalName = (data, scheme) => {
  if (!data || data.length === 0) return '';
  
  // Multi-payer mode
  if (scheme === 'multi_payer' && data[0] && data[0].hospitalName) {
    const counts = {};
    const placeholderNames = ['RGHS Hospital', 'Payment Tracker Hospital', 'RGHS Patient', 'Payment Tracker Patient'];
    
    data.forEach(row => {
      const name = row.hospitalName || '';
      // Skip placeholder names when counting
      if (name && !placeholderNames.includes(name)) {
        counts[name] = (counts[name] || 0) + 1;
      }
    });
    
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      return sorted[0][0];
    }
    
    // If only placeholder names exist, return a generic name
    return 'Multi-Payer Healthcare Network';
  }
  
  if (scheme === 'rghs' && Array.isArray(data)) {
    // For RGHS, find TMS data and get hospital names
    const tmsFile = data.find(file => file.fileType === 'tms_data');
    if (tmsFile && tmsFile.data) {
      const counts = {};
      tmsFile.data.forEach(row => {
        const name = row['HOSPITALNAME'] || '';
        if (name) counts[name] = (counts[name] || 0) + 1;
      });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      return sorted.length > 0 ? sorted[0][0] : (tmsFile.data[0]['HOSPITALNAME'] || '');
    }
    return 'RGHS Hospital Network';
  }
  
  // For MAA Yojana
  const counts = {};
  data.forEach(row => {
    const name = row['Hospital Name'] || '';
    if (name) counts[name] = (counts[name] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : (data[0]['Hospital Name'] || '');
};

const Dashboard = ({ 
  data, 
  scheme, 
  onExport,
  identifiedPayers = [],
  selectedPayers = [],
  onPayerFilterChange,
  isMultiPayerMode = false
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [dateFilter, setDateFilter] = useState(null);
  const [drillDownData, setDrillDownData] = useState({ isOpen: false, data: [], title: '', type: 'rejection' });
  const { isAdmin } = useAuth();

  // Redirect to overview if non-admin tries to access admin-only tabs
  useEffect(() => {
    if (!isAdmin() && (activeTab === 'roi' || activeTab === 'users')) {
      setActiveTab('overview');
    }
  }, [activeTab, isAdmin]);

  // Create tabs array based on user role
  const TABS = useMemo(() => {
    const tabs = [...BASE_TABS];
    // Only add ROI Calculator tab for admin users
    if (isAdmin()) {
      tabs.push(ROI_TAB);
    }
    return tabs;
  }, [isAdmin]);
  
  // Check if MAA Yojana data is available (for MAA-only metrics)
  const hasMAAData = useMemo(() => {
    if (scheme === 'multi_payer' && selectedPayers.length > 0) {
      return selectedPayers.includes('MAA Yojana');
    }
    return scheme === 'maa_yojna';
  }, [scheme, selectedPayers]);

  // Check if only RGHS data is selected (for hiding MAA-specific features)
  const hasOnlyRGHSData = useMemo(() => {
    if (scheme === 'multi_payer' && selectedPayers.length > 0) {
      return selectedPayers.every(payer => payer.includes('RGHS')) && selectedPayers.length > 0;
    }
    return scheme === 'rghs';
  }, [scheme, selectedPayers]);

  // Apply date filter to data and process based on scheme
  const { filteredData, stats, chartData } = useMemo(() => {
    // Handle multi-payer mode
    if (isMultiPayerMode && scheme === 'multi_payer') {
      // Filter data by selected payers
      let payerFilteredData = data;
      if (selectedPayers.length > 0 && selectedPayers.length < identifiedPayers.length) {
        payerFilteredData = data.filter(record => {
          // Handle RGHS consolidation
          if (selectedPayers.includes('RGHS') && record.payerName.includes('RGHS')) {
            return true;
          }
          return selectedPayers.includes(record.payerName);
        });
      }
      
      // Apply date filter if present
      const filtered = dateFilter ? filterData(payerFilteredData, { dateRange: dateFilter }, 'multi_payer') : payerFilteredData;
      
      // Generate stats using proper multi-payer handling
      const multiPayerStats = generateMultiPayerDashboardStats(filtered);
      const multiPayerChartData = generateChartData(filtered);
      
      return {
        filteredData: filtered,
        stats: multiPayerStats,
        chartData: multiPayerChartData
      };
    } else if (scheme === 'rghs' && Array.isArray(data)) {
      // For RGHS, process the multiple files
      const tmsFile = data.find(file => file.fileType === 'tms_data');
      const paymentFile = data.find(file => file.fileType === 'payment_tracker');
      
      if (!tmsFile) {
        return { filteredData: [], stats: null, chartData: {} };
      }
      
      let tmsData = tmsFile.data;
      let paymentData = paymentFile ? paymentFile.data : [];
      
      let filteredTmsDataForStats = tmsData;
      let filteredPaymentDataForStats = paymentData;

      // Apply date filter if present
      if (dateFilter) {
        const filteredTms = filterData(tmsData, { dateRange: dateFilter }, 'rghs');
        const filteredClaimIds = new Set(filteredTms.map(row => row['TID']));
        
        const filteredPayments = paymentData.filter(row => filteredClaimIds.has(row['Transaction Id']));

        filteredTmsDataForStats = filteredTms;
        filteredPaymentDataForStats = filteredPayments;
      }
      
      const rghsStats = generateRGHSDashboardStats(filteredTmsDataForStats, filteredPaymentDataForStats);
      const rghsChartData = generateRGHSChartData(filteredTmsDataForStats, filteredPaymentDataForStats);
      
      return {
        filteredData: { tmsData: filteredTmsDataForStats, paymentData: filteredPaymentDataForStats },
        stats: rghsStats,
        chartData: rghsChartData
      };
    } else {
      // For MAA Yojana, process as before
      const filtered = dateFilter ? filterData(data, { dateRange: dateFilter }) : data;
      const maaStats = generateDashboardStats(filtered);
      const maaChartData = generateChartData(filtered);
      
      return {
        filteredData: filtered,
        stats: maaStats,
        chartData: maaChartData
      };
    }
  }, [data, dateFilter, scheme, isMultiPayerMode, selectedPayers, identifiedPayers]);
  
  // Generate RCM insights based on stats and data
  const insights = useMemo(() => {
    if (!stats || !filteredData) return [];
    
    try {
      const dataForInsights = Array.isArray(filteredData) ? filteredData : 
                             (filteredData.tmsData || filteredData);
      return generateRCMInsights(dataForInsights, stats);
    } catch (error) {
      console.warn('Error generating RCM insights:', error);
      return [];
    }
  }, [stats, filteredData]);
  
  // Run audit when stats are generated
  useEffect(() => {
    if (stats && filteredData) {
      const dataToAudit = Array.isArray(filteredData) ? filteredData : 
                         (filteredData.tmsData || filteredData);
      auditDashboardMetrics(stats, dataToAudit);
    }
  }, [stats, filteredData]);
  
  // Create a separate, unfiltered stats object for the ROI calculator
  const roiStats = useMemo(() => {
    if (scheme === 'rghs' && Array.isArray(data)) {
      const tmsFile = data.find(file => file.fileType === 'tms_data');
      const paymentFile = data.find(file => file.fileType === 'payment_tracker');
      if (!tmsFile) return null;
      return generateRGHSDashboardStats(tmsFile.data, paymentFile ? paymentFile.data : []);
    } else {
      return generateDashboardStats(data);
    }
  }, [data, scheme]);
  
  const hospitalName = getHospitalName(data, scheme);

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
        <p className="text-gray-500">Upload a CSV file to view the dashboard</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Processing Data...</h3>
        <p className="text-gray-500">Please wait while we analyze your data</p>
      </div>
    );
  }

  const handleExport = () => {
    if (scheme === 'rghs' && filteredData.tmsData) {
      exportToCSV(filteredData.tmsData, 'rghs_claims_export.csv');
    } else {
      exportToCSV(filteredData, 'healthcare_claims_export.csv');
    }
  };

  const handleDrillDown = (type, filterCondition, title) => {
    let drillData = [];
    
    const dataToFilter = scheme === 'rghs' ? filteredData.tmsData : filteredData;

    if (dataToFilter) {
      // Convert multi-payer data to MAA format for drill down
      let processedData = dataToFilter;
      if (scheme === 'multi_payer' && Array.isArray(dataToFilter)) {
        // If only RGHS is selected, convert to RGHS format for drill down
        if (hasOnlyRGHSData) {
          processedData = dataToFilter.map(row => ({
            'TID': row.claimId,
            'PATIENTNAME': row.patientName,
            'HOSPITALNAME': row.hospitalName,
            'STATUS': row.status,
            'HOSPITALCLAIMAMOUNT': row.claimedAmount,
            'CUAPPROVEDAMOUNT': row.approvedAmount,
            'DEPARTMENT': row.specialty || 'Unknown',
            '_payerName': row.payerName
          }));
        } else {
          // Convert to MAA format for drill down
          processedData = dataToFilter.map(row => ({
            'TID': row.claimId,
            'Patient Name': row.patientName,
            'Hospital Name': row.hospitalName,
            'Status': row.status,
            'Pkg Rate': row.claimedAmount,
            'Approved Amount': row.approvedAmount,
            'Payment Date': row.paymentDate,
            'Pkg Speciality Name': row.specialty || 'Unknown',
            'District Name': row.districtName || '',
            'Gender': row.gender || '',
            'Query Raised': row.queryRaised || 0,
            '_payerName': row.payerName
          }));
        }
      }
      
      drillData = processedData.filter(filterCondition)
        .sort((a, b) => {
          const amountA = scheme === 'rghs' ? (a['HOSPITALCLAIMAMOUNT'] || 0) : (a['Pkg Rate'] || 0);
          const amountB = scheme === 'rghs' ? (b['HOSPITALCLAIMAMOUNT'] || 0) : (b['Pkg Rate'] || 0);
          return amountB - amountA;
        })
        .slice(0, 100);
    }
    
    setDrillDownData({
      isOpen: true,
      data: drillData,
      title,
      type,
      scheme: scheme === 'multi_payer' ? (hasOnlyRGHSData ? 'rghs' : 'maa_yojna') : scheme // Use appropriate scheme for drill downs
    });
  };

  const closeDrillDown = () => {
    setDrillDownData({ isOpen: false, data: [], title: '', type: 'rejection' });
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation + Date Filter Row */}
      <div className="sticky top-0 z-10 bg-gray-50 py-2 mb-2">
        <div className="flex items-center justify-between w-full px-4">
          {/* Tabs */}
          <div className="flex space-x-2">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-6 py-3 rounded-lg font-medium transition-all focus:outline-none font-['Nunito_Sans']
                  ${activeTab === tab.key ? 'bg-[#2a5eb4] text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}
                `}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {/* Filters */}
          <div className="ml-4 flex items-center space-x-3 justify-end flex-1">
            {/* Payer Filter for multi-payer mode */}
            {isMultiPayerMode && identifiedPayers.length > 0 && (
              <div className="min-w-[200px]">
                <PayerFilter 
                  options={identifiedPayers}
                  selectedValues={selectedPayers}
                  onChange={onPayerFilterChange}
                />
              </div>
            )}
            {/* Date Filter */}
            <div className="min-w-[180px]">
              <DateFilter 
                data={data} 
                onFilterChange={setDateFilter}
                scheme={scheme}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Header */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                {/* Hospital Dashboard Title */}
                <h1 className="text-2xl font-bold text-slate-900 font-['Nunito_Sans'] mb-2">{hospitalName} Dashboard</h1>
                
                
                {/* Dashboard Description */}
                <p className="text-slate-600 font-['Nunito_Sans']">
                  Analysis of {formatNumber(stats.totalClaims)} claims • 
                  <span className="ml-2 font-medium text-slate-700">Total Revenue: {formatCurrency(scheme === 'rghs' ? stats.totalRealizableRevenue : stats.totalClaimValue)}</span> • 
                  <span className="ml-2 font-medium text-slate-700">Collected: {formatCurrency(stats.totalPaidAmount)}</span>
                </p>
              </div>
              
              {/* Export Button */}
              <button
                onClick={handleExport}
                className="inline-flex items-center px-6 py-2 bg-[#2a5eb4] text-white rounded-lg hover:bg-[#1e4a8c] transition-colors shadow-sm font-medium font-['Nunito_Sans']"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Data
              </button>
            </div>
          </div>

          {/* Key Financial Impact Metrics - Top Priority */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
            <h3 className="font-semibold text-slate-900 mb-4">Key Financial Impact Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div 
                className="text-center p-4 bg-red-50 rounded-lg border border-red-100 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleDrillDown('rejection', 
                  row => {
                    if (scheme === 'rghs' || hasOnlyRGHSData) {
                      return row['STATUS'] && (
                        row['STATUS'].toUpperCase().includes('REJECTED') ||
                        row['STATUS'].toUpperCase().includes('REJECT')
                      );
                    }
                    return row['Status'] && (
                      row['Status'].toLowerCase().includes('rejected') ||
                      row['Status'].toLowerCase().includes('claim rejected (supervisor)') ||
                      row['Status'].toLowerCase().includes('claim rejected (analyser)')
                    );
                  }, 
                  'Revenue Leakage - All Rejected Claims'
                )}
              >
                <div className="text-2xl font-bold text-red-600 mb-2 flex items-center justify-center gap-1">
                  {formatCurrency(stats.revenueLeakage)}
                  <Eye className="w-4 h-4 text-red-400" />
                </div>
                <div className="text-sm text-gray-600 font-medium">Revenue Leakage</div>
                <div className="text-xs text-gray-500 mt-1">{formatPercentage(stats.revenueLeakageRate)} of total revenue</div>
              </div>
              <div 
                className="text-center p-4 bg-blue-50 rounded-lg border border-blue-100 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleDrillDown('query', 
                  row => {
                    if (scheme === 'rghs' || hasOnlyRGHSData) {
                      return row['STATUS'] && row['STATUS'].toUpperCase().includes('APPROVED');
                    }
                    return row['Status'] && row['Status'].toLowerCase().includes('approved') && row['Status'].toLowerCase().includes('supervisor');
                  }, 
                  'Outstanding Revenue - Amount Approved but Not Received'
                )}
              >
                <div className="text-2xl font-bold text-blue-600 mb-2 flex items-center justify-center gap-1">
                  {formatCurrency(stats.approvedUnpaidAmount)}
                  <Eye className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-sm text-gray-600 font-medium">Outstanding Revenue</div>
                <div className="text-xs text-gray-500 mt-1">
                  {scheme === 'rghs' ? 'Approved Claims' : 'Claims Approved by Supervisor'}
                </div>
              </div>
              <div 
                className="text-center p-4 bg-amber-50 rounded-lg border border-amber-100 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleDrillDown('query', 
                  row => {
                    if (scheme === 'rghs' || hasOnlyRGHSData) {
                      return row['STATUS'] && row['STATUS'].toUpperCase().includes('PENDING');
                    }
                    // For MAA Yojana and multi-payer, check for query/pending status
                    const status = row['Status'] || '';
                    return status && (
                      status.toLowerCase().includes('claim query') ||
                      status.toLowerCase().includes('pending') ||
                      status.toLowerCase().includes('query')
                    );
                  }, 
                  'Revenue Stuck in Query/Pending'
                )}
              >
                <div className="text-2xl font-bold text-amber-600 mb-2 flex items-center justify-center gap-1">
                  {formatCurrency(stats.revenueStuckInQuery)}
                  <Eye className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-sm text-gray-600 font-medium">
                  Revenue Stuck in Query/Pending
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Claims requiring action or pending processing
                </div>
              </div>
            </div>
          </div>

          {/* Core Hospital Metrics */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-4">Core Hospital Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <div className="text-2xl font-bold text-slate-900 mb-1">{formatNumber(stats.totalClaims)}</div>
                <div className="text-sm text-slate-600 font-medium">Total Claims</div>
                <div className="text-xs text-slate-500 mt-1">
                  {stats.paidClaims} paid • {stats.rejectedClaims} rejected
                </div>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <div className="text-2xl font-bold text-slate-900 mb-1">{formatCurrency(stats.averageClaimAmount)}</div>
                <div className="text-sm text-slate-600 font-medium">Avg Claim Amount</div>
                <div className="text-xs text-slate-500 mt-1">Per claim value</div>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600 mb-1">
                  {formatCurrency(stats.totalPaidAmount)}
                </div>
                <div className="text-sm text-slate-600 font-medium">Collected Revenue</div>
                <div className="text-xs text-slate-500 mt-1">For Claim Paid status</div>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <div className="text-2xl font-bold text-slate-900 mb-1">
                  {stats.highValueClaimsPercentage ? formatPercentage(stats.highValueClaimsPercentage) : 'N/A'}
                </div>
                <div className="text-sm text-slate-600 font-medium">High Value Claims</div>
                <div className="text-xs text-slate-500 mt-1">&gt;₹1L claims</div>
              </div>
            </div>
          </div>

          {/* Operational Metrics */}
          {!hasOnlyRGHSData && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">Operational Performance</h3>
                {scheme === 'multi_payer' && (
                  <DataSourceIndicator
                    availablePayers={['MAA Yojana']}
                    scheme={scheme}
                    variant="compact"
                  />
                )}
              </div>
              {!hasMAAData && scheme === 'multi_payer' ? (
                <div className="text-center py-8 text-gray-500">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-sm">Operational metrics not available for RGHS</p>
                  <p className="text-xs mt-1">Select MAA Yojana in the payer filter to view these metrics</p>
                </div>
              ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-amber-600 mb-1">
                    {formatPercentage(stats.queryIncidence)}
                  </div>
                  <div className="text-sm text-slate-600 font-medium">Query Incidence</div>
                  <div className="text-xs text-slate-500 mt-1">Claims with queries raised</div>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600 mb-1">
                    {stats.queryCausedDelay ? formatDelayDifference(stats.queryCausedDelay) : 'N/A'}
                  </div>
                  <div className="text-sm text-slate-600 font-medium">Avg Query Delay</div>
                  <div className="text-xs text-slate-500 mt-1">Extra delay vs no query</div>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-900 mb-1">
                    {stats.avgDischargeToPaymentDays === null ? 'N/A' : formatDays(stats.avgDischargeToPaymentDays)}
                  </div>
                  <div className="text-sm text-slate-600 font-medium">Avg Processing Time</div>
                  <div className="text-xs text-slate-500 mt-1">Discharge to payment</div>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-900 mb-1">
                    {stats.avgLengthOfStay ? formatDays(stats.avgLengthOfStay) : 'N/A'}
                  </div>
                  <div className="text-sm text-slate-600 font-medium">Avg Length of Stay</div>
                  <div className="text-xs text-slate-500 mt-1">Patient stay duration</div>
                </div>
              </div>
              )}
            </div>
          )}

          {/* Performance Summary - Concrete Metrics */}
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900">Key Performance Indicators</h3>
              {scheme === 'multi_payer' && stats.firstPassRate !== null && (
                <DataSourceIndicator
                  availablePayers={['MAA Yojana']}
                  scheme={scheme}
                  variant="compact"
                />
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scheme !== 'rghs' && stats.firstPassRate !== null && stats.firstPassRate !== undefined && hasMAAData && (
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className={`text-2xl font-bold ${stats.firstPassRate <= 60 ? 'text-red-600' : stats.firstPassRate <= 70 ? 'text-amber-600' : 'text-green-600'}`}>
                    {stats.firstPassRate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600 font-medium">First-Pass Rate</div>
                  <div className="text-xs text-gray-500 mt-1">Target: &gt;70%</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {formatNumber(Math.round((stats.firstPassRate / 100) * stats.totalClaims))} clean claims
                  </div>
                </div>
              )}
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className={`text-2xl font-bold ${stats.denialRate > 5 ? 'text-red-600' : stats.denialRate > 2 ? 'text-amber-600' : 'text-green-600'}`}>
                  {stats.denialRate != null ? stats.denialRate.toFixed(1) : '0.0'}%
                </div>
                <div className="text-sm text-gray-600 font-medium">Denial Rate</div>
                <div className="text-xs text-gray-500 mt-1">Target: &lt;2%</div>
                <div className="text-xs text-gray-500 mt-1">
                  {formatNumber(Math.round((stats.denialRate / 100) * stats.totalClaims))} denied claims
                </div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className={`text-2xl font-bold ${stats.collectionEfficiency <= 70 ? 'text-red-600' : stats.collectionEfficiency <= 85 ? 'text-amber-600' : 'text-green-600'}`}>
                  {stats.collectionEfficiency != null ? stats.collectionEfficiency.toFixed(1) : '0.0'}%
                </div>
                <div className="text-sm text-gray-600 font-medium">Collection Rate</div>
                <div className="text-xs text-gray-500 mt-1">Target: &gt;85%</div>
                <div className="text-xs text-gray-500 mt-1">
                  {formatCurrency(stats.totalPaidAmount)} collected
                </div>
              </div>
              {scheme === 'rghs' && (
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className={`text-2xl font-bold ${
                    stats.avgLengthOfStay > 5 ? 'text-red-600' :
                    stats.avgLengthOfStay > 3 ? 'text-amber-600' :
                    'text-green-600'
                  }`}>
                    {stats.avgLengthOfStay ? formatDays(stats.avgLengthOfStay) : 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600 font-medium">Avg Length of Stay</div>
                  <div className="text-xs text-gray-500 mt-1">Patient stay duration</div>
                </div>
              )}
            </div>
          </div>

          {scheme === 'rghs' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">Claim vs. Approved vs. Paid Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="text-2xl font-bold text-blue-600">{formatCurrency(stats.totalClaimValue)}</div>
                  <div className="text-sm text-gray-600 font-medium">Hospital Claimed</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-100">
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalCUApproved)}</div>
                  <div className="text-sm text-gray-600 font-medium">CU Approved</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-100">
                  <div className="text-2xl font-bold text-purple-600">{formatCurrency(stats.totalPaidAmount)}</div>
                  <div className="text-sm text-gray-600 font-medium">Paid Amount</div>
                  <div className="text-xs text-gray-500">(includes 10% TDS)</div>
                </div>
              </div>
            </div>
          )}

          {/* Specialty Performance Analysis - Grouped metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Medical Specialties by Volume */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">Top Medical Specialties by Volume</h3>
              <div className="h-80">
                <CustomBarChart
                  data={chartData.topSpecialties?.slice(0, 6) || []}
                  bars={[{ dataKey: 'claims', name: 'Claims Count', color: '#2a5eb4' }]}
                  xAxisKey="specialty"
                  yAxisFormatter={(value) => formatNumber(value)}
                  tooltipFormatter={(value) => [formatNumber(value), 'Claims']}
                />
              </div>
            </div>

            {/* Revenue by Top Specialties */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">Revenue by Top Specialties</h3>
              <div className="h-80">
                <CustomBarChart
                  data={chartData.topSpecialties?.slice(0, 6) || []}
                  bars={[{ dataKey: 'amount', name: 'Revenue (₹)', color: '#1e4a8c' }]}
                  xAxisKey="specialty"
                  yAxisFormatter={(value) => `₹${value != null ? (value / 1000000).toFixed(1) : '0.0'}M`}
                  tooltipFormatter={(value) => [formatCurrency(value), 'Revenue']}
                />
              </div>
            </div>
          </div>

          {/* Claims Trend Over Time */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-4">Claims Trend Over Time</h3>
            <div className="h-80">
              <CustomLineChart
                data={chartData.monthlyTrends || []}
                lines={[
                  { dataKey: 'claims', name: 'Number of Claims', color: '#2a5eb4', yAxisId: 'left' },
                  { dataKey: 'amount', name: 'Total Amount (₹)', color: '#1e4a8c', yAxisId: 'right' }
                ]}
                xAxisKey="month"
                yAxisFormatter={(value) => formatNumber(value)}
                secondaryYAxisFormatter={(value) => `₹${value != null ? (value / 1000000).toFixed(1) : '0.0'}M`}
                tooltipFormatter={(value, name) => [
                  name === 'Total Amount (₹)' ? formatCurrency(value) : formatNumber(value), 
                  name
                ]}
                enableSecondaryAxis={true}
                smooth={true}
              />
            </div>
          </div>

          {!hasOnlyRGHSData && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">Top Districts by Claims Volume</h3>
                {scheme === 'multi_payer' && (
                  <DataSourceIndicator
                    availablePayers={['MAA Yojana']}
                    scheme={scheme}
                    variant="compact"
                  />
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {(chartData.topDistricts?.slice(0, 10) || []).map((district, index) => (
                  <div 
                    key={district.district} 
                    className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100 cursor-pointer hover:shadow-md hover:bg-slate-100 transition-all"
                    onClick={() => handleDrillDown('district', 
                      row => row['District Name'] === district.district, 
                      `Top Cases from ${district.district} District`
                    )}
                  >
                    <div className="text-lg font-bold text-slate-900">{formatNumber(district.count)}</div>
                    <div className="text-sm text-slate-600 truncate">{district.district}</div>
                    <Eye className="w-3 h-3 text-slate-400 mx-auto mt-1" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Patient Demographics */}
          {!hasOnlyRGHSData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center relative">
                {scheme === 'multi_payer' && (
                  <div className="absolute top-2 right-2">
                    <DataSourceIndicator
                      availablePayers={['MAA Yojana']}
                      scheme={scheme}
                      variant="compact"
                      className="text-xs"
                    />
                  </div>
                )}
                <div className="text-2xl font-bold text-slate-900">{chartData.genderDistribution?.find(g => g.gender === 'Male' || g.gender === 'M')?.count || 0}</div>
                <div className="text-sm text-slate-600">Male Patients</div>
                <div className="text-xs text-slate-500">{chartData.genderDistribution?.find(g => g.gender === 'Male' || g.gender === 'M')?.percentage || 0}%</div>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center relative">
                {scheme === 'multi_payer' && (
                  <div className="absolute top-2 right-2">
                    <DataSourceIndicator
                      availablePayers={['MAA Yojana']}
                      scheme={scheme}
                      variant="compact"
                      className="text-xs"
                    />
                  </div>
                )}
                <div className="text-2xl font-bold text-slate-900">{chartData.genderDistribution?.find(g => g.gender === 'Female' || g.gender === 'F')?.count || 0}</div>
                <div className="text-sm text-slate-600">Female Patients</div>
                <div className="text-xs text-slate-500">{chartData.genderDistribution?.find(g => g.gender === 'Female' || g.gender === 'F')?.percentage || 0}%</div>
              </div>
            </div>
          )}

          {/* Demographics Charts */}
          {!hasOnlyRGHSData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">Gender Distribution</h3>
                {scheme === 'multi_payer' && (
                  <DataSourceIndicator
                    availablePayers={['MAA Yojana']}
                    scheme={scheme}
                    variant="compact"
                  />
                )}
              </div>
              <div className="h-72">
                <CustomPieChart
                  data={chartData.genderDistribution || []}
                  dataKey="count"
                  nameKey="gender"
                  colors={['#2a5eb4', '#1e4a8c', '#3b82f6']}
                />
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">Claims Status Distribution</h3>
              <div className="h-72">
                <CustomBarChart
                  data={chartData.statusWiseRevenue || []}
                  bars={[{ dataKey: 'count', name: 'Claims Count', color: '#2a5eb4' }]}
                  xAxisKey="status"
                  layout="horizontal"
                  yAxisFormatter={(value) => formatNumber(value)}
                  tooltipFormatter={(value) => [formatNumber(value), 'Claims']}
                />
              </div>
            </div>
          </div>
          )}

          {/* Key Insights */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Key Insights
            </h3>
            <div className="space-y-3 text-sm text-slate-700">
              <p>
                • Revenue at risk: <strong>{formatCurrency(stats.revenueLeakage)}</strong> lost due to rejections{' '}
                ({formatPercentage(stats.revenueLeakageRate)} of total claims value)
              </p>
              <p>
                • Outstanding collections opportunity: <strong>{formatCurrency(stats.approvedUnpaidAmount)}</strong>{' '}
                in approved claims awaiting payment
              </p>
              {stats.revenueStuckInQuery > 0 && (
                <p>
                  • Currently <strong>{formatCurrency(stats.revenueStuckInQuery)}</strong> is stuck in query/pending status,{' '}
                  requiring immediate documentation and follow-up
                </p>
              )}
            </div>
          </div>

        </>
      )}


      {activeTab === 'insights' && (
        <>
          {(scheme !== 'rghs' && scheme !== 'multi_payer') && (
            <QueryImpactAnalysis 
              data={filteredData} 
              stats={stats} 
              onDrillDown={handleDrillDown} 
              scheme={scheme} 
              identifiedPayers={identifiedPayers}
            />
          )}
          {scheme === 'multi_payer' && !hasOnlyRGHSData && (
            <QueryImpactAnalysis 
              data={filteredData} 
              stats={stats} 
              onDrillDown={handleDrillDown} 
              scheme={scheme} 
              identifiedPayers={identifiedPayers}
            />
          )}
          <SpecialtyPerformanceAnalysis 
            data={filteredData} 
            scheme={scheme} 
            identifiedPayers={identifiedPayers}
          />
        </>
      )}

      {activeTab === 'roi' && (
        <>
          <ROICalculator stats={roiStats} />
        </>
      )}


      {/* Drill Down Table */}
      <DrillDownTable
        data={drillDownData.data}
        title={drillDownData.title}
        isOpen={drillDownData.isOpen}
        onClose={closeDrillDown}
        type={drillDownData.type}
        scheme={drillDownData.scheme}
      />
    </div>
  );
};

export default Dashboard;