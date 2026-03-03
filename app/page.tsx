"use client";

import { useState, useEffect, useCallback } from "react";
import clsx from "clsx";
import { MonthlyDataWithGrowth } from "@/lib/types";
import { fmt, fmtGrowth, growthColor } from "@/lib/format";
import MetricCard from "@/components/MetricCard";
import GrowthChart from "@/components/GrowthChart";
import DataTable from "@/components/DataTable";
import AddDataModal from "@/components/AddDataModal";
import BrandPerformanceSection from "@/components/BrandPerformanceSection";
import GrowthInsights from "@/components/GrowthInsights";

type FinancialView = "monthly" | "daily" | "annual";
type Tab = "overview" | "brands" | "insights" | "data";

export default function Dashboard() {
  const [data, setData] = useState<MonthlyDataWithGrowth[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [financialView, setFinancialView] = useState<FinancialView>("monthly");
  const [selectedMonthId, setSelectedMonthId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<Tab>("overview");

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
  const selectedPrev = selectedIdx > 0  ? data[selectedIdx - 1] : undefined;

  function financialVal(row: MonthlyDataWithGrowth, key: "wager" | "ggr" | "fees"): number {
    if (financialView === "daily")  return row.daily[key];
    if (financialView === "annual") return row.annualized[key];
    return row[key];
  }

  // Effective edge growth vs previous month
  const edgeGrowth =
    selected && selectedPrev && selectedPrev.effectiveEdge > 0
      ? ((selected.effectiveEdge - selectedPrev.effectiveEdge) / selectedPrev.effectiveEdge) * 100
      : null;

  // ── Per-player efficiency metrics (for selected month) ────────────
  const ggrPP    = selected ? selected.ggr         / selected.mau        : 0;
  const wagerPP  = selected ? selected.wager        / selected.mau        : 0;
  const betsPP   = selected ? selected.betsPlaced   / selected.mau        : 0;
  const avgBet   = selected && selected.betsPlaced > 0 ? selected.wager / selected.betsPlaced : 0;

  const prevGgrPP   = selectedPrev ? selectedPrev.ggr         / selectedPrev.mau        : null;
  const prevWagerPP = selectedPrev ? selectedPrev.wager        / selectedPrev.mau        : null;
  const prevBetsPP  = selectedPrev ? selectedPrev.betsPlaced   / selectedPrev.mau        : null;
  const prevAvgBet  = selectedPrev && selectedPrev.betsPlaced > 0 ? selectedPrev.wager / selectedPrev.betsPlaced : null;

  function pctChg(prev: number | null, cur: number): number | null {
    if (!prev) return null;
    return ((cur - prev) / Math.abs(prev)) * 100;
  }

  const efficiencyMetrics = [
    { label: "GGR / Player",   value: fmt(ggrPP,   "currency"), growth: pctChg(prevGgrPP,   ggrPP)   },
    { label: "Wager / Player", value: fmt(wagerPP,  "currency"), growth: pctChg(prevWagerPP, wagerPP)  },
    { label: "Bets / Player",  value: betsPP.toFixed(0),         growth: pctChg(prevBetsPP,  betsPP)   },
    { label: "Avg Bet Size",   value: fmt(avgBet,   "currency"), growth: pctChg(prevAvgBet,  avgBet)   },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="origamo" className="h-7 w-auto" />
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

      {/* ── Tab bar ─────────────────────────────────────────────────── */}
      <div className="border-b border-gray-800 px-6">
        <div className="flex gap-0 max-w-7xl mx-auto">
          {(
            [
              ["overview",  "Overview"],
              ["brands",    "Brand Performance"],
              ["insights",  "Growth Intelligence ✦"],
              ["data",      "All-time Data"],
            ] as [Tab, string][]
          ).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                "px-5 py-3 text-sm font-medium border-b-2 transition-all duration-150",
                activeTab === tab
                  ? "border-[#CCFF00] text-white"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="px-6 py-6 max-w-7xl mx-auto">

        {/* ── OVERVIEW TAB ──────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-6">

            {/* KPI cards */}
            <div className="space-y-3">

              {/* Controls row */}
              <div className="flex items-center justify-between px-0.5">
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

                <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-lg p-0.5">
                  {(["monthly", "daily", "annual"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setFinancialView(mode)}
                      className={clsx(
                        "px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150",
                        financialView === mode
                          ? "bg-gray-700 text-white shadow-sm"
                          : "text-gray-500 hover:text-gray-300"
                      )}
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
                      sub={selectedPrev ? `prev ${fmt(selectedPrev.mau, "compact")}` : undefined}
                    />
                    <MetricCard
                      label="Effective Edge"
                      value={`${(selected.effectiveEdge * 100).toFixed(2)}%`}
                      growth={edgeGrowth}
                      sub={selectedPrev ? `prev ${(selectedPrev.effectiveEdge * 100).toFixed(2)}%` : undefined}
                    />
                    <MetricCard
                      label="Bets Placed"
                      value={fmt(selected.betsPlaced, "compact")}
                      growth={selected.growth.betsPlaced}
                      sub={selectedPrev ? `prev ${fmt(selectedPrev.betsPlaced, "compact")}` : undefined}
                    />
                    <MetricCard
                      label="Wager"
                      value={fmt(financialVal(selected, "wager"), "currency")}
                      growth={selected.growth.wager}
                      sub={financialView === "monthly" ? `daily avg ${fmt(selected.daily.wager, "currency")}` : undefined}
                    />
                    <MetricCard
                      label="GGR"
                      value={fmt(financialVal(selected, "ggr"), "currency")}
                      growth={selected.growth.ggr}
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
                      sub={
                        financialView === "monthly" && selected.ggr > 0
                          ? `${((selected.fees / selected.ggr) * 100).toFixed(1)}% of GGR`
                          : undefined
                      }
                    />
                  </>
                )}
              </div>

              {/* Efficiency ribbon */}
              {selected && (
                <div className="bg-gray-900/40 border border-gray-800/60 rounded-xl flex items-stretch overflow-hidden">
                  {/* Label */}
                  <div className="px-5 py-4 flex flex-col justify-center bg-gray-900/60 border-r border-gray-800/60 shrink-0">
                    <div className="text-[9px] font-bold uppercase tracking-widest text-gray-600">
                      Per Player
                    </div>
                    <div className="text-[9px] text-gray-700 mt-0.5">
                      {selected.label}
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-800/60">
                    {efficiencyMetrics.map(({ label, value, growth }) => (
                      <div key={label} className="px-5 py-4">
                        <div className="text-[10px] text-gray-600 mb-1">{label}</div>
                        <div className="text-sm font-bold text-white">{value}</div>
                        <div className={clsx("text-[11px] font-semibold mt-0.5", growthColor(growth))}>
                          {fmtGrowth(growth)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              <GrowthChart data={data} metric="ggr"        title="GGR"            color="#22c55e" valueStyle="currency" />
              <GrowthChart data={data} metric="wager"      title="Total Wager"     color="#8b5cf6" valueStyle="currency" />
              <GrowthChart data={data} metric="fees"       title="Platform Fees"   color="#3b82f6" valueStyle="currency" />
              <GrowthChart data={data} metric="mau"        title="Active Players"  color="#f59e0b" valueStyle="compact"  />
              <GrowthChart data={data} metric="betsPlaced" title="Bets Placed"     color="#ec4899" valueStyle="compact"  />
            </div>

          </div>
        )}

        {/* ── BRAND PERFORMANCE TAB ─────────────────────────────────── */}
        {activeTab === "brands" && (
          <BrandPerformanceSection data={data} />
        )}

        {/* ── GROWTH INTELLIGENCE TAB ───────────────────────────────── */}
        {activeTab === "insights" && (
          <GrowthInsights data={data} />
        )}

        {/* ── ALL-TIME DATA TAB ─────────────────────────────────────── */}
        {activeTab === "data" && (
          <div className="space-y-4 pb-6">
            {data.length > 0 ? (
              <DataTable data={data} />
            ) : (
              <p className="text-sm text-gray-600 py-12 text-center">No data yet.</p>
            )}
            <div className="text-center text-[11px] text-gray-700">
              Data in{" "}
              <code className="bg-gray-800/60 px-1 rounded text-gray-500">data/metrics.json</code>
            </div>
          </div>
        )}
      </main>

      {showAdd && (
        <AddDataModal onSaved={load} onClose={() => setShowAdd(false)} />
      )}
    </div>
  );
}
