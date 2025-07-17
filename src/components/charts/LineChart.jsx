import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const CustomLineChart = ({
  data,
  lines,
  xAxisKey,
  yAxisFormatter = (value) => value,
  secondaryYAxisFormatter = (value) => value,
  tooltipFormatter = (value) => [value, ""],
  grid = true,
  strokeWidth = 2,
  smooth = false,
  enableSecondaryAxis = false,
}) => {
  // Eyther blue color palette
  const colors = ["#2a5eb4", "#1e4a8c", "#3b82f6", "#60a5fa", "#93c5fd"];

  const getLineColor = (index) => colors[index % colors.length];

  const renderTooltipContent = (props) => {
    const { payload, label, active } = props;

    if (!active || !payload || payload.length === 0) {
      return null;
    }

    return (
      <div className="bg-white p-2 border border-gray-200 shadow-md text-xs">
        <p className="font-bold mb-1">{label}</p>
        {payload.map((entry, index) => {
          const [value, name] = tooltipFormatter(entry.value, entry.name);
          return (
            <p
              key={index}
              style={{ color: entry.color }}
              className="flex items-center"
            >
              <span
                className="w-2 h-2 inline-block mr-1 rounded-full"
                style={{ backgroundColor: entry.color }}
              ></span>
              <span className="mr-1">{name || entry.name}: </span>
              <span className="font-semibold">{value}</span>
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        {grid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
        <XAxis
          dataKey={xAxisKey}
          tick={{ fontSize: 12 }}
          style={{ fontSize: "12px" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <YAxis
          yAxisId="left"
          tickFormatter={yAxisFormatter}
          tick={{ fontSize: 12 }}
          style={{ fontSize: "12px" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        {enableSecondaryAxis && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={secondaryYAxisFormatter}
            tick={{ fontSize: 12 }}
            style={{ fontSize: "12px" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
          />
        )}
        <Tooltip content={renderTooltipContent} />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
        />

        {lines.map((line, index) => (
          <Line
            key={line.dataKey}
            dataKey={line.dataKey}
            name={line.name}
            stroke={line.color || getLineColor(index)}
            strokeWidth={strokeWidth}
            dot={{ fill: line.color || getLineColor(index), strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
            yAxisId={line.yAxisId || (enableSecondaryAxis && index > 0 ? "right" : "left")}
            type={smooth ? "monotone" : "linear"}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

export default CustomLineChart;