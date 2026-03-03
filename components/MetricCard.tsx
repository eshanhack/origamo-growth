"use client";

import clsx from "clsx";
import { fmtGrowth, growthColor } from "@/lib/format";

interface MetricCardProps {
  label: string;
  value: string;
  growth: number | null;
  icon?: string;
  sub?: string;
}

export default function MetricCard({
  label,
  value,
  growth,
  icon,
  sub,
}: MetricCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          {label}
        </span>
        {icon && <span className="text-xl">{icon}</span>}
      </div>

      <div className="text-2xl font-bold text-white">{value}</div>

      <div className="flex items-center gap-2">
        <span
          className={clsx(
            "text-sm font-semibold",
            growthColor(growth)
          )}
        >
          {fmtGrowth(growth)}
        </span>
        <span className="text-xs text-gray-500">MoM</span>
      </div>

      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}
