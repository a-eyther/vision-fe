import { ArrowUp } from "lucide-react";

const StatCard = ({
  title,
  value,
  subtitle,
  trend = 0,
  trendLabel,
  trendType = "percentage",
  valuePrefix = "",
  icon,
  color = "blue"
}) => {
  const getTrendColor = () => {
    if (trend > 0) return "text-green-500";
    if (trend < 0) return "text-red-500";
    return "text-gray-500";
  };

  const formattedTrend = () => {
    return trend > 0 ? `+${trend}` : trend;
  };

  const getColorClasses = () => {
    const colorMap = {
      blue: "text-blue-600 bg-blue-50",
      green: "text-green-600 bg-green-50",
      yellow: "text-yellow-600 bg-yellow-50",
      red: "text-red-600 bg-red-50",
      purple: "text-purple-600 bg-purple-50",
    };
    return colorMap[color] || colorMap.blue;
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-gray-600 font-medium mb-2">{title}</h3>
          
          <div className="text-3xl font-bold mb-4 text-gray-900">
            {value === null || value === undefined ? (
              <span className="text-lg text-gray-400">Data not available</span>
            ) : (
              <>
                {valuePrefix}
                {typeof value === 'number' ? value.toLocaleString() : value}
              </>
            )}
          </div>

          {trend !== 0 && (
            <div className={`flex items-center ${getTrendColor()}`}>
              <ArrowUp
                className={`w-4 h-4 mr-1 ${
                  trend < 0 ? "transform rotate-180" : ""
                }`}
              />
              <span className="text-sm font-medium">
                {trendType === "percentage"
                  ? `${formattedTrend()}%`
                  : formattedTrend()}{" "}
                {trendLabel}
              </span>
            </div>
          )}

          {subtitle && (
            <div className="text-sm text-gray-500 mt-1">{subtitle}</div>
          )}
        </div>
        
        {icon && (
          <div className={`p-3 rounded-lg ${getColorClasses()}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;