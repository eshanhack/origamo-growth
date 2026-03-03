"use client";

import { useState, useMemo } from "react";
import { MonthlyDataWithGrowth, BrandPerformance } from "@/lib/types";
import { fmt } from "@/lib/format";

const BRAND_COLORS = ["#22c55e", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899"];

function daysInPeriod(start: string, end: string): number {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)) + 1);
}

function pctStr(n: number, decimals = 1): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(decimals)}%`;
}

interface InsightChipProps {
  label: string;
  value: string;
  variant?: "default" | "warn" | "danger";
}
function InsightChip({ label, value, variant = "default" }: InsightChipProps) {
  const bg =
    variant === "danger" ? "bg-red-900/30 border border-red-800/50" :
    variant === "warn"   ? "bg-amber-900/30 border border-amber-800/50" :
    "bg-gray-800";
  const valueColor =
    variant === "danger" ? "text-red-400" :
    variant === "warn"   ? "text-amber-400" :
    "text-white";
  return (
    <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${bg}`}>
      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
      <span className={`text-xs font-semibold ${valueColor}`}>{value}</span>
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

  // keep selectedId valid when data refreshes
  const selected = months.find((d) => d.id === selectedId) ?? months[months.length - 1];

  const prevMonth = useMemo(() => {
    if (!selected) return undefined;
    const idx = months.findIndex((d) => d.id === selected.id);
    return idx > 0 ? months[idx - 1] : undefined;
  }, [selected, months]);

  if (!months.length || !selected?.brandBreakdown) return null;

  const brands = selected.brandBreakdown;
  const days = daysInPeriod(selected.dateStart, selected.dateEnd);
  const totalWager = selected.wager;
  const top5Wager = brands.reduce((s, b) => s + b.wager, 0);
  const top5Coverage = (top5Wager / totalWager) * 100;

  // Derived insight: brand with best GGR margin (ggr/wager), only positive wager
  const bestMarginBrand = brands.reduce<BrandPerformance | null>((best, b) => {
    if (b.wager <= 0) return best;
    if (!best || b.ggr / b.wager > best.ggr / best.wager) return b;
    return best;
  }, null);

  const negativeGgrBrands = brands.filter((b) => b.ggr < 0);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
      {/* ── Section header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Brand Performance</h2>
        <span className="text-xs text-gray-500">top 5 brands · {selected.label}</span>
      </div>

      {/* ── Month tabs ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
        <div className="flex items-center bg-gray-950 border border-gray-800 rounded-lg p-0.5">
          {months.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={[
                "px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all duration-150",
                selected.id === m.id
                  ? "bg-gray-700 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-300",
              ].join(" ")}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Insight chips ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <InsightChip
          label="Top 5 coverage"
          value={`${top5Coverage.toFixed(0)}% of platform wager`}
        />
        {bestMarginBrand && (
          <InsightChip
            label="Best GGR margin"
            value={`${bestMarginBrand.name} ${((bestMarginBrand.ggr / bestMarginBrand.wager) * 100).toFixed(2)}%`}
          />
        )}
        <InsightChip
          label={`${brands[0].name} ann. wager`}
          value={fmt(brands[0].wager * 12, "currency")}
        />
        {negativeGgrBrands.length > 0 && (
          <InsightChip
            label="Negative GGR"
            value={negativeGgrBrands.map((b) => b.name).join(", ")}
            variant="danger"
          />
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gray-800">
              {[
                "#", "Brand", "Wager", "GGR", "GGR%", "Fees",
                "Ann. Wager", "Daily Wager", "Share", "MoM Wager",
              ].map((h) => (
                <th
                  key={h}
                  className="pb-2 pr-4 text-[11px] text-gray-500 font-medium whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {brands.map((brand, i) => {
              const margin = brand.wager > 0 ? (brand.ggr / brand.wager) * 100 : 0;
              const share = (brand.wager / totalWager) * 100;
              const annWager = brand.wager * 12;
              const dailyWager = brand.wager / days;
              const prevBrand = prevMonth?.brandBreakdown?.find((b) => b.name === brand.name);
              const mom = prevBrand
                ? ((brand.wager - prevBrand.wager) / prevBrand.wager) * 100
                : null;

              const isNegGgr = brand.ggr < 0;
              const marginColor = isNegGgr
                ? "text-red-400"
                : margin >= 3
                ? "text-emerald-400"
                : "text-amber-400";

              return (
                <tr
                  key={brand.name}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                >
                  {/* rank */}
                  <td className="py-3 pr-4 text-gray-600 text-xs">{i + 1}</td>

                  {/* brand name */}
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: BRAND_COLORS[i % BRAND_COLORS.length] }}
                      />
                      <span className="text-white font-medium text-xs">{brand.name}</span>
                    </div>
                  </td>

                  {/* wager */}
                  <td className="py-3 pr-4 text-white font-mono text-xs">
                    {fmt(brand.wager, "currency")}
                  </td>

                  {/* ggr */}
                  <td className={`py-3 pr-4 font-mono text-xs ${isNegGgr ? "text-red-400" : "text-white"}`}>
                    {isNegGgr ? "-" : ""}{fmt(Math.abs(brand.ggr), "currency")}
                  </td>

                  {/* ggr margin */}
                  <td className="py-3 pr-4 text-xs">
                    <span className={marginColor}>
                      {isNegGgr ? "" : ""}{margin.toFixed(2)}%
                    </span>
                  </td>

                  {/* fees */}
                  <td className={`py-3 pr-4 font-mono text-xs ${brand.fees < 0 ? "text-red-400" : "text-gray-300"}`}>
                    {brand.fees < 0 ? "-" : ""}{fmt(Math.abs(brand.fees), "currency")}
                  </td>

                  {/* annualised wager */}
                  <td className="py-3 pr-4 text-gray-300 font-mono text-xs">
                    {fmt(annWager, "currency")}
                  </td>

                  {/* daily wager */}
                  <td className="py-3 pr-4 text-gray-400 font-mono text-xs">
                    {fmt(dailyWager, "currency")}
                  </td>

                  {/* share bar */}
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-14 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (share / Math.max(...brands.map(b => b.wager / totalWager * 100))) * 100)}%`,
                            backgroundColor: BRAND_COLORS[i % BRAND_COLORS.length],
                          }}
                        />
                      </div>
                      <span className="text-[11px] text-gray-400">{share.toFixed(0)}%</span>
                    </div>
                  </td>

                  {/* MoM wager change */}
                  <td className="py-3 pr-4 text-xs">
                    {mom === null ? (
                      <span className="text-gray-700">—</span>
                    ) : (
                      <span className={mom >= 0 ? "text-emerald-400" : "text-red-400"}>
                        {pctStr(mom)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* totals row */}
          <tfoot>
            <tr className="border-t border-gray-700">
              <td className="pt-2 pr-4" />
              <td className="pt-2 pr-4 text-[11px] text-gray-500 font-medium">Top 5 total</td>
              <td className="pt-2 pr-4 text-white font-mono text-xs font-semibold">
                {fmt(brands.reduce((s, b) => s + b.wager, 0), "currency")}
              </td>
              <td className="pt-2 pr-4 font-mono text-xs font-semibold">
                {(() => {
                  const total = brands.reduce((s, b) => s + b.ggr, 0);
                  return (
                    <span className={total < 0 ? "text-red-400" : "text-white"}>
                      {total < 0 ? "-" : ""}{fmt(Math.abs(total), "currency")}
                    </span>
                  );
                })()}
              </td>
              <td className="pt-2 pr-4 text-xs text-gray-500">
                {(() => {
                  const tw = brands.reduce((s, b) => s + b.wager, 0);
                  const tg = brands.reduce((s, b) => s + b.ggr, 0);
                  return tw > 0 ? `${((tg / tw) * 100).toFixed(2)}%` : "—";
                })()}
              </td>
              <td className="pt-2 pr-4 text-gray-300 font-mono text-xs font-semibold">
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
