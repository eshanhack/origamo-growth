"use client";

import { useState, useMemo } from "react";
import { MonthlyDataWithGrowth, BrandPerformance } from "@/lib/types";
import { fmt } from "@/lib/format";

const BRAND_COLORS = ["#CCFF00", "#22c55e", "#3b82f6", "#f59e0b", "#ec4899"];

function daysInPeriod(start: string, end: string): number {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)) + 1);
}

interface ChipProps {
  label: string;
  value: string;
  variant?: "default" | "warn" | "danger" | "highlight";
}
function Chip({ label, value, variant = "default" }: ChipProps) {
  const styles = {
    default:   "bg-gray-800 text-white",
    highlight: "bg-[#CCFF00]/10 border border-[#CCFF00]/20 text-[#CCFF00]",
    warn:      "bg-amber-900/30 border border-amber-800/40 text-amber-300",
    danger:    "bg-red-900/30 border border-red-800/40 text-red-400",
  };
  return (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${styles[variant]}`}>
      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-xs font-semibold">{value}</span>
    </div>
  );
}

interface Props {
  data: MonthlyDataWithGrowth[];
}

export default function BrandPerformanceSection({ data }: Props) {
  const months = useMemo(
    () => data.filter((d) => d.brandBreakdown && d.brandBreakdown.length > 0),
    [data]
  );

  const [selectedId, setSelectedId] = useState<string>(() => months[months.length - 1]?.id ?? "");
  const selected = months.find((d) => d.id === selectedId) ?? months[months.length - 1];
  const prevMonth = useMemo(() => {
    if (!selected) return undefined;
    const idx = months.findIndex((d) => d.id === selected.id);
    return idx > 0 ? months[idx - 1] : undefined;
  }, [selected, months]);

  if (!months.length || !selected?.brandBreakdown) return null;

  const brands   = selected.brandBreakdown;
  const days     = daysInPeriod(selected.dateStart, selected.dateEnd);
  const top5Wager = brands.reduce((s, b) => s + b.wager, 0);
  const top5Ggr   = brands.reduce((s, b) => s + b.ggr, 0);
  const top5GgrCoverage   = selected.ggr   > 0 ? (top5Ggr   / selected.ggr)   * 100 : 0;
  const top5WagerCoverage = selected.wager > 0 ? (top5Wager / selected.wager) * 100 : 0;

  // Best GGR margin brand (positive wager only)
  const bestMarginBrand = brands.reduce<BrandPerformance | null>((best, b) => {
    if (b.wager <= 0) return best;
    if (!best || b.ggr / b.wager > best.ggr / best.wager) return b;
    return best;
  }, null);

  const negativeGgr = brands.filter((b) => b.ggr < 0);

  // Brand that grew fastest MoM by wager
  let fastestBrand: { name: string; pct: number } | null = null;
  for (const b of brands) {
    const prev = prevMonth?.brandBreakdown?.find((p) => p.name === b.name);
    if (!prev || prev.wager <= 0) continue;
    const pct = ((b.wager - prev.wager) / prev.wager) * 100;
    if (!fastestBrand || pct > fastestBrand.pct) fastestBrand = { name: b.name, pct };
  }

  // Brand with highest annualised GGR
  const topGgrBrand = [...brands].sort((a, b) => b.ggr - a.ggr)[0];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
      {/* ── Header row ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-white">Brand Performance</h2>

        {/* Month dropdown */}
        <div className="relative">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="appearance-none bg-gray-800 border border-gray-700 text-white text-xs font-medium rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:border-gray-500 cursor-pointer"
          >
            {months.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">▾</span>
        </div>
      </div>

      {/* ── Insight chips ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <Chip
          label="Wager coverage"
          value={`${top5WagerCoverage.toFixed(0)}% of platform`}
        />
        <Chip
          label="GGR coverage"
          value={`${top5GgrCoverage.toFixed(0)}% of platform`}
        />
        {bestMarginBrand && (
          <Chip
            label="Best margin"
            value={`${bestMarginBrand.name} · ${((bestMarginBrand.ggr / bestMarginBrand.wager) * 100).toFixed(2)}%`}
            variant="highlight"
          />
        )}
        {topGgrBrand && topGgrBrand.ggr > 0 && (
          <Chip
            label={`${topGgrBrand.name} ann. GGR`}
            value={fmt(topGgrBrand.ggr * 12, "currency")}
            variant="highlight"
          />
        )}
        {fastestBrand && (
          <Chip
            label="Fastest growing"
            value={`${fastestBrand.name} +${fastestBrand.pct.toFixed(0)}% wager MoM`}
          />
        )}
        {negativeGgr.length > 0 && (
          <Chip
            label="Negative GGR"
            value={negativeGgr.map((b) => b.name).join(", ")}
            variant="danger"
          />
        )}
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              {["#", "Brand", "Wager", "GGR", "Margin", "Fees",
                "Ann. Wager", "Daily Wager", "Platform share", "MoM"].map((h) => (
                <th
                  key={h}
                  className="pb-2 pr-4 text-left text-[11px] text-gray-500 font-medium whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {brands.map((brand, i) => {
              const margin     = brand.wager > 0 ? (brand.ggr / brand.wager) * 100 : 0;
              const share      = (brand.wager / selected.wager) * 100;
              const maxShare   = (brands[0].wager / selected.wager) * 100; // for bar scaling
              const annWager   = brand.wager * 12;
              const dailyWager = brand.wager / days;
              const prevBrand  = prevMonth?.brandBreakdown?.find((b) => b.name === brand.name);
              const mom        = prevBrand && prevBrand.wager > 0
                ? ((brand.wager - prevBrand.wager) / prevBrand.wager) * 100
                : null;
              const isNegGgr   = brand.ggr < 0;
              const color      = BRAND_COLORS[i % BRAND_COLORS.length];

              const marginColor = isNegGgr
                ? "text-red-400"
                : margin >= 3
                ? "text-emerald-400"
                : "text-amber-400";

              return (
                <tr
                  key={brand.name}
                  className="border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors"
                >
                  <td className="py-3 pr-4 text-gray-600 text-xs">{i + 1}</td>

                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-white text-xs font-medium">{brand.name}</span>
                      {!prevMonth?.brandBreakdown?.find((b) => b.name === brand.name) && prevMonth && (
                        <span className="text-[9px] text-[#CCFF00] font-semibold bg-[#CCFF00]/10 px-1 rounded">NEW</span>
                      )}
                    </div>
                  </td>

                  <td className="py-3 pr-4 text-white font-mono text-xs">{fmt(brand.wager, "currency")}</td>

                  <td className={`py-3 pr-4 font-mono text-xs ${isNegGgr ? "text-red-400" : "text-white"}`}>
                    {isNegGgr ? "−" : ""}{fmt(Math.abs(brand.ggr), "currency")}
                  </td>

                  <td className="py-3 pr-4 text-xs">
                    <span className={marginColor}>{margin.toFixed(2)}%</span>
                  </td>

                  <td className={`py-3 pr-4 font-mono text-xs ${brand.fees < 0 ? "text-red-400" : "text-gray-300"}`}>
                    {brand.fees < 0 ? "−" : ""}{fmt(Math.abs(brand.fees), "currency")}
                  </td>

                  <td className="py-3 pr-4 text-gray-300 font-mono text-xs">{fmt(annWager, "currency")}</td>

                  <td className="py-3 pr-4 text-gray-400 font-mono text-xs">{fmt(dailyWager, "currency")}</td>

                  {/* Share bar */}
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(share / maxShare) * 100}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                      <span className="text-[11px] text-gray-400">{share.toFixed(0)}%</span>
                    </div>
                  </td>

                  {/* MoM */}
                  <td className="py-3 pr-4 text-xs">
                    {mom === null ? (
                      <span className="text-gray-700">—</span>
                    ) : (
                      <span className={mom >= 0 ? "text-emerald-400" : "text-red-400"}>
                        {mom >= 0 ? "+" : ""}{mom.toFixed(1)}%
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Totals */}
          <tfoot>
            <tr className="border-t border-gray-700">
              <td className="pt-3 pr-4" />
              <td className="pt-3 pr-4 text-[11px] text-gray-500 font-medium">Top 5 total</td>
              <td className="pt-3 pr-4 text-white font-mono text-xs font-semibold">
                {fmt(top5Wager, "currency")}
              </td>
              <td className="pt-3 pr-4 font-mono text-xs font-semibold">
                {(() => {
                  const neg = top5Ggr < 0;
                  return (
                    <span className={neg ? "text-red-400" : "text-white"}>
                      {neg ? "−" : ""}{fmt(Math.abs(top5Ggr), "currency")}
                    </span>
                  );
                })()}
              </td>
              <td className="pt-3 pr-4 text-xs text-gray-500">
                {top5Wager > 0 ? `${((top5Ggr / top5Wager) * 100).toFixed(2)}%` : "—"}
              </td>
              <td className="pt-3 pr-4 text-gray-300 font-mono text-xs font-semibold">
                {fmt(brands.reduce((s, b) => s + b.fees, 0), "currency")}
              </td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
