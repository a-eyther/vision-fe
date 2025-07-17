import { useMemo } from 'react';
import { Activity, TrendingDown, AlertCircle, DollarSign } from 'lucide-react';
import CustomBarChart from '../charts/BarChart';
import DataSourceIndicator from '../ui/DataSourceIndicator';

const SpecialtyPerformanceAnalysis = ({ data, scheme, identifiedPayers = [] }) => {
  const specialtyAnalysis = useMemo(() => {
    let claimsData;
    
    if (scheme === 'multi_payer') {
      // For multi-payer mode, exclude payment tracker data as it doesn't have specialty info
      claimsData = Array.isArray(data) ? data.filter(row => row.payerName !== 'RGHS Payment Tracker') : [];
    } else if (scheme === 'rghs' && data.tmsData) {
      claimsData = data.tmsData;
    } else {
      claimsData = data;
    }
    if (!claimsData || claimsData.length === 0) return [];

    // Group by specialty and analyze performance
    const specialtyData = claimsData.reduce((acc, row) => {
      let specialty, status, queries, pkgRate, approvedAmount;
      
      if (scheme === 'multi_payer') {
        // Handle multi-payer data using SDS format
        specialty = row.specialty || row.packageName || row['DEPARTMENT'] || row['Pkg Speciality Name'] || 'Unknown';
        status = row.status || '';
        queries = row.payerName === 'MAA Yojana' ? (parseFloat(row['Query Raised']) || 0) : 0;
        pkgRate = row.claimedAmount || 0;
        approvedAmount = row.approvedAmount || 0;
      } else if (scheme === 'rghs') {
        specialty = row['DEPARTMENT'] || 'Unknown';
        status = row['STATUS'] || '';
        queries = 0; // RGHS data doesn't have query count
        pkgRate = parseFloat(row['HOSPITALCLAIMAMOUNT']) || 0;
        approvedAmount = parseFloat(row['CUAPPROVEDAMOUNT']) || 0;
      } else {
        // MAA Yojana
        specialty = row['Pkg Speciality Name'] || 'Unknown';
        status = row['Status'] || '';
        queries = parseFloat(row['Query Raised']) || 0;
        pkgRate = parseFloat(row['Pkg Rate']) || 0;
        approvedAmount = parseFloat(row['Approved Amount']) || 0;
      }

      if (!acc[specialty]) {
        acc[specialty] = {
          specialty,
          totalClaims: 0,
          queryRaised: 0,
          rejections: 0,
          pkgRate: 0,
          approvedAmount: 0,
          queries: []
        };
      }

      acc[specialty].totalClaims += 1;
      acc[specialty].pkgRate += pkgRate;
      acc[specialty].approvedAmount += approvedAmount;
      acc[specialty].queries.push(queries);

      if (queries > 0) {
        acc[specialty].queryRaised += 1;
      }

      if (status.toLowerCase().includes('reject')) {
        acc[specialty].rejections += 1;
      }

      return acc;
    }, {});

    // Convert to array and calculate metrics
    const analysis = Object.values(specialtyData).map(item => {
      const queryRate = item.totalClaims > 0 && scheme === 'maa_yojna' ? (item.queryRaised / item.totalClaims) * 100 : 0;
      const denialRate = item.totalClaims > 0 ? (item.rejections / item.totalClaims) * 100 : 0;
      const revenueImpact = item.pkgRate;
      const avgClaimValue = item.totalClaims > 0 ? item.approvedAmount / item.totalClaims : 0;
      
      // Calculate risk score (higher is worse)
      const riskScore = (denialRate * 0.6) + (queryRate * 0.4);
      
      return {
        ...item,
        queryRate,
        denialRate,
        revenueImpact,
        avgClaimValue,
        riskScore
      };
    });

    // Filter for specialties with reasonable volume (≥10 claims) and sort by total claims
    return analysis.filter(item => item.totalClaims >= 10).sort((a, b) => b.totalClaims - a.totalClaims);
  }, [data]);

  const topProblemAreas = useMemo(() => {
    return {
      highestRejection: [...specialtyAnalysis]
        .sort((a, b) => b.denialRate - a.denialRate)
        .slice(0, 5),
      highestQuery: [...specialtyAnalysis]
        .sort((a, b) => b.queryRate - a.queryRate)
        .slice(0, 5),
      highestRevenueImpact: [...specialtyAnalysis]
        .sort((a, b) => b.revenueImpact - a.revenueImpact)
        .slice(0, 5),
      highestRisk: [...specialtyAnalysis]
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 5)
    };
  }, [specialtyAnalysis]);

  const formatNumber = (value) => {
    return new Intl.NumberFormat('en-IN').format(value);
  };

  const formatCurrency = (value) => {
    if (!isFinite(value) || value === 0) return '—';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatCrores = (value) => {
    if (!isFinite(value) || value === 0) return '—';
    return `₹${(value / 10000000).toFixed(2)} Cr`;
  };

  const getRiskColor = (riskScore) => {
    if (riskScore > 20) return 'text-[#F04342]';
    if (riskScore > 10) return 'text-[#FFAA00]';
    return 'text-[#23C55E]';
  };

  const getRiskBgColor = (riskScore) => {
    if (riskScore > 20) return 'bg-[#F04342] bg-opacity-10';
    if (riskScore > 10) return 'bg-[#FFAA00] bg-opacity-10';
    return 'bg-[#23C55E] bg-opacity-10';
  };

  if (!data || specialtyAnalysis.length === 0) return null;

  const availablePayers = scheme === 'multi_payer' ? identifiedPayers : [scheme === 'rghs' ? 'RGHS' : 'MAA Yojana'];

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="p-2 bg-purple-50 rounded-lg mr-3">
            <Activity className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Specialty Performance Analysis</h3>
            <p className="text-slate-600">Risk assessment and performance metrics by medical specialty</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className={`grid grid-cols-1 ${scheme === 'maa_yojna' ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4 mb-8`}>
        <div className="bg-slate-50 p-4 rounded-lg text-center border border-slate-100">
          <Activity className="w-6 h-6 text-slate-700 mx-auto mb-2" />
          <div className="text-xl font-bold text-slate-900">
            {specialtyAnalysis.length}
          </div>
          <div className="text-xs text-slate-600">Specialties (≥10 claims)</div>
        </div>

        <div className="bg-red-50 p-4 rounded-lg text-center border border-red-100">
          <TrendingDown className="w-6 h-6 text-red-600 mx-auto mb-2" />
          <div className="text-xl font-bold text-red-700">
            {topProblemAreas.highestRejection[0]?.denialRate != null ? topProblemAreas.highestRejection[0].denialRate.toFixed(1) : '0'}%
          </div>
          <div className="text-xs text-slate-600">Highest Denial Rate</div>
        </div>

        {scheme === 'maa_yojna' && (
          <div className="bg-amber-50 p-4 rounded-lg text-center border border-amber-100">
            <AlertCircle className="w-6 h-6 text-amber-600 mx-auto mb-2" />
            <div className="text-xl font-bold text-amber-700">
              {topProblemAreas.highestQuery[0]?.queryRate != null ? topProblemAreas.highestQuery[0].queryRate.toFixed(1) : '0'}%
            </div>
            <div className="text-xs text-slate-600">Highest Query Rate</div>
          </div>
        )}

        <div className="bg-purple-50 p-4 rounded-lg text-center border border-purple-100">
          <DollarSign className="w-6 h-6 text-purple-600 mx-auto mb-2" />
          <div className="text-xl font-bold text-purple-700">
            {topProblemAreas.highestRevenueImpact[0] ? 
              formatCrores(topProblemAreas.highestRevenueImpact[0].revenueImpact) : '₹0'}
          </div>
          <div className="text-xs text-slate-600">Highest Revenue Impact</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Top Specialties by Volume */}
        <div>
          <h4 className="font-semibold text-slate-900 mb-4">Top Specialties by Volume</h4>
          <div className="h-64">
            <CustomBarChart
              data={specialtyAnalysis.slice(0, 5)}
              bars={[{ 
                dataKey: 'totalClaims', 
                name: 'Total Claims', 
                color: '#475569'
              }]}
              xAxisKey="specialty"
              yAxisFormatter={(value) => formatNumber(value)}
              tooltipFormatter={(value) => [formatNumber(value), 'Total Claims']}
            />
          </div>
        </div>

        {/* Denial Rates by Specialty */}
        <div>
          <h4 className="font-semibold text-slate-900 mb-4">Denial Rates by Specialty</h4>
          <div className="h-64">
            <CustomBarChart
              data={topProblemAreas.highestRejection.slice(0, 5)}
              bars={[{ 
                dataKey: 'denialRate', 
                name: 'Denial Rate (%)', 
                color: '#dc2626'
              }]}
              xAxisKey="specialty"
              yAxisFormatter={(value) => `${value != null ? value.toFixed(1) : '0.0'}%`}
              tooltipFormatter={(value) => [`${value != null ? value.toFixed(1) : '0.0'}%`, 'Denial Rate']}
            />
          </div>
        </div>
      </div>

      {/* Detailed Specialty Performance Table */}
      <div className="mb-6">
        <h4 className="font-semibold text-slate-900 mb-4">Specialty Performance Summary</h4>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-slate-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left p-3 font-medium text-slate-700">Specialty</th>
                <th className="text-left p-3 font-medium text-slate-700">Claims</th>
                {scheme === 'maa_yojna' && <th className="text-left p-3 font-medium text-slate-700">Query Rate</th>}
                <th className="text-left p-3 font-medium text-slate-700">Denial Rate</th>
                <th className="text-left p-3 font-medium text-slate-700">Avg Claim Value</th>
                <th className="text-left p-3 font-medium text-slate-700">Total Revenue</th>
              </tr>
            </thead>
            <tbody>
              {specialtyAnalysis
                .slice(0, 10)
                .map((item, index) => (
                <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-3">
                    <div className="font-medium text-slate-900 max-w-[200px] truncate" title={item.specialty}>
                      {item.specialty}
                    </div>
                  </td>
                  <td className="p-3 font-medium">{formatNumber(item.totalClaims)}</td>
                  {scheme === 'maa_yojna' && (
                    <td className="p-3">
                      <span className={`font-medium ${
                        item.queryRate > 15 ? 'text-red-600' : 
                        item.queryRate > 8 ? 'text-amber-600' : 'text-green-600'
                      }`}>
                        {item.queryRate != null ? item.queryRate.toFixed(1) : '0.0'}%
                      </span>
                    </td>
                  )}
                  <td className="p-3">
                    <span className={`font-medium ${
                      item.denialRate > 15 ? 'text-red-600' : 
                      item.denialRate > 8 ? 'text-amber-600' : 'text-green-600'
                    }`}>
                      {item.denialRate != null ? item.denialRate.toFixed(1) : '0.0'}%
                    </span>
                  </td>
                  <td className="p-3">{formatCurrency(item.avgClaimValue)}</td>
                  <td className="p-3 font-medium">{formatCrores(item.revenueImpact)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Key Problem Areas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Highest Rejection Rates */}
        <div className="bg-red-50 p-4 rounded-lg border border-red-100">
          <h5 className="font-semibold text-slate-900 mb-3 flex items-center">
            <TrendingDown className="w-4 h-4 mr-2 text-red-600" />
            Highest Denial Rates
          </h5>
          <div className="space-y-2">
            {topProblemAreas.highestRejection.slice(0, 3).map((item, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span className="text-slate-700 truncate max-w-[180px]" title={item.specialty}>
                  {item.specialty}
                </span>
                <span className="font-medium text-red-600">
                  {item.denialRate != null ? item.denialRate.toFixed(1) : '0.0'}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Highest Query Rates */}
        {scheme === 'maa_yojna' && (
          <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
            <h5 className="font-semibold text-slate-900 mb-3 flex items-center">
              <AlertCircle className="w-4 h-4 mr-2 text-amber-600" />
              Highest Query Rates
            </h5>
            <div className="space-y-2">
              {topProblemAreas.highestQuery.slice(0, 3).map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-slate-700 truncate max-w-[180px]" title={item.specialty}>
                    {item.specialty}
                  </span>
                  <span className="font-medium text-amber-600">
                    {item.queryRate != null ? item.queryRate.toFixed(1) : '0.0'}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Key Insights */}
      <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h5 className="font-semibold text-slate-900 mb-2">Key Insights</h5>
        <div className="space-y-2 text-sm text-slate-700">
          {topProblemAreas.highestRejection[0] && (
            <p className="font-['Nunito_Sans']">
              • <strong>{topProblemAreas.highestRejection[0].specialty}</strong> has the highest denial rate at{' '}
              <strong>{topProblemAreas.highestRejection[0].denialRate != null ? topProblemAreas.highestRejection[0].denialRate.toFixed(1) : '0'}%</strong> with{' '}
              <strong>{formatCrores(topProblemAreas.highestRejection[0].revenueImpact)}</strong> in revenue
            </p>
          )}
          {specialtyAnalysis[0] && (
            <p className="font-['Nunito_Sans']">
              • <strong>{specialtyAnalysis[0].specialty}</strong> processes the most claims{' '}
              (<strong>{formatNumber(specialtyAnalysis[0].totalClaims)} claims</strong>)
            </p>
          )}
          {scheme === 'maa_yojna' && topProblemAreas.highestQuery[0] && (
            <p className="font-['Nunito_Sans']">
              • <strong>{topProblemAreas.highestQuery[0].specialty}</strong> has the highest query rate at{' '}
              <strong>{topProblemAreas.highestQuery[0].queryRate != null ? topProblemAreas.highestQuery[0].queryRate.toFixed(1) : '0'}%</strong>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpecialtyPerformanceAnalysis;