"use client";

import clsx from "clsx";
import { fmtGrowth } from "@/lib/format";

interface MetricCardProps {
  label: string;
  value: string;
  growth: number | null;
  icon?: string;
  sub?: string;
  /** When true, replaces the value with the period-change % and hides sub/badge */
  growthMode?: boolean;
  /** Label shown next to the growth badge, e.g. "MoM" or "QoQ" */
  changeLabel?: string;
}

export default function MetricCard({
  label,
  value,
  growth,
  sub,
  growthMode = false,
  changeLabel = "MoM",
}: MetricCardProps) {
  const positive = growth !== null && growth >= 0;
  const negative = growth !== null && growth < 0;

  return (
    <div className="relative bg-[#111111] border border-gray-700/50 rounded-xl p-5 flex flex-col gap-3 overflow-hidden">
      {/* Lime top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#CCFF00] rounded-t-xl" />

      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 pt-1">
        {label}
      </span>

      {/* Value — or growth % when in growthMode */}
      <div
        className={clsx(
          "text-[28px] font-bold tracking-tight leading-none transition-all duration-200",
          growthMode
            ? positive ? "text-emerald-400" : negative ? "text-red-400" : "text-gray-500"
            : "text-white"
        )}
      >
        {growthMode ? fmtGrowth(growth) : value}
      </div>

      {/* MoM badge — hidden in growthMode (value already IS the growth) */}
      {!growthMode && (
        <div className="flex items-center gap-2 mt-auto">
          <span
            className={clsx(
              "inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full",
              positive && "bg-[#CCFF00]/10 text-[#CCFF00] ring-1 ring-[#CCFF00]/20",
              negative && "bg-red-500/10 text-red-400 ring-1 ring-red-500/20",
              !positive && !negative && "bg-gray-800 text-gray-500"
            )}
          >
            {fmtGrowth(growth)}
          </span>
          <span className="text-[11px] text-gray-600">{changeLabel}</span>
        </div>
      )}

      {/* Sub text — hidden in growthMode */}
      {!growthMode && sub && (
        <div className="text-[11px] text-gray-600 truncate">{sub}</div>
      )}

      {/* growthMode label */}
      {growthMode && (
        <div className="text-[11px] text-gray-600 mt-auto">{changeLabel}</div>
      )}
    </div>
  );
}
