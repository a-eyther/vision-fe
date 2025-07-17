import { useMemo } from 'react';
import { Clock, AlertTriangle, TrendingDown, BarChart3 } from 'lucide-react';
import CustomBarChart from '../charts/BarChart';
import { preprocessHospitalData, groupDataByTID, parseDate } from '../../utils/dataProcessor';
import { formatCurrency, formatNumber, formatPercentage, formatDays, formatDelayDifference } from '../../utils/formatters';
import DataSourceIndicator from '../ui/DataSourceIndicator';

const QueryImpactAnalysis = ({ data, stats, onDrillDown, scheme, identifiedPayers = [] }) => {
  const queryImpactData = useMemo(() => {
    let claimsData;
    
    if (scheme === 'multi_payer') {
      // For multi-payer mode, filter for MAA Yojana only and convert from SDS format
      const maaData = Array.isArray(data) ? data.filter(row => row.payerName === 'MAA Yojana') : [];
      // Convert SDS format to MAA format for proper field mapping
      claimsData = maaData.map(row => ({
        'TID': row.claimId,
        'Patient Name': row.patientName,
        'Hospital Name': row.hospitalName,
        'Date of Admission': row.serviceDate,
        'Date of Discharge': row.dischargeDate,
        'Status': row.status,
        'Pkg Rate': row.claimedAmount,
        'Approved Amount': row.approvedAmount,
        'Query Raised': row.queryRaised || 0,
        'Days to Payment': row.daysToPayment || 0,
        'Payment Date': row.paymentDate,
        'Pkg Speciality Name': row.specialty || 'Unknown'
      }));
    } else if (scheme === 'rghs' && data.tmsData) {
      claimsData = data.tmsData;
    } else {
      claimsData = data;
    }
    if (!claimsData || claimsData.length === 0) return [];

    // Process and group data by TID first
    const processedData = preprocessHospitalData(claimsData);
    const groupedData = groupDataByTID(processedData);

    // Group by query count and analyze impact using grouped data
    const queryAnalysis = groupedData.reduce((acc, row) => {
      const queries = parseInt(row['Query Raised']) || 0;
      const status = row['Status'] || '';
      
      // Calculate days to payment from discharge to payment date
      let daysToPayment = 0;
      if (status.includes('Claim Paid')) {
        const discharge = row['Date of Discharge'];
        const payment = row['Payment Date'];
        if (discharge && payment) {
          const dischargeDate = parseDate(discharge);
          const paymentDate = parseDate(payment);
          if (dischargeDate && paymentDate) {
            daysToPayment = Math.max(0, (paymentDate - dischargeDate) / (1000 * 60 * 60 * 24));
          }
        }
      }
      
      const approvedAmount = parseFloat(row['Approved Amount']) || 0;

      if (!acc[queries]) {
        acc[queries] = {
          queries,
          claims: 0,
          denials: 0,
          totalDaysToPayment: 0,
          claimsWithDays: 0,
          totalApprovedAmount: 0
        };
      }

      acc[queries].claims += 1;
      acc[queries].totalApprovedAmount += approvedAmount;

      if (status.toLowerCase().includes('rejected') || status.toLowerCase().includes('deny')) {
        acc[queries].denials += 1;
      }

      if (daysToPayment > 0) {
        acc[queries].totalDaysToPayment += daysToPayment;
        acc[queries].claimsWithDays += 1;
      }

      return acc;
    }, {});

    // Convert to array and calculate metrics
    return Object.values(queryAnalysis).map(item => ({
      ...item,
      denialRate: item.claims > 0 ? (item.denials / item.claims) * 100 : 0,
      avgDaysToPayment: item.claimsWithDays > 0 ? Math.min(item.totalDaysToPayment / item.claimsWithDays, 365) : 0, // Cap at 365 days
      avgApprovedAmount: item.claims > 0 ? Math.min(item.totalApprovedAmount / item.claims, 5000000) : 0 // Cap at 50L
    })).sort((a, b) => a.queries - b.queries);
  }, [data]);

  const processingTimeImpact = useMemo(() => {
    if (!queryImpactData.length) return null;

    const noQueryData = queryImpactData.find(item => item.queries === 0);
    const withQueryData = queryImpactData.filter(item => item.queries > 0);

    if (!noQueryData || !withQueryData.length) return null;

    const avgWithQuery = withQueryData.reduce((sum, item, _, arr) => 
      sum + item.avgDaysToPayment / arr.length, 0
    );

    const timeIncrease = noQueryData.avgDaysToPayment > 0 
      ? ((avgWithQuery - noQueryData.avgDaysToPayment) / noQueryData.avgDaysToPayment) * 100 
      : 0;

    return {
      noQueryAvg: noQueryData.avgDaysToPayment,
      withQueryAvg: avgWithQuery,
      timeIncrease
    };
  }, [queryImpactData]);


  if (!data || !stats) return null;

  const availablePayers = scheme === 'multi_payer' ? 
    identifiedPayers.filter(payer => payer === 'MAA Yojana') : 
    [scheme === 'rghs' ? 'RGHS' : 'MAA Yojana'];

  const hasRequiredData = availablePayers.includes('MAA Yojana');

  if (!hasRequiredData && scheme === 'multi_payer') {
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center mb-6">
          <div className="p-2 bg-amber-50 rounded-lg mr-3">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-slate-900">Query Impact Analysis</h3>
            <p className="text-slate-600">How queries affect claim processing and outcomes</p>
          </div>
        </div>
        <DataSourceIndicator
          availablePayers={identifiedPayers}
          supportedPayers={['MAA Yojana']}
          scheme={scheme}
          variant="banner"
        />
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="p-2 bg-amber-50 rounded-lg mr-3">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Query Impact Analysis</h3>
            <p className="text-slate-600">How queries affect claim processing and outcomes</p>
          </div>
        </div>
        <DataSourceIndicator
          availablePayers={availablePayers}
          scheme={scheme}
          variant="compact"
        />
      </div>

      {/* Key Insights Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-red-50 p-4 rounded-lg text-center border border-red-100">
          <TrendingDown className="w-6 h-6 text-red-600 mx-auto mb-2" />
          <div className="text-xl font-bold text-red-700">
            {formatPercentage(stats.queryIncidence)}
          </div>
          <div className="text-xs text-slate-600">Claims with Queries</div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg text-center border border-green-100">
          <BarChart3 className="w-6 h-6 text-green-600 mx-auto mb-2" />
          <div className="text-xl font-bold text-green-700">
            {formatPercentage(stats.firstPassRate)}
          </div>
          <div className="text-xs text-slate-600">First-Pass Success</div>
        </div>

        <div className="bg-amber-50 p-4 rounded-lg text-center border border-amber-100">
          <Clock className="w-6 h-6 text-amber-600 mx-auto mb-2" />
          <div className="text-xl font-bold text-amber-700">
            {stats.avgDischargeToPaymentDays ? formatDays(stats.avgDischargeToPaymentDays) : 'N/A'}
          </div>
          <div className="text-xs text-slate-600">Avg Days to Payment</div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg text-center border border-blue-100">
          <AlertTriangle className="w-6 h-6 text-blue-600 mx-auto mb-2" />
          <div className="text-xl font-bold text-blue-700">
            {stats.queryCausedDelay ? formatDelayDifference(stats.queryCausedDelay) : 'N/A'}
          </div>
          <div className="text-xs text-slate-600">Extra Delay by Queries</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Query Distribution Chart */}
        <div>
          <h4 className="font-semibold text-slate-900 mb-4">Claims by Query Count</h4>
          <div className="h-64">
            <CustomBarChart
              data={queryImpactData}
              bars={[{ 
                dataKey: 'claims', 
                name: 'Claims', 
                color: '#2a5eb4'
              }]}
              xAxisKey="queries"
              yAxisFormatter={(value) => formatNumber(value)}
              tooltipFormatter={(value) => [formatNumber(value), 'Claims']}
            />
          </div>
        </div>

        {/* Denial Rate by Query Count */}
        <div>
          <h4 className="font-semibold text-slate-900 mb-4">Denial Rate by Query Count</h4>
          <div className="h-64">
            <CustomBarChart
              data={queryImpactData}
              bars={[{ 
                dataKey: 'denialRate', 
                name: 'Denial Rate (%)', 
                color: '#1e4a8c'
              }]}
              xAxisKey="queries"
              yAxisFormatter={(value) => `${value != null ? value.toFixed(1) : '0.0'}%`}
              tooltipFormatter={(value) => [`${value != null ? value.toFixed(1) : '0.0'}%`, 'Denial Rate']}
            />
          </div>
        </div>
      </div>

      {/* Detailed Query Impact Table */}
      <div className="mt-8">
        <h4 className="font-semibold text-slate-900 mb-4">Query Impact Summary</h4>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-slate-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left p-3 font-medium text-slate-700">Queries</th>
                <th className="text-left p-3 font-medium text-slate-700">Claims</th>
                <th className="text-left p-3 font-medium text-slate-700">Avg Days to Payment</th>
                <th className="text-left p-3 font-medium text-slate-700">Denials</th>
                <th className="text-left p-3 font-medium text-slate-700">Denial Rate</th>
                <th className="text-left p-3 font-medium text-slate-700">Avg Claim Value</th>
              </tr>
            </thead>
            <tbody>
              {queryImpactData.map((item, index) => (
                <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-3">
                    <span 
                      className={`px-2 py-1 rounded text-sm font-medium cursor-pointer hover:shadow-md transition-shadow ${
                        item.queries === 0 
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : item.queries === 1
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}
                      onClick={() => onDrillDown && onDrillDown('query', 
                        row => {
                          // Handle both MAA format and SDS format
                          const queryCount = scheme === 'multi_payer' 
                            ? parseInt(row.queryRaised || 0) 
                            : parseInt(row['Query Raised'] || 0);
                          return queryCount === item.queries;
                        },
                        `Claims with ${item.queries === 0 ? 'No' : item.queries} ${item.queries === 1 ? 'Query' : 'Queries'}`
                      )}
                    >
                      {item.queries === 0 ? 'Clean' : `${item.queries} ${item.queries === 1 ? 'Query' : 'Queries'}`}
                    </span>
                  </td>
                  <td className="p-3 font-medium">{formatNumber(item.claims)}</td>
                  <td className="p-3">
                    <span className={item.avgDaysToPayment > 20 ? 'text-red-600' : 'text-slate-600'}>
                      {formatDays(item.avgDaysToPayment)}
                    </span>
                  </td>
                  <td className="p-3">{formatNumber(item.denials)}</td>
                  <td className="p-3">
                    <span className={`font-medium ${
                      item.denialRate > 5 ? 'text-red-600' : 
                      item.denialRate > 2 ? 'text-amber-600' : 'text-green-600'
                    }`}>
                      {formatPercentage(item.denialRate)}
                    </span>
                  </td>
                  <td className="p-3">{formatCurrency(item.avgApprovedAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Key Insights */}
      <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h5 className="font-semibold text-slate-900 mb-2">Key Insights</h5>
        <div className="space-y-2 text-sm text-slate-700">
          <p>
            • <strong>{formatPercentage(stats.firstPassRate)}</strong> of claims pass without queries, 
            indicating <strong>{formatPercentage(100 - stats.firstPassRate)}</strong> room for improvement
          </p>
          {queryImpactData.length > 1 && queryImpactData.find(item => item.queries >= 2) && queryImpactData.find(item => item.queries === 0) && (
            <p>
              • Multiple queries significantly impact denial rates: 
              <strong> {formatPercentage(queryImpactData.find(item => item.queries >= 2)?.denialRate)}</strong> for 2+ queries 
              vs <strong>{formatPercentage(queryImpactData.find(item => item.queries === 0)?.denialRate)}</strong> for clean claims
            </p>
          )}
          {stats.queryCausedDelay && (
            <p>
              • Extra delay caused by queries: <strong>{formatDelayDifference(stats.queryCausedDelay)}</strong> compared to clean claims
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default QueryImpactAnalysis;