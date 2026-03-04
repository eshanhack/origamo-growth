"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import clsx from "clsx";
import { MonthlyDataWithGrowth } from "@/lib/types";
import { fmt } from "@/lib/format";
import MetricCard from "@/components/MetricCard";
import GrowthChart from "@/components/GrowthChart";
import DataTable from "@/components/DataTable";
import BrandPerformanceSection from "@/components/BrandPerformanceSection";
import GrowthInsights from "@/components/GrowthInsights";
import PasswordGate from "@/components/PasswordGate";
import BrandsPortfolio from "@/components/BrandsPortfolio";

type FinancialView = "monthly" | "daily" | "annual";
type Tab = "overview" | "brands" | "insights" | "data" | "upcoming";

// ── Quarterly aggregation ─────────────────────────────────────────
function aggregateToQuarters(months: MonthlyDataWithGrowth[]): MonthlyDataWithGrowth[] {
  if (!months.length) return [];

  const groups = new Map<string, MonthlyDataWithGrowth[]>();
  months.forEach((d) => {
    const [year, mo] = d.id.split("-").map(Number);
    const q = Math.ceil(mo / 3);
    const key = `${year}-Q${q}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(d);
  });

  const keys = Array.from(groups.keys()).sort();

  const quarters: MonthlyDataWithGrowth[] = keys.map((key) => {
    const ms      = groups.get(key)!;
    const [year, ql] = key.split("-");
    const totalWager = ms.reduce((s, m) => s + m.wager,      0);
    const totalGGR   = ms.reduce((s, m) => s + m.ggr,        0);
    const totalFees  = ms.reduce((s, m) => s + m.fees,       0);
    const totalBets  = ms.reduce((s, m) => s + m.betsPlaced, 0);
    const avgMAU     = Math.round(ms.reduce((s, m) => s + m.mau, 0) / ms.length);
    const maxBrands  = Math.max(...ms.map((m) => m.activeBrands));
    const edge       = totalWager > 0 ? totalGGR / totalWager : 0;

    const dateStart = ms[0].dateStart;
    const dateEnd   = ms[ms.length - 1].dateEnd;
    const days = Math.max(
      1,
      Math.round((new Date(dateEnd).getTime() - new Date(dateStart).getTime()) / 86400000) + 1,
    );

    return {
      id: key,
      label: `${ql} ${year}`,
      dateStart,
      dateEnd,
      mau: avgMAU,
      activeBrands: maxBrands,
      betsPlaced: totalBets,
      effectiveEdge: edge,
      wager: totalWager,
      ggr: totalGGR,
      fees: totalFees,
      source: "manual" as const,
      growth: { mau: null, activeBrands: null, betsPlaced: null, wager: null, ggr: null, fees: null },
      daily:      { wager: totalWager / days, ggr: totalGGR / days, fees: totalFees / days },
      annualized: { wager: totalWager * 4,    ggr: totalGGR * 4,    fees: totalFees * 4 },
    };
  });

  // Quarter-over-quarter growth
  const g = (a: number, b: number): number | null => (a > 0 ? ((b - a) / a) * 100 : null);
  for (let i = 1; i < quarters.length; i++) {
    const c = quarters[i], p = quarters[i - 1];
    c.growth = {
      mau:          g(p.mau,          c.mau),
      activeBrands: g(p.activeBrands, c.activeBrands),
      betsPlaced:   g(p.betsPlaced,   c.betsPlaced),
      wager:        g(p.wager,        c.wager),
      ggr:          g(p.ggr,          c.ggr),
      fees:         g(p.fees,         c.fees),
    };
  }

  return quarters;
}

// ── Dashboard ─────────────────────────────────────────────────────
export default function Dashboard() {
  const [data,             setData]             = useState<MonthlyDataWithGrowth[]>([]);
  const [lastRefresh,      setLastRefresh]      = useState<Date | null>(null);
  const [financialView,    setFinancialView]    = useState<FinancialView>("monthly");
  const [selectedMonthId,  setSelectedMonthId]  = useState<string>("");
  const [activeTab,        setActiveTab]        = useState<Tab>("overview");
  const [showValues,       setShowValues]       = useState(true);
  const [quarterlyMode,    setQuarterlyMode]    = useState(false);
  const [selectedQtrId,    setSelectedQtrId]    = useState<string>("");

  const load = useCallback(async () => {
    try {
      const res  = await fetch("/api/data");
      const json: MonthlyDataWithGrowth[] = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  // Default selected month to latest
  useEffect(() => {
    if (data.length && !selectedMonthId) {
      setSelectedMonthId(data[data.length - 1].id);
    }
  }, [data, selectedMonthId]);

  // Quarterly data
  const quarterlyData = useMemo(() => aggregateToQuarters(data), [data]);

  // Default selected quarter to latest
  useEffect(() => {
    if (quarterlyData.length && !quarterlyData.find((q) => q.id === selectedQtrId)) {
      setSelectedQtrId(quarterlyData[quarterlyData.length - 1].id);
    }
  }, [quarterlyData, selectedQtrId]);

  // Active data source & selection
  const displayData     = quarterlyMode ? quarterlyData : data;
  const activeId        = quarterlyMode ? selectedQtrId : selectedMonthId;
  const setActiveId     = quarterlyMode ? setSelectedQtrId : setSelectedMonthId;
  const selectedIdx     = displayData.findIndex((d) => d.id === activeId);
  const selected        = selectedIdx >= 0 ? displayData[selectedIdx] : displayData[displayData.length - 1];
  const selectedPrev    = selectedIdx > 0  ? displayData[selectedIdx - 1] : undefined;

  const changeLabel     = quarterlyMode ? "QoQ" : "MoM";
  const periodLabel     = quarterlyMode ? "Quarter" : "Month";

  function financialVal(row: MonthlyDataWithGrowth, key: "wager" | "ggr" | "fees"): number {
    if (financialView === "daily")  return row.daily[key];
    if (financialView === "annual") return row.annualized[key];
    return row[key];
  }

  const edgeGrowth =
    selected && selectedPrev && selectedPrev.effectiveEdge > 0
      ? ((selected.effectiveEdge - selectedPrev.effectiveEdge) / selectedPrev.effectiveEdge) * 100
      : null;

  return (
    <PasswordGate>
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="origamo" className="h-7 w-auto" />
          <span className="text-lg font-semibold text-[#CCFF00] tracking-tight -ml-1">Growth</span>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-[11px] text-gray-600 mr-1">
            {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : ""}
          </p>
          <button
            onClick={load}
            className="text-xs text-gray-500 hover:text-white px-3 py-1.5 border border-gray-800 hover:border-gray-600 rounded-lg transition-colors"
          >↻</button>
        </div>
      </header>

      {/* ── Tab bar ─────────────────────────────────────────────────── */}
      <div className="border-b border-gray-800 px-6">
        <div className="flex gap-0 max-w-7xl mx-auto">
          {([
            ["overview",  "Overview"],
            ["upcoming",  "Brands"],
            ["brands",    "Top 5 Brands Performance"],
            ["insights",  "Growth Intelligence ✦"],
            ["data",      "All-time Data"],
          ] as [Tab, string][]).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                "px-5 py-3 text-sm font-medium border-b-2 transition-all duration-150",
                activeTab === tab
                  ? "border-[#CCFF00] text-white"
                  : "border-transparent text-gray-500 hover:text-gray-300",
              )}
            >{label}</button>
          ))}
        </div>
      </div>

      <main className="px-6 py-6 max-w-7xl mx-auto">

        {/* ── OVERVIEW TAB ────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-6">

            <div className="space-y-3">

              {/* Controls row */}
              <div className="flex items-center justify-between px-0.5">

                {/* Left: period selector + icon toggles */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium">{periodLabel}</span>

                  {/* Period dropdown */}
                  <div className="relative">
                    <select
                      value={selected?.id ?? ""}
                      onChange={(e) => setActiveId(e.target.value)}
                      className="appearance-none bg-gray-800 border border-gray-700 text-white text-xs font-medium rounded-lg pl-3 pr-7 py-1.5 focus:outline-none focus:border-gray-500 cursor-pointer"
                    >
                      {[...displayData].reverse().map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">▾</span>
                  </div>

                  {/* ── Eye toggle ── */}
                  <button
                    onClick={() => setShowValues((v) => !v)}
                    title={showValues ? "Show period-on-period growth" : "Show values"}
                    className={clsx(
                      "flex items-center justify-center w-[30px] h-[30px] rounded-lg border transition-all duration-200",
                      showValues
                        ? "border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600"
                        : "border-[#CCFF00]/30 text-[#CCFF00] bg-[#CCFF00]/5",
                    )}
                  >
                    <div className="relative w-[15px] h-[15px]">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round"
                        className="absolute inset-0 w-full h-full transition-all duration-200"
                        style={{ opacity: showValues ? 1 : 0, transform: showValues ? "scale(1)" : "scale(0.5)" }}
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round"
                        className="absolute inset-0 w-full h-full transition-all duration-200"
                        style={{ opacity: showValues ? 0 : 1, transform: showValues ? "scale(0.5)" : "scale(1)" }}
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    </div>
                  </button>

                  {/* ── Quarter toggle ── */}
                  <button
                    onClick={() => setQuarterlyMode((v) => !v)}
                    title={quarterlyMode ? "Switch to monthly view" : "Switch to quarterly view"}
                    className={clsx(
                      "flex items-center justify-center w-[30px] h-[30px] rounded-lg border transition-all duration-200",
                      quarterlyMode
                        ? "border-[#CCFF00]/30 text-[#CCFF00] bg-[#CCFF00]/5"
                        : "border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600",
                    )}
                  >
                    {/* Quarter-pie icon: full circle outline + top-right quarter filled */}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                      strokeLinecap="round" strokeLinejoin="round"
                      className="w-[15px] h-[15px] transition-all duration-200"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 12 L12 3 A9 9 0 0 1 21 12 Z" fill="currentColor" stroke="none" />
                    </svg>
                  </button>
                </div>

                {/* Right: financial view toggle */}
                <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-lg p-0.5">
                  {(["monthly", "daily", "annual"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setFinancialView(mode)}
                      className={clsx(
                        "px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150",
                        financialView === mode
                          ? "bg-gray-700 text-white shadow-sm"
                          : "text-gray-500 hover:text-gray-300",
                      )}
                    >
                      {mode === "monthly"
                        ? (quarterlyMode ? "Quarterly" : "Monthly")
                        : mode === "daily" ? "Daily" : "Annualised"}
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
                      growthMode={!showValues}
                      changeLabel={changeLabel}
                    />
                    <MetricCard
                      label="Effective Edge"
                      value={`${(selected.effectiveEdge * 100).toFixed(2)}%`}
                      growth={edgeGrowth}
                      sub={selectedPrev ? `prev ${(selectedPrev.effectiveEdge * 100).toFixed(2)}%` : undefined}
                      growthMode={!showValues}
                      changeLabel={changeLabel}
                    />
                    <MetricCard
                      label="Bets Placed"
                      value={fmt(selected.betsPlaced, "compact")}
                      growth={selected.growth.betsPlaced}
                      sub={selectedPrev ? `prev ${fmt(selectedPrev.betsPlaced, "compact")}` : undefined}
                      growthMode={!showValues}
                      changeLabel={changeLabel}
                    />
                    <MetricCard
                      label="Wager"
                      value={fmt(financialVal(selected, "wager"), "currency")}
                      growth={selected.growth.wager}
                      sub={financialView === "monthly" ? `daily avg ${fmt(selected.daily.wager, "currency")}` : undefined}
                      growthMode={!showValues}
                      changeLabel={changeLabel}
                    />
                    <MetricCard
                      label="GGR"
                      value={fmt(financialVal(selected, "ggr"), "currency")}
                      growth={selected.growth.ggr}
                      sub={financialView === "monthly" ? `${(selected.effectiveEdge * 100).toFixed(2)}% edge` : undefined}
                      growthMode={!showValues}
                      changeLabel={changeLabel}
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
                      growthMode={!showValues}
                      changeLabel={changeLabel}
                    />
                  </>
                )}
              </div>

            </div>

            {/* Charts — switch to quarterly data when in quarterly mode */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              <GrowthChart data={displayData} metric="ggr"        title="GGR"           color="#22c55e" valueStyle="currency" />
              <GrowthChart data={displayData} metric="wager"      title="Total Wager"    color="#8b5cf6" valueStyle="currency" />
              <GrowthChart data={displayData} metric="fees"       title="Platform Fees"  color="#3b82f6" valueStyle="currency" />
              <GrowthChart data={displayData} metric="mau"        title="Active Players" color="#f59e0b" valueStyle="compact"  />
              <GrowthChart data={displayData} metric="betsPlaced" title="Bets Placed"    color="#ec4899" valueStyle="compact"  />
            </div>

          </div>
        )}

        {/* ── BRAND PERFORMANCE TAB ───────────────────────────────────── */}
        {activeTab === "brands" && <BrandPerformanceSection data={data} />}

        {/* ── GROWTH INTELLIGENCE TAB ─────────────────────────────────── */}
        {activeTab === "insights" && <GrowthInsights data={data} />}

        {/* ── UPCOMING BRANDS TAB ─────────────────────────────────────── */}
        {activeTab === "upcoming" && <BrandsPortfolio />}

        {/* ── ALL-TIME DATA TAB ───────────────────────────────────────── */}
        {activeTab === "data" && (
          <div className="space-y-4 pb-6">
            {data.length > 0
              ? <DataTable data={data} />
              : <p className="text-sm text-gray-600 py-12 text-center">No data yet.</p>
            }
            <div className="text-center text-[11px] text-gray-700">
              Data in{" "}
              <code className="bg-gray-800/60 px-1 rounded text-gray-500">data/metrics.json</code>
            </div>
          </div>
        )}
      </main>

    </div>
    </PasswordGate>
  );
}
