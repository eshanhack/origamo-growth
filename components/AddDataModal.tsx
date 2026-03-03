"use client";

import { useState } from "react";
import { MonthlyData } from "@/lib/types";
import { format } from "date-fns";

interface Props {
  onSaved: () => void;
  onClose: () => void;
}

const EMPTY: Partial<MonthlyData> = {
  mau: 0,
  activeBrands: 0,
  betsPlaced: 0,
  effectiveEdge: 0,
  wager: 0,
  ggr: 0,
  fees: 0,
  source: "manual",
};

export default function AddDataModal({ onSaved, onClose }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [fields, setFields] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [grafanaLoading, setGrafanaLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateStart = new Date(year, month - 1, 1);
  const dateEnd = new Date(year, month, 0);
  const id = format(dateStart, "yyyy-MM");
  const label = format(dateStart, "MMM yyyy");

  function set(key: keyof typeof fields, raw: string) {
    setFields((prev) => ({
      ...prev,
      [key]: key === "source" ? raw : parseFloat(raw) || 0,
    }));
  }

  async function handleGrafanaFetch() {
    setGrafanaLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/grafana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.hint ?? json.error ?? "Grafana fetch failed");
        return;
      }
      // json.saved has the fetched data — pre-fill the form
      const s = json.saved as MonthlyData;
      setFields({
        mau: s.mau,
        activeBrands: s.activeBrands,
        betsPlaced: s.betsPlaced,
        effectiveEdge: s.effectiveEdge,
        wager: s.wager,
        ggr: s.ggr,
        fees: s.fees,
        source: "grafana",
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setGrafanaLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload: MonthlyData = {
        ...(fields as MonthlyData),
        id,
        label,
        dateStart: format(dateStart, "yyyy-MM-dd"),
        dateEnd: format(dateEnd, "yyyy-MM-dd"),
      };
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Save failed");
        return;
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const MONTHS = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-base font-semibold text-white">Add / Update Month</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Period */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Month</label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div className="w-28">
              <label className="block text-xs text-gray-400 mb-1">Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Grafana auto-fill */}
          <button
            type="button"
            onClick={handleGrafanaFetch}
            disabled={grafanaLoading}
            className="w-full flex items-center justify-center gap-2 bg-blue-900/40 hover:bg-blue-900/60 border border-blue-700/50 rounded-lg px-4 py-2.5 text-sm text-blue-300 font-medium transition-colors disabled:opacity-50"
          >
            {grafanaLoading ? (
              <span className="animate-spin">⟳</span>
            ) : (
              <span>⚡</span>
            )}
            Auto-fill from Grafana
          </button>

          <div className="border-t border-gray-800" />

          {/* Metrics grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "mau", label: "MAU (players)", placeholder: "e.g. 844" },
              { key: "activeBrands", label: "Active Brands", placeholder: "e.g. 12" },
              { key: "betsPlaced", label: "Bets Placed", placeholder: "e.g. 218700" },
              { key: "effectiveEdge", label: "Effective Edge (e.g. 0.031)", placeholder: "0.031 = 3.1%" },
              { key: "wager", label: "Wager (USD)", placeholder: "e.g. 1198000" },
              { key: "ggr", label: "GGR (USD)", placeholder: "e.g. 37138" },
              { key: "fees", label: "Platform Fees (USD)", placeholder: "e.g. 18569" },
            ].map(({ key, label, placeholder }) => (
              <div key={key} className={key === "wager" || key === "fees" ? "col-span-2" : ""}>
                <label className="block text-xs text-gray-400 mb-1">{label}</label>
                <input
                  type="number"
                  step="any"
                  value={(fields as Record<string, number>)[key] ?? ""}
                  onChange={(e) => set(key as keyof typeof fields, e.target.value)}
                  placeholder={placeholder}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            ))}
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-300 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 rounded-lg px-4 py-2.5 text-sm text-white font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? "Saving…" : "Save Month"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
