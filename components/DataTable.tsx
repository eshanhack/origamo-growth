"use client";

import clsx from "clsx";
import { MonthlyDataWithGrowth } from "@/lib/types";
import { fmt, fmtGrowth, growthColor } from "@/lib/format";

interface Props {
  data: MonthlyDataWithGrowth[];
}

function GrowthBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-gray-600">—</span>;
  return (
    <span className={clsx("text-xs font-medium", growthColor(pct))}>
      {fmtGrowth(pct)}
    </span>
  );
}

function SourceBadge({ source }: { source?: string }) {
  if (source === "grafana")
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300 font-medium">
        grafana
      </span>
    );
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 font-medium">
      manual
    </span>
  );
}

export default function DataTable({ data }: Props) {
  const sorted = [...data].reverse(); // newest first

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-gray-300">Historical Data</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800">
              {[
                "Period", "Source",
                "MAU", "Brands",
                "Bets", "Wager", "GGR", "Fees",
                "Edge", "Daily GGR", "Daily Fees",
                "Ann. GGR", "Ann. Fees",
              ].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={row.id}
                className={clsx(
                  "border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors",
                  i === 0 && "bg-gray-800/20"
                )}
              >
                <td className="px-3 py-2 font-medium text-white whitespace-nowrap">
                  {row.label}
                </td>
                <td className="px-3 py-2">
                  <SourceBadge source={row.source} />
                </td>

                {/* MAU */}
                <td className="px-3 py-2">
                  <div className="text-white">{fmt(row.mau, "compact")}</div>
                  <GrowthBadge pct={row.growth.mau} />
                </td>

                {/* Brands */}
                <td className="px-3 py-2">
                  <div className="text-white">{row.activeBrands}</div>
                  <GrowthBadge pct={row.growth.activeBrands} />
                </td>

                {/* Bets */}
                <td className="px-3 py-2">
                  <div className="text-white">{fmt(row.betsPlaced, "compact")}</div>
                  <GrowthBadge pct={row.growth.betsPlaced} />
                </td>

                {/* Wager */}
                <td className="px-3 py-2">
                  <div className="text-white">{fmt(row.wager, "currency")}</div>
                  <GrowthBadge pct={row.growth.wager} />
                </td>

                {/* GGR */}
                <td className="px-3 py-2">
                  <div className="text-white">{fmt(row.ggr, "currency")}</div>
                  <GrowthBadge pct={row.growth.ggr} />
                </td>

                {/* Fees */}
                <td className="px-3 py-2">
                  <div className="text-white">{fmt(row.fees, "currency")}</div>
                  <GrowthBadge pct={row.growth.fees} />
                </td>

                {/* Edge */}
                <td className="px-3 py-2 text-gray-300">
                  {fmt(row.effectiveEdge, "percent")}
                </td>

                {/* Daily GGR */}
                <td className="px-3 py-2 text-gray-300">
                  {fmt(row.daily.ggr, "currency")}
                </td>

                {/* Daily Fees */}
                <td className="px-3 py-2 text-gray-300">
                  {fmt(row.daily.fees, "currency")}
                </td>

                {/* Annualized GGR */}
                <td className="px-3 py-2 text-gray-300">
                  {fmt(row.annualized.ggr, "currency")}
                </td>

                {/* Annualized Fees */}
                <td className="px-3 py-2 text-gray-300">
                  {fmt(row.annualized.fees, "currency")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
