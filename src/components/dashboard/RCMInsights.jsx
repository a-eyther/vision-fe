import { AlertTriangle, DollarSign, TrendingDown, Target, CheckCircle } from 'lucide-react';

const RCMInsights = ({ insights }) => {
  const getInsightIcon = (type) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <TrendingDown className="w-5 h-5 text-yellow-600" />;
      case 'opportunity':
        return <Target className="w-5 h-5 text-blue-600" />;
      default:
        return <CheckCircle className="w-5 h-5 text-green-600" />;
    }
  };

  const getInsightColors = (type) => {
    switch (type) {
      case 'critical':
        return 'border-red-200 bg-red-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'opportunity':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-green-200 bg-green-50';
    }
  };

  const getImpactBadge = (impact) => {
    const colors = {
      'Critical': 'bg-red-100 text-red-800 border-red-200',
      'High': 'bg-orange-100 text-orange-800 border-orange-200',
      'Medium': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Low': 'bg-blue-100 text-blue-800 border-blue-200'
    };
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${colors[impact] || colors.Low}`}>
        {impact} Impact
      </span>
    );
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  if (!insights || insights.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">RCM Performance Insights</h3>
        <div className="text-center py-8">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <p className="text-gray-600">All metrics are within acceptable ranges.</p>
        </div>
      </div>
    );
  }

  const totalSavings = insights.reduce((sum, insight) => sum + (insight.savings || 0), 0);

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">RCM Performance Insights</h3>
        <div className="text-right">
          <div className="text-sm text-gray-600">Potential Savings</div>
          <div className="text-xl font-bold text-green-600">{formatCurrency(totalSavings)}</div>
        </div>
      </div>

      <div className="space-y-4">
        {insights.map((insight, index) => (
          <div key={index} className={`p-4 rounded-lg border ${getInsightColors(insight.type)}`}>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-1">
                {getInsightIcon(insight.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-900">{insight.title}</h4>
                  {getImpactBadge(insight.impact)}
                </div>
                
                <p className="text-sm text-gray-700 mb-2">{insight.description}</p>
                
                <div className="bg-white bg-opacity-60 p-3 rounded border border-white border-opacity-50">
                  <div className="flex items-start space-x-2">
                    <Target className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-1">Recommendation:</div>
                      <div className="text-xs text-gray-600">{insight.recommendation}</div>
                    </div>
                  </div>
                </div>
                
                {insight.savings > 0 && (
                  <div className="mt-3 flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-700 font-medium">
                      Potential savings: {formatCurrency(insight.savings)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center space-x-2 mb-2">
          <Target className="w-5 h-5 text-blue-600" />
          <h4 className="font-semibold text-blue-900">RCM Solution Benefits</h4>
        </div>
        <p className="text-sm text-blue-800 mb-3">
          Eyther's Revenue Cycle Management solution can address these issues and potentially save 
          <span className="font-bold"> {formatCurrency(totalSavings)}</span> annually.
        </p>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• Automated claim submission and tracking</li>
          <li>• Real-time eligibility verification</li>
          <li>• Clinical documentation improvement</li>
          <li>• Denial management and appeals</li>
          <li>• AI-powered revenue optimization analytics</li>
        </ul>
      </div>
    </div>
  );
};

export default RCMInsights;