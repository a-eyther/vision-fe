import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

const CustomPieChart = ({
  data,
  dataKey,
  nameKey,
  colors = ["#2a5eb4", "#1e4a8c", "#3b82f6", "#60a5fa", "#93c5fd", "#06b6d4", "#84cc16", "#a855f7"],
  showLegend = true,
  innerRadius = 0,
  outerRadius = 80,
}) => {
  const renderTooltipContent = (props) => {
    const { payload, active } = props;

    if (!active || !payload || payload.length === 0) {
      return null;
    }

    const data = payload[0].payload;
    return (
      <div className="bg-white p-2 border border-gray-200 shadow-md text-xs">
        <p className="font-bold">{data[nameKey]}</p>
        <p className="text-gray-600">
          Count: <span className="font-semibold">{data[dataKey]}</span>
        </p>
        {data.percentage && (
          <p className="text-gray-600">
            Percentage: <span className="font-semibold">{data.percentage}%</span>
          </p>
        )}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={2}
          dataKey={dataKey}
          nameKey={nameKey}
        >
          {data.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={colors[index % colors.length]} 
            />
          ))}
        </Pie>
        <Tooltip content={renderTooltipContent} />
        {showLegend && (
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            wrapperStyle={{ fontSize: "12px" }}
          />
        )}
      </PieChart>
    </ResponsiveContainer>
  );
};

export default CustomPieChart;