import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const CustomBarChart = ({
  data,
  bars,
  xAxisKey,
  yAxisFormatter = (value) => value,
  tooltipFormatter = (value) => [value, ""],
  grid = true,
  layout = "horizontal",
  barSize = 30,
  stackId = null,
}) => {
  // Eyther blue color palette
  const colors = ["#2a5eb4", "#1e4a8c", "#3b82f6", "#60a5fa", "#93c5fd"];

  const getBarColor = (index) => colors[index % colors.length];

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
                className="w-2 h-2 inline-block mr-1"
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
      <BarChart
        data={data}
        layout={layout}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        {grid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
        <XAxis
          dataKey={xAxisKey}
          type={layout === "vertical" ? "category" : "category"}
          tick={{ fontSize: 12 }}
          style={{ fontSize: "12px" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <YAxis
          tickFormatter={yAxisFormatter}
          type={layout === "vertical" ? "number" : "number"}
          tick={{ fontSize: 12 }}
          style={{ fontSize: "12px" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <Tooltip content={renderTooltipContent} />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
        />

        {bars.map((bar, index) => (
          <Bar
            key={bar.dataKey}
            dataKey={bar.dataKey}
            name={bar.name}
            fill={bar.color || getBarColor(index)}
            stackId={stackId}
            barSize={barSize}
            radius={layout === "horizontal" ? [4, 4, 0, 0] : [0, 4, 4, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

export default CustomBarChart;