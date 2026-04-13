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
  Cell,
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
  const incomplete = payload[0]?.payload?.isIncomplete;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl text-xs">
      <p className="text-gray-300 font-semibold mb-2">
        {label}
        {incomplete && (
          <span className="ml-1.5 text-[9px] uppercase tracking-wider text-amber-400">
            · in progress
          </span>
        )}
      </p>
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
      {incomplete && (
        <p className="text-amber-400/80 text-[10px] mt-1.5 pt-1.5 border-t border-gray-800">
          Period still in progress — partial data
        </p>
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
  const chartData = data.map((d, i) => ({
    label: d.label,
    value: d[metric] as number,
    // Skip MoM% for the first two points: index 0 has no previous month
    // so it's already null, and index 1's MoM compares against a small
    // baseline which produces an absurdly high % that skews the axis.
    mom: i <= 1 ? null : d.growth[metric as keyof typeof d.growth],
    isIncomplete: !!d.isIncomplete,
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
          >
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.isIncomplete ? "transparent" : color}
                stroke={entry.isIncomplete ? color : undefined}
                strokeWidth={entry.isIncomplete ? 1.5 : 0}
                strokeDasharray={entry.isIncomplete ? "4 3" : undefined}
              />
            ))}
          </Bar>
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="mom"
            name="MoM%"
            stroke="#f59e0b"
            strokeWidth={2}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dot={(props: any) => {
              const { cx, cy, payload, index } = props;
              if (cx == null || cy == null) return <g key={`dot-${index}`} />;
              return (
                <circle
                  key={`dot-${index}`}
                  cx={cx}
                  cy={cy}
                  r={3}
                  fill={payload?.isIncomplete ? "transparent" : "#f59e0b"}
                  stroke="#f59e0b"
                  strokeWidth={payload?.isIncomplete ? 1.5 : 0}
                  strokeDasharray={payload?.isIncomplete ? "2 2" : undefined}
                />
              );
            }}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
