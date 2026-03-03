"use client";

import { useState, useEffect, useCallback } from "react";
import { MonthlyDataWithGrowth } from "@/lib/types";
import { fmt } from "@/lib/format";
import MetricCard from "@/components/MetricCard";
import GrowthChart from "@/components/GrowthChart";
import DataTable from "@/components/DataTable";
import AddDataModal from "@/components/AddDataModal";
import GrafanaSync from "@/components/GrafanaSync";

export default function Dashboard() {
  const [data, setData] = useState<MonthlyDataWithGrowth[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

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
    const interval = setInterval(load, 30_000); // auto-refresh every 30s
    return () => clearInterval(interval);
  }, [load]);

  const latest = data[data.length - 1];
  const prev = data[data.length - 2];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">
            Origamo
            <span className="ml-2 text-emerald-400 font-light">Growth</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {lastRefresh
              ? `Last refreshed ${lastRefresh.toLocaleTimeString()}`
              : "Loading…"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="text-xs text-gray-400 hover:text-white px-3 py-1.5 border border-gray-700 rounded-lg transition-colors"
          >
            ↻ Refresh
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg font-semibold transition-colors"
          >
            + Add Month
          </button>
        </div>
      </header>

      <main className="px-6 py-6 space-y-6 max-w-7xl mx-auto">
        {/* ── Latest month banner ───────────────────────────────────────────── */}
        {latest && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-400">Latest period:</span>
            <span className="font-semibold text-white">{latest.label}</span>
            {latest.source === "grafana" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 font-medium">
                auto-synced
              </span>
            )}
          </div>
        )}

        {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {latest && (
            <>
              <MetricCard
                label="Active Players"
                value={fmt(latest.mau, "compact")}
                growth={latest.growth.mau}
                icon="👥"
                sub={prev ? `was ${fmt(prev.mau, "compact")}` : undefined}
              />
              <MetricCard
                label="Active Brands"
                value={String(latest.activeBrands)}
                growth={latest.growth.activeBrands}
                icon="🏷️"
              />
              <MetricCard
                label="Bets Placed"
                value={fmt(latest.betsPlaced, "compact")}
                growth={latest.growth.betsPlaced}
                icon="🎲"
              />
              <MetricCard
                label="Wager"
                value={fmt(latest.wager, "currency")}
                growth={latest.growth.wager}
                icon="💰"
                sub={`Daily: ${fmt(latest.daily.wager, "currency")}`}
              />
              <MetricCard
                label="GGR"
                value={fmt(latest.ggr, "currency")}
                growth={latest.growth.ggr}
                icon="📈"
                sub={`Ann: ${fmt(latest.annualized.ggr, "currency")}`}
              />
              <MetricCard
                label="Platform Fees"
                value={fmt(latest.fees, "currency")}
                growth={latest.growth.fees}
                icon="⚙️"
                sub={`Ann: ${fmt(latest.annualized.fees, "currency")}`}
              />
            </>
          )}
        </div>

        {/* ── Charts ────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          <GrowthChart
            data={data}
            metric="ggr"
            title="GGR (USD)"
            color="#22c55e"
            valueStyle="currency"
          />
          <GrowthChart
            data={data}
            metric="fees"
            title="Platform Fees (USD)"
            color="#3b82f6"
            valueStyle="currency"
          />
          <GrowthChart
            data={data}
            metric="wager"
            title="Total Wager (USD)"
            color="#8b5cf6"
            valueStyle="currency"
          />
          <GrowthChart
            data={data}
            metric="mau"
            title="Active Players (MAU)"
            color="#f59e0b"
            valueStyle="number"
          />
          <GrowthChart
            data={data}
            metric="betsPlaced"
            title="Bets Placed"
            color="#ec4899"
            valueStyle="compact"
          />
          {/* Grafana Sync widget in chart grid */}
          <GrafanaSync onSynced={load} />
        </div>

        {/* ── Data Table ────────────────────────────────────────────────────── */}
        {data.length > 0 && <DataTable data={data} />}

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div className="text-center text-xs text-gray-600 pb-6">
          Data stored in{" "}
          <code className="bg-gray-800 px-1 rounded">data/metrics.json</code>{" "}
          · Grafana sync via{" "}
          <code className="bg-gray-800 px-1 rounded">/api/grafana</code>
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
