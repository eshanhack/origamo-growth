"use client";

import { useState, useEffect, useCallback } from "react";
import { MonthlyDataWithGrowth } from "@/lib/types";
import { fmt } from "@/lib/format";
import MetricCard from "@/components/MetricCard";
import GrowthChart from "@/components/GrowthChart";
import DataTable from "@/components/DataTable";
import AddDataModal from "@/components/AddDataModal";
import BrandPerformanceSection from "@/components/BrandPerformanceSection";

type FinancialView = "monthly" | "daily" | "annual";

export default function Dashboard() {
  const [data, setData] = useState<MonthlyDataWithGrowth[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [financialView, setFinancialView] = useState<FinancialView>("monthly");
  const [selectedMonthId, setSelectedMonthId] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/data");
      const json: MonthlyDataWithGrowth[] = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  // Default to latest month whenever data first loads
  useEffect(() => {
    if (data.length && !selectedMonthId) {
      setSelectedMonthId(data[data.length - 1].id);
    }
  }, [data, selectedMonthId]);

  const selectedIdx  = data.findIndex((d) => d.id === selectedMonthId);
  const selected     = selectedIdx >= 0 ? data[selectedIdx] : data[data.length - 1];
  const selectedPrev = selectedIdx > 0   ? data[selectedIdx - 1] : undefined;

  function financialVal(row: MonthlyDataWithGrowth, key: "wager" | "ggr" | "fees"): number {
    if (financialView === "daily")  return row.daily[key];
    if (financialView === "annual") return row.annualized[key];
    return row[key];
  }

  // Effective edge growth vs previous month (same period)
  const edgeGrowth =
    selected && selectedPrev && selectedPrev.effectiveEdge > 0
      ? ((selected.effectiveEdge - selectedPrev.effectiveEdge) / selectedPrev.effectiveEdge) * 100
      : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Logo: full origamo mark + wordmark, then "Growth" appended */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="origamo" className="h-7 w-auto" />
          <span className="text-lg font-semibold text-[#CCFF00] tracking-tight -ml-1">
            Growth
          </span>
        </div>

        <div className="flex items-center gap-2">
          <p className="text-[11px] text-gray-600 mr-1">
            {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : ""}
          </p>
          <button
            onClick={load}
            className="text-xs text-gray-500 hover:text-white px-3 py-1.5 border border-gray-800 hover:border-gray-600 rounded-lg transition-colors"
          >
            ↻
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

        {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
        <div className="space-y-2">

          {/* Toggle row */}
          <div className="flex items-center justify-between px-0.5">

            {/* Left: Month selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Month</span>
              <div className="relative">
                <select
                  value={selected?.id ?? ""}
                  onChange={(e) => setSelectedMonthId(e.target.value)}
                  className="appearance-none bg-gray-800 border border-gray-700 text-white text-xs font-medium rounded-lg pl-3 pr-7 py-1.5 focus:outline-none focus:border-gray-500 cursor-pointer"
                >
                  {[...data].reverse().map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">▾</span>
              </div>
            </div>

            {/* Right: Daily / Annualised (affect Wager, GGR, Fees only) */}
            <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-lg p-0.5">
              {(["monthly", "daily", "annual"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFinancialView(mode)}
                  className={[
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150",
                    financialView === mode
                      ? "bg-gray-700 text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-300",
                  ].join(" ")}
                >
                  {mode === "monthly" ? "Monthly" : mode === "daily" ? "Daily" : "Annualised"}
                </button>
              ))}
            </div>
          </div>

          {/* 6 KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {selected && (
              <>
                <MetricCard
                  label="Active Players"
                  value={fmt(selected.mau, "compact")}
                  growth={selected.growth.mau}
                  icon="👥"
                  sub={selectedPrev ? `prev ${fmt(selectedPrev.mau, "compact")}` : undefined}
                />
                <MetricCard
                  label="Effective Edge"
                  value={`${(selected.effectiveEdge * 100).toFixed(2)}%`}
                  growth={edgeGrowth}
                  icon="🎯"
                  sub={selectedPrev ? `prev ${(selectedPrev.effectiveEdge * 100).toFixed(2)}%` : undefined}
                />
                <MetricCard
                  label="Bets Placed"
                  value={fmt(selected.betsPlaced, "compact")}
                  growth={selected.growth.betsPlaced}
                  icon="🎲"
                  sub={selectedPrev ? `prev ${fmt(selectedPrev.betsPlaced, "compact")}` : undefined}
                />
                <MetricCard
                  label="Wager"
                  value={fmt(financialVal(selected, "wager"), "currency")}
                  growth={selected.growth.wager}
                  icon="💰"
                  sub={financialView === "monthly" ? `daily avg ${fmt(selected.daily.wager, "currency")}` : undefined}
                />
                <MetricCard
                  label="GGR"
                  value={fmt(financialVal(selected, "ggr"), "currency")}
                  growth={selected.growth.ggr}
                  icon="📈"
                  sub={
                    financialView === "monthly"
                      ? `${(selected.effectiveEdge * 100).toFixed(2)}% edge`
                      : undefined
                  }
                />
                <MetricCard
                  label="Platform Fees"
                  value={fmt(financialVal(selected, "fees"), "currency")}
                  growth={selected.growth.fees}
                  icon="⚙️"
                  sub={
                    financialView === "monthly" && selected.ggr > 0
                      ? `${((selected.fees / selected.ggr) * 100).toFixed(1)}% of GGR`
                      : undefined
                  }
                />
              </>
            )}
          </div>
        </div>

        {/* ── Charts ────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          <GrowthChart data={data} metric="ggr"        title="GGR"            color="#22c55e" valueStyle="currency" />
          <GrowthChart data={data} metric="wager"      title="Total Wager"     color="#8b5cf6" valueStyle="currency" />
          <GrowthChart data={data} metric="fees"       title="Platform Fees"   color="#3b82f6" valueStyle="currency" />
          <GrowthChart data={data} metric="mau"        title="Active Players"  color="#f59e0b" valueStyle="compact"  />
          <GrowthChart data={data} metric="betsPlaced" title="Bets Placed"     color="#ec4899" valueStyle="compact"  />
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

      {showAdd && (
        <AddDataModal onSaved={load} onClose={() => setShowAdd(false)} />
      )}
    </div>
  );
}
