import { AlertTriangle, TrendingDown, Activity } from 'lucide-react';

const HealthScoreCard = ({ score, title, subtitle, breakdown = {} }) => {
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (score >= 40) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getScoreIcon = (score) => {
    if (score >= 60) return <Activity className="w-6 h-6" />;
    return <AlertTriangle className="w-6 h-6" />;
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return { label: 'Excellent', desc: 'Outstanding performance' };
    if (score >= 60) return { label: 'Good', desc: 'Room for improvement' };
    if (score >= 40) return { label: 'Poor', desc: 'Needs immediate attention' };
    return { label: 'Critical', desc: 'Urgent RCM intervention required' };
  };

  const scoreInfo = getScoreLabel(score);

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
        </div>
        <div className={`p-2 rounded-lg ${getScoreColor(score)}`}>
          {getScoreIcon(score)}
        </div>
      </div>

      <div className="text-center mb-4">
        <div className="text-3xl font-bold mb-2">
          {score.toFixed(1)}<span className="text-lg text-gray-500">/100</span>
        </div>
        <div className="text-center">
          <span className={`font-medium ${score >= 60 ? 'text-green-600' : score >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
            {scoreInfo.label}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
            score >= 60 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        ></div>
      </div>

      {score < 60 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="w-4 h-4 text-red-600 mr-2" />
            <span className="text-sm font-medium text-red-800">Needs Attention</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthScoreCard;