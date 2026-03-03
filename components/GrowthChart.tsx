"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { MonthlyDataWithGrowth } from "@/lib/types";
import { fmt } from "@/lib/format";

type MetricKey = "ggr" | "fees" | "wager" | "mau" | "betsPlaced";

interface Props {
  data: MonthlyDataWithGrowth[];
  metric: MetricKey;
  title: string;
  color: string;
  valueStyle?: "currency" | "number" | "compact";
}

const AXIS_STYLE = { fill: "#6b7280", fontSize: 11 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label, valueStyle }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl text-xs">
      <p className="text-gray-300 font-semibold mb-2">{label}</p>
      {payload.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (entry: any) => (
          <p key={entry.name} style={{ color: entry.color }}>
            {entry.name}:{" "}
            {entry.name === "MoM%"
              ? `${entry.value?.toFixed(1)}%`
              : fmt(entry.value, valueStyle ?? "number")}
          </p>
        )
      )}
    </div>
  );
};

export default function GrowthChart({
  data,
  metric,
  title,
  color,
  valueStyle = "number",
}: Props) {
  const chartData = data.map((d) => ({
    label: d.label,
    value: d[metric] as number,
    mom: d.growth[metric as keyof typeof d.growth],
  }));

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
          <YAxis
            yAxisId="left"
            tick={AXIS_STYLE}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => fmt(v, valueStyle === "currency" ? "compact" : "compact")}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={AXIS_STYLE}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v?.toFixed(0)}%`}
          />
          <Tooltip
            content={<CustomTooltip valueStyle={valueStyle} />}
          />
          <Legend
            wrapperStyle={{ fontSize: "11px", color: "#9ca3af" }}
          />
          <Bar
            yAxisId="left"
            dataKey="value"
            name={title}
            fill={color}
            opacity={0.85}
            radius={[3, 3, 0, 0]}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="mom"
            name="MoM%"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ r: 3, fill: "#f59e0b" }}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
