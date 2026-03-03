"use client";

import { useState, useEffect, useCallback } from "react";
import { MonthlyDataWithGrowth } from "@/lib/types";
import { fmt } from "@/lib/format";
import MetricCard from "@/components/MetricCard";
import GrowthChart from "@/components/GrowthChart";
import DataTable from "@/components/DataTable";
import AddDataModal from "@/components/AddDataModal";
import BrandPerformanceSection from "@/components/BrandPerformanceSection";
import OrigamiLogo from "@/components/OrigamiLogo";

type FinancialView = "monthly" | "daily" | "annual";

export default function Dashboard() {
  const [data, setData] = useState<MonthlyDataWithGrowth[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [financialView, setFinancialView] = useState<FinancialView>("monthly");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/data");
      const json: MonthlyDataWithGrowth[] = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch {
      /* ignore transient errors */
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const latest = data[data.length - 1];
  const prev   = data[data.length - 2];

  function financialVal(row: MonthlyDataWithGrowth, key: "wager" | "ggr" | "fees"): number {
    if (financialView === "daily")  return row.daily[key];
    if (financialView === "annual") return row.annualized[key];
    return row[key];
  }

  // ── derived context metrics ──────────────────────────────────────────────
  const ggrPerPlayer  = latest ? latest.ggr   / latest.mau : 0;
  const wagerPerPlayer = latest ? latest.wager / latest.mau : 0;
  const prevGgrPerPlayer  = prev ? prev.ggr   / prev.mau : null;
  const ggrPerPlayerDelta = prevGgrPerPlayer
    ? ((ggrPerPlayer - prevGgrPerPlayer) / prevGgrPerPlayer) * 100
    : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <OrigamiLogo size={32} />
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none">
              <span className="text-[#CCFF00]">Growth</span>
            </h1>
            <p className="text-[11px] text-gray-600 mt-0.5">
              {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : "Loading…"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="text-xs text-gray-500 hover:text-white px-3 py-1.5 border border-gray-800 hover:border-gray-600 rounded-lg transition-colors"
          >
            ↻ Refresh
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="text-xs bg-[#CCFF00] hover:bg-[#d4ff33] text-black px-4 py-1.5 rounded-lg font-semibold transition-colors"
          >
            + Add Month
          </button>
        </div>
      </header>

      <main className="px-6 py-6 space-y-6 max-w-7xl mx-auto">

        {/* ── Context strip ─────────────────────────────────────────────────── */}
        {latest && (
          <div className="flex items-center gap-6 flex-wrap text-xs border border-gray-800/60 bg-gray-900/40 rounded-xl px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="text-gray-600 uppercase tracking-wider text-[10px]">Period</span>
              <span className="font-semibold text-white">{latest.label}</span>
            </div>
            <div className="w-px h-4 bg-gray-800" />
            <div className="flex items-center gap-2">
              <span className="text-gray-600 uppercase tracking-wider text-[10px]">GGR / Player</span>
              <span className="font-semibold text-white">{fmt(ggrPerPlayer, "currency", 2)}</span>
              {ggrPerPlayerDelta !== null && (
                <span className={ggrPerPlayerDelta >= 0 ? "text-emerald-400" : "text-red-400"}>
                  {ggrPerPlayerDelta >= 0 ? "▲" : "▼"} {Math.abs(ggrPerPlayerDelta).toFixed(1)}%
                </span>
              )}
            </div>
            <div className="w-px h-4 bg-gray-800" />
            <div className="flex items-center gap-2">
              <span className="text-gray-600 uppercase tracking-wider text-[10px]">Wager / Player</span>
              <span className="font-semibold text-white">{fmt(wagerPerPlayer, "currency", 0)}</span>
            </div>
            <div className="w-px h-4 bg-gray-800" />
            <div className="flex items-center gap-2">
              <span className="text-gray-600 uppercase tracking-wider text-[10px]">Eff. Edge</span>
              <span className="font-semibold text-white">{(latest.effectiveEdge * 100).toFixed(2)}%</span>
              {prev && (
                <span className={latest.effectiveEdge >= prev.effectiveEdge ? "text-emerald-400" : "text-amber-400"}>
                  {latest.effectiveEdge >= prev.effectiveEdge ? "▲" : "▼"} prev {(prev.effectiveEdge * 100).toFixed(2)}%
                </span>
              )}
            </div>
            <div className="w-px h-4 bg-gray-800" />
            <div className="flex items-center gap-2">
              <span className="text-gray-600 uppercase tracking-wider text-[10px]">Active Brands</span>
              <span className="font-semibold text-white">{latest.activeBrands}</span>
            </div>
          </div>
        )}

        {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          {/* Toggle row: Monthly baseline left — Daily / Annualised right */}
          <div className="flex items-center justify-between px-0.5">
            {/* Monthly: the default baseline */}
            <button
              onClick={() => setFinancialView("monthly")}
              className={[
                "flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5 transition-all duration-150",
                financialView === "monthly"
                  ? "bg-gray-800 border border-gray-700 text-white"
                  : "text-gray-600 hover:text-gray-400",
              ].join(" ")}
            >
              {financialView === "monthly" && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] inline-block" />
              )}
              Monthly
            </button>

            {/* Derived views: right-aligned, affect Wager · GGR · Fees only */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-700 hidden sm:block">Wager · GGR · Fees</span>
              <div className="flex items-center bg-gray-900 border border-gray-800 rounded-lg p-0.5">
                {(["daily", "annual"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setFinancialView(financialView === mode ? "monthly" : mode)}
                    className={[
                      "px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150",
                      financialView === mode
                        ? "bg-gray-700 text-white shadow-sm"
                        : "text-gray-500 hover:text-gray-300",
                    ].join(" ")}
                  >
                    {mode === "daily" ? "Daily" : "Annualised"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 6 KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {latest && (
              <>
                <MetricCard
                  label="Active Players"
                  value={fmt(latest.mau, "compact")}
                  growth={latest.growth.mau}
                  icon="👥"
                  sub={prev ? `prev ${fmt(prev.mau, "compact")}` : undefined}
                />
                <MetricCard
                  label="Active Brands"
                  value={String(latest.activeBrands)}
                  growth={latest.growth.activeBrands}
                  icon="🏷️"
                  sub={prev ? `prev ${prev.activeBrands}` : undefined}
                />
                <MetricCard
                  label="Bets Placed"
                  value={fmt(latest.betsPlaced, "compact")}
                  growth={latest.growth.betsPlaced}
                  icon="🎲"
                  sub={prev ? `prev ${fmt(prev.betsPlaced, "compact")}` : undefined}
                />
                <MetricCard
                  label="Wager"
                  value={fmt(financialVal(latest, "wager"), "currency")}
                  growth={latest.growth.wager}
                  icon="💰"
                  sub={financialView === "monthly" ? `daily avg ${fmt(latest.daily.wager, "currency")}` : undefined}
                />
                <MetricCard
                  label="GGR"
                  value={fmt(financialVal(latest, "ggr"), "currency")}
                  growth={latest.growth.ggr}
                  icon="📈"
                  sub={financialView === "monthly" ? `${(latest.effectiveEdge * 100).toFixed(2)}% edge` : undefined}
                />
                <MetricCard
                  label="Platform Fees"
                  value={fmt(financialVal(latest, "fees"), "currency")}
                  growth={latest.growth.fees}
                  icon="⚙️"
                  sub={
                    financialView === "monthly" && latest.ggr > 0
                      ? `${((latest.fees / latest.ggr) * 100).toFixed(1)}% of GGR`
                      : undefined
                  }
                />
              </>
            )}
          </div>
        </div>

        {/* ── Charts ────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          <GrowthChart
            data={data}
            metric="ggr"
            title="GGR"
            color="#22c55e"
            valueStyle="currency"
          />
          <GrowthChart
            data={data}
            metric="wager"
            title="Total Wager"
            color="#8b5cf6"
            valueStyle="currency"
          />
          <GrowthChart
            data={data}
            metric="fees"
            title="Platform Fees"
            color="#3b82f6"
            valueStyle="currency"
          />
          <GrowthChart
            data={data}
            metric="mau"
            title="Active Players"
            color="#f59e0b"
            valueStyle="compact"
          />
          <GrowthChart
            data={data}
            metric="betsPlaced"
            title="Bets Placed"
            color="#ec4899"
            valueStyle="compact"
          />
        </div>

        {/* ── Brand Performance ─────────────────────────────────────────────── */}
        <BrandPerformanceSection data={data} />

        {/* ── Data Table ────────────────────────────────────────────────────── */}
        {data.length > 0 && <DataTable data={data} />}

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div className="text-center text-[11px] text-gray-700 pb-6">
          Data in{" "}
          <code className="bg-gray-800/60 px-1 rounded text-gray-500">data/metrics.json</code>
        </div>
      </main>

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      {showAdd && (
        <AddDataModal
          onSaved={load}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
