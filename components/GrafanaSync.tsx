"use client";

import { useState } from "react";

interface Props {
  onSynced: () => void;
}

export default function GrafanaSync({ onSynced }: Props) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  async function sync() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/grafana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month }),
      });
      const json = await res.json();
      if (res.ok) {
        setStatus({ ok: true, msg: `Synced ${json.saved.label} from Grafana` });
        onSynced();
      } else {
        setStatus({ ok: false, msg: json.hint ?? json.error ?? "Failed" });
      }
    } catch (e) {
      setStatus({ ok: false, msg: String(e) });
    } finally {
      setLoading(false);
    }
  }

  const MONTHS = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec",
  ];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
          Grafana Sync
        </span>
      </div>

      <p className="text-xs text-gray-500">
        Pull a month automatically from Grafana.{" "}
        <span className="text-gray-400">Requires API key in .env.local</span>
      </p>

      <div className="flex gap-2 items-center">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
        >
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
        />
        <button
          onClick={sync}
          disabled={loading}
          className="flex-1 bg-blue-700 hover:bg-blue-600 rounded-lg px-3 py-1.5 text-xs text-white font-semibold transition-colors disabled:opacity-50"
        >
          {loading ? "Syncing…" : "Sync"}
        </button>
      </div>

      {status && (
        <p
          className={`text-xs ${
            status.ok ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {status.ok ? "✓" : "✗"} {status.msg}
        </p>
      )}
    </div>
  );
}
