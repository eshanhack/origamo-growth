"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Search, Plus, X, GripVertical, ExternalLink, MessageSquare, Clock,
  Filter, LayoutGrid, Table2, BarChart3, ChevronRight, ChevronDown,
  Upload, Download, Trash2, Edit3, Check, AlertTriangle, Globe,
  Send, Tag, Users, Building2, CalendarDays, Hash, DollarSign, Loader2,
  ArrowUpDown, ScanSearch, Activity, RefreshCw, Settings
} from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// ════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════
type BrandStatus = "live" | "confirmed" | "pending" | "churned" | "lost";
type Aggregator = string;
type LobbyStatus = "Featured" | "Visible" | "Buried" | "Not Found" | "Unknown";
type ViewMode = "kanban" | "table" | "dashboard";

interface AppSettings {
  aggregators: string[];
  gameLibrary: string[];
  stallingDaysPending: number;
  stallingDaysConfirmed: number;
  defaultStatus: BrandStatus;
}

interface Note {
  id: string;
  text: string;
  timestamp: string;
  auto?: boolean;
}

interface Brand {
  id: string;
  name: string;
  url: string;
  logoUrl?: string;
  status: BrandStatus;
  aggregator: Aggregator;
  aggregatorOther?: string;
  contactName?: string;
  contactEmail?: string;
  contactTelegram?: string;
  dateAdded: string;
  dateConfirmed?: string;
  dateLive?: string;
  notes: Note[];
  tags: string[];
  lobbyStatus: LobbyStatus;
  lobbyLastChecked?: string;
  gamesDeployed?: number;
  games?: string[];
  monthlyHandle?: number;
  monthlyGGR?: number;
}

interface ActivityEntry {
  id: string;
  brandName: string;
  action: string;
  timestamp: string;
}

// ════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════
const STATUSES: BrandStatus[] = ["live", "confirmed", "pending", "churned", "lost"];
const DEFAULT_AGGREGATORS: string[] = ["Hub88", "Softswiss", "Direct API", "Other"];
const LOBBY_STATUSES: LobbyStatus[] = ["Featured", "Visible", "Buried", "Not Found", "Unknown"];

const DEFAULT_SETTINGS: AppSettings = {
  aggregators: DEFAULT_AGGREGATORS,
  gameLibrary: [],
  stallingDaysPending: 30,
  stallingDaysConfirmed: 14,
  defaultStatus: "pending",
};

const STATUS_CONFIG: Record<BrandStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  live:      { label: "Live",      color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30", dot: "bg-green-400" },
  confirmed: { label: "Confirmed", color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/30",  dot: "bg-blue-400" },
  pending:   { label: "Pending",   color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/30", dot: "bg-amber-400" },
  churned:   { label: "Churned",   color: "text-gray-400",   bg: "bg-gray-500/10",   border: "border-gray-500/30",  dot: "bg-gray-400" },
  lost:      { label: "Lost",      color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30",   dot: "bg-red-400" },
};

const LOBBY_CONFIG: Record<LobbyStatus, { color: string; bg: string }> = {
  Featured:  { color: "text-green-400",  bg: "bg-green-500/10" },
  Visible:   { color: "text-blue-400",   bg: "bg-blue-500/10" },
  Buried:    { color: "text-amber-400",  bg: "bg-amber-500/10" },
  "Not Found": { color: "text-red-400",  bg: "bg-red-500/10" },
  Unknown:   { color: "text-gray-400",   bg: "bg-gray-500/10" },
};

const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtDateTime = (d: string) => new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const fmtCurrency = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n}`;
const daysBetween = (a: string, b: string) => Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

function getDaysInStage(brand: Brand): number {
  const ref = brand.status === "live" ? brand.dateLive
    : brand.status === "confirmed" ? brand.dateConfirmed
    : brand.dateAdded;
  return daysBetween(ref || brand.dateAdded, now());
}

function isStalling(brand: Brand, settings: AppSettings = currentSettings): boolean {
  const days = getDaysInStage(brand);
  return (brand.status === "pending" && days > settings.stallingDaysPending) || (brand.status === "confirmed" && days > settings.stallingDaysConfirmed);
}

function domainFromUrl(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

// ════════════════════════════════════════════════════════════════════
// STORAGE
// ════════════════════════════════════════════════════════════════════
const STORAGE_KEY_BRANDS = "origamo-brands-v2";
const STORAGE_KEY_LOG = "origamo-activity-log";
const STORAGE_KEY_SETTINGS = "origamo-settings-v1";

// Module-level settings ref so sub-components can read current settings without prop drilling
let currentSettings: AppSettings = DEFAULT_SETTINGS;

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveToStorage(key: string, data: unknown) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* quota */ }
}

// ════════════════════════════════════════════════════════════════════
// SEED DATA — existing brands migrated + demo brands
// ════════════════════════════════════════════════════════════════════
function buildSeedBrands(): Brand[] {
  const d = "2025-01-15T00:00:00Z";
  const seeds: Partial<Brand>[] = [
    // Demo brands with full data
    { name: "Shuffle.com", url: "https://shuffle.com", status: "live", aggregator: "Direct API", lobbyStatus: "Featured", dateLive: "2025-02-01T00:00:00Z", tags: ["crypto-only", "tier-1"], gamesDeployed: 8 },
    { name: "Stake.com", url: "https://stake.com", status: "pending", aggregator: "Hub88", lobbyStatus: "Unknown", tags: ["tier-1", "high-priority"], notes: [{ id: uid(), text: "Awaiting compliance docs", timestamp: "2025-03-01T10:00:00Z" }] },
    { name: "BCGame", url: "https://bc.game", status: "live", aggregator: "Softswiss", lobbyStatus: "Visible", dateLive: "2025-01-20T00:00:00Z", tags: ["crypto-only"], gamesDeployed: 6 },
    { name: "Roobet", url: "https://roobet.com", status: "confirmed", aggregator: "Hub88", lobbyStatus: "Unknown", dateConfirmed: "2025-03-05T00:00:00Z", tags: ["high-priority"], notes: [{ id: uid(), text: "Integration scheduled for next week", timestamp: "2025-03-05T14:00:00Z" }] },
    { name: "Duelbits", url: "https://duelbits.com", status: "pending", aggregator: "Softswiss", lobbyStatus: "Unknown", tags: ["crypto-only"], notes: [{ id: uid(), text: "Technical blocker — API version mismatch", timestamp: "2025-02-10T09:00:00Z" }] },

    // Migrated from old system — live brands
    ...[
      "CSGO500|csgo500.com", "Metaspins|metaspins.com", "DegenCity|degencity.com", "Kirgo|kirgo.com",
      "Vave|vave.com", "Tigrabit|tigrabit.com", "Cloudbet|cloudbet.com", "Menace|menace.com",
      "Respin|respin.com", "EpicBet|epicbet.com", "Sportsbet.io|sportsbet.io", "CasinoMega|casinomega.com",
      "RollHub|rollhub.com", "Biggg|biggg.com", "Bitcasino|bitcasino.io", "BetBaba|betbaba.com",
      "Akcebet|akcebet.com", "Gamblr|gamblr.com", "Kiekka|kiekka.com", "Betivo|betivo.com",
      "BetBolt|betbolt.com", "PEC Bet|pec.bet", "Kings.game|kings.game", "EfesCasino|efescasino.com",
      "Rivalry|rivalry.com", "Spiidi|spiidi.com", "SolPengu|solpengu.com", "Shokker|shokker.com",
      "Gambana|gambana.com", "Drizzle|drizzle.bet", "Baywin|baywin.com",
      "Sultanbet|sultanbet.com", "Spinbet|spinbet.com", "Spinbit|spinbit.com", "Lilibet|lilibet.com",
      "Spinnaus|spinnaus.com", "Chanced|chanced.com", "Punt|punt.com", "Gold Rush City|goldrushcity.com",
      "PickleBet|picklebet.com",
    ].map((s) => {
      const [name, domain] = s.split("|");
      return { name, url: `https://${domain}`, status: "live" as BrandStatus, aggregator: "Hub88" as Aggregator, lobbyStatus: "Unknown" as LobbyStatus, dateLive: d, tags: [] };
    }),

    // Migrated — pending/confirmed brands
    ...[
      "Bovada|bovada.lv", "Bodog|bodog.eu", "BetTurkey|betturkey.com", "Bahis|bahis.com",
      "Matadorbet|matadorbet.com", "Onwin|onwin.com", "Sahabet|sahabet.com", "Fixbet|fixbet.com",
      "Zbahis|zbahis.com", "Hondubet|hondubet.com", "Sivarbet|sivarbet.com",
      "Parimatch|parimatch.com", "NairaBet|nairabet.com", "Kirgo.us|kirgo.us",
      "Winna|winna.com", "Bluff|bluff.com", "Minebit|minebit.com", "DailySpins|dailyspins.com",
      "Bombastic|bombastic.com", "Ember|emberfund.io",
      "Sportingbet|sportingbet.com", "Entain|entaingroup.com",
      "Scatter|ui.scatter-fe.pages.dev",
    ].map((s) => {
      const [name, domain] = s.split("|");
      return { name, url: `https://${domain}`, status: "pending" as BrandStatus, aggregator: "Hub88" as Aggregator, lobbyStatus: "Unknown" as LobbyStatus, tags: [] };
    }),
  ];

  return seeds.map((s) => ({
    id: uid(),
    name: s.name!,
    url: s.url!,
    logoUrl: s.logoUrl,
    status: s.status || "pending",
    aggregator: s.aggregator || "Hub88",
    contactName: s.contactName,
    contactEmail: s.contactEmail,
    contactTelegram: s.contactTelegram,
    dateAdded: s.dateAdded || d,
    dateConfirmed: s.dateConfirmed,
    dateLive: s.dateLive,
    notes: s.notes || [],
    tags: s.tags || [],
    lobbyStatus: s.lobbyStatus || "Unknown",
    gamesDeployed: s.gamesDeployed,
    monthlyHandle: s.monthlyHandle,
    monthlyGGR: s.monthlyGGR,
  }));
}

// ════════════════════════════════════════════════════════════════════
// BRAND AVATAR
// ════════════════════════════════════════════════════════════════════
function BrandAvatar({ brand, size = "md" }: { brand: Brand; size?: "sm" | "md" | "lg" }) {
  const [imgErr, setImgErr] = useState(false);
  const sz = size === "sm" ? "w-8 h-8" : size === "lg" ? "w-14 h-14" : "w-10 h-10";
  const textSz = size === "sm" ? "text-xs" : size === "lg" ? "text-xl" : "text-sm";

  const domain = domainFromUrl(brand.url);
  const srcs = [
    brand.logoUrl,
    `https://logo.clearbit.com/${domain}`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
  ].filter(Boolean) as string[];

  const [srcIdx, setSrcIdx] = useState(0);

  if (imgErr || srcs.length === 0) {
    const colors = ["bg-violet-600", "bg-blue-600", "bg-emerald-600", "bg-amber-600", "bg-rose-600", "bg-cyan-600"];
    const c = colors[brand.name.charCodeAt(0) % colors.length];
    return (
      <div className={`${sz} ${c} rounded-lg flex items-center justify-center shrink-0`}>
        <span className={`${textSz} font-bold text-white`}>{brand.name.charAt(0).toUpperCase()}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={srcs[srcIdx]}
      src={srcs[srcIdx]}
      alt={brand.name}
      className={`${sz} rounded-lg object-contain bg-white shrink-0`}
      onError={() => {
        if (srcIdx + 1 < srcs.length) setSrcIdx(srcIdx + 1);
        else setImgErr(true);
      }}
    />
  );
}

// ════════════════════════════════════════════════════════════════════
// STATUS BADGE
// ════════════════════════════════════════════════════════════════════
function StatusBadge({ status, small }: { status: BrandStatus; small?: boolean }) {
  const c = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 ${small ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"} rounded-full font-semibold uppercase tracking-wider ${c.bg} ${c.color} border ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${status === "live" ? "animate-pulse" : ""}`} />
      {c.label}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════
// DAYS BADGE
// ════════════════════════════════════════════════════════════════════
function DaysBadge({ brand }: { brand: Brand }) {
  const days = getDaysInStage(brand);
  const stalling = isStalling(brand);
  if (brand.status === "churned" || brand.status === "lost") return null;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium
      ${stalling ? "bg-red-500/15 text-red-400 border border-red-500/30" : "bg-gray-800 text-gray-500"}`}>
      {stalling && <AlertTriangle className="w-2.5 h-2.5" />}
      {days}d
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════
// LOBBY BADGE
// ════════════════════════════════════════════════════════════════════
function LobbyBadge({ status }: { status: LobbyStatus }) {
  const c = LOBBY_CONFIG[status];
  return <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${c.bg} ${c.color}`}>{status}</span>;
}

// ════════════════════════════════════════════════════════════════════
// ADD BRAND MODAL
// ════════════════════════════════════════════════════════════════════
function AddBrandModal({ open, onClose, onAdd, existingNames, aggregators, defaultStatus }: {
  open: boolean; onClose: () => void; onAdd: (b: Brand) => void; existingNames: Set<string>; aggregators: string[]; defaultStatus: BrandStatus;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<BrandStatus>(defaultStatus);
  const [aggregator, setAggregator] = useState<Aggregator>(aggregators[0] || "Hub88");
  const [aggOther, setAggOther] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactTg, setContactTg] = useState("");
  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!open) return null;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Required";
    if (existingNames.has(name.trim().toLowerCase())) e.name = "Brand already exists";
    if (!url.trim()) e.url = "Required";
    else { try { new URL(url); } catch { e.url = "Invalid URL"; } }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    const n = now();
    const brand: Brand = {
      id: uid(),
      name: name.trim(),
      url: url.trim(),
      status,
      aggregator,
      aggregatorOther: aggregator === "Other" ? aggOther : undefined,
      contactName: contactName || undefined,
      contactEmail: contactEmail || undefined,
      contactTelegram: contactTg || undefined,
      dateAdded: n,
      dateConfirmed: status === "confirmed" || status === "live" ? n : undefined,
      dateLive: status === "live" ? n : undefined,
      notes: [
        { id: uid(), text: "Brand added", timestamp: n, auto: true },
        ...(note.trim() ? [{ id: uid(), text: note.trim(), timestamp: n }] : []),
      ],
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      lobbyStatus: "Unknown",
    };
    onAdd(brand);
    onClose();
    setName(""); setUrl(""); setStatus(defaultStatus); setAggregator(aggregators[0] || "Hub88"); setAggOther("");
    setContactName(""); setContactEmail(""); setContactTg(""); setTags(""); setNote("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#111] border border-gray-800 rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Add Brand</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Brand Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className={`w-full bg-gray-900 border ${errors.name ? "border-red-500" : "border-gray-700"} rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#CCFF00]/50`}
              placeholder="e.g. Shuffle.com" />
            {errors.name && <p className="text-red-400 text-[10px] mt-1">{errors.name}</p>}
          </div>
          {/* URL */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Website URL *</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)}
              className={`w-full bg-gray-900 border ${errors.url ? "border-red-500" : "border-gray-700"} rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#CCFF00]/50`}
              placeholder="https://example.com" />
            {errors.url && <p className="text-red-400 text-[10px] mt-1">{errors.url}</p>}
          </div>
          {/* Status + Aggregator */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Status *</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as BrandStatus)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#CCFF00]/50">
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Aggregator *</label>
              <select value={aggregator} onChange={(e) => setAggregator(e.target.value as Aggregator)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#CCFF00]/50">
                {aggregators.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          {aggregator === "Other" && (
            <input value={aggOther} onChange={(e) => setAggOther(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#CCFF00]/50"
              placeholder="Specify aggregator..." />
          )}
          {/* Contact */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Contact (optional)</label>
            <div className="grid grid-cols-3 gap-2">
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Name" className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#CCFF00]/50" />
              <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Email" className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#CCFF00]/50" />
              <input value={contactTg} onChange={(e) => setContactTg(e.target.value)} placeholder="Telegram" className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#CCFF00]/50" />
            </div>
          </div>
          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Tags (comma-separated)</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#CCFF00]/50"
              placeholder="crypto-only, tier-1, high-priority" />
          </div>
          {/* Note */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Initial Note (optional)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#CCFF00]/50 resize-none"
              placeholder="Integration blockers, config notes..." />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={submit} className="px-4 py-2 rounded-lg text-sm font-medium bg-[#CCFF00] text-black hover:bg-[#b8e600] transition-colors">Add Brand</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// CSV IMPORT MODAL
// ════════════════════════════════════════════════════════════════════
function CSVImportModal({ open, onClose, onImport, aggregators }: { open: boolean; onClose: () => void; onImport: (brands: Brand[]) => void; aggregators: string[] }) {
  const [csv, setCsv] = useState("");

  if (!open) return null;

  const doImport = () => {
    const lines = csv.trim().split("\n").filter((l) => l.trim());
    const brands: Brand[] = [];
    for (const line of lines) {
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length < 2) continue;
      const [name, website, agg, stat] = parts;
      const n = now();
      brands.push({
        id: uid(), name, url: website.startsWith("http") ? website : `https://${website}`,
        status: (stat?.toLowerCase() as BrandStatus) || "pending",
        aggregator: (aggregators.includes(agg) ? agg : aggregators[0] || "Hub88") as Aggregator,
        dateAdded: n, notes: [{ id: uid(), text: "Imported via CSV", timestamp: n, auto: true }],
        tags: [], lobbyStatus: "Unknown",
      });
    }
    onImport(brands);
    onClose();
    setCsv("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#111] border border-gray-800 rounded-2xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Import CSV</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <p className="text-xs text-gray-500">Format: <code className="text-gray-400">name, website, aggregator, status</code> (one per line)</p>
          <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={8}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#CCFF00]/50 resize-none"
            placeholder={"Shuffle, shuffle.com, Direct API, live\nStake, stake.com, Hub88, pending"} />
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white">Cancel</button>
          <button onClick={doImport} className="px-4 py-2 rounded-lg text-sm font-medium bg-[#CCFF00] text-black hover:bg-[#b8e600]">Import</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// BRAND DETAIL PANEL
// ════════════════════════════════════════════════════════════════════
function BrandDetailPanel({ brand, onClose, onUpdate, onDelete, onAddActivity, aggregators, gameLibrary }: {
  brand: Brand; onClose: () => void; onUpdate: (b: Brand) => void; onDelete: (id: string) => void; onAddActivity: (a: Omit<ActivityEntry, "id" | "timestamp">) => void; aggregators: string[]; gameLibrary: string[];
}) {
  const [newNote, setNewNote] = useState("");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const addNote = () => {
    if (!newNote.trim()) return;
    const n: Note = { id: uid(), text: newNote.trim(), timestamp: now() };
    onUpdate({ ...brand, notes: [...brand.notes, n] });
    onAddActivity({ brandName: brand.name, action: `Note added: "${newNote.trim().slice(0, 50)}..."` });
    setNewNote("");
  };

  const changeStatus = (s: BrandStatus) => {
    const old = brand.status;
    const updates: Partial<Brand> = { status: s };
    if (s === "confirmed" && !brand.dateConfirmed) updates.dateConfirmed = now();
    if (s === "live" && !brand.dateLive) updates.dateLive = now();
    const autoNote: Note = { id: uid(), text: `Status changed from ${STATUS_CONFIG[old].label} → ${STATUS_CONFIG[s].label}`, timestamp: now(), auto: true };
    onUpdate({ ...brand, ...updates, notes: [...brand.notes, autoNote] });
    onAddActivity({ brandName: brand.name, action: `Status: ${STATUS_CONFIG[old].label} → ${STATUS_CONFIG[s].label}` });
  };

  const scanLobby = async () => {
    setScanning(true);
    try {
      const resp = await fetch("/api/scan-lobby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: brand.url, brandName: brand.name }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const autoNote: Note = { id: uid(), text: `Lobby scan: ${data.summary || data.prominence}`, timestamp: now(), auto: true };
        onUpdate({
          ...brand,
          lobbyStatus: data.prominence || brand.lobbyStatus,
          lobbyLastChecked: now(),
          notes: [...brand.notes, autoNote],
        });
        onAddActivity({ brandName: brand.name, action: `Lobby scanned: ${data.prominence}` });
      }
    } catch { /* scan failed silently */ }
    setScanning(false);
  };

  const updateField = <K extends keyof Brand>(key: K, value: Brand[K]) => {
    onUpdate({ ...brand, [key]: value });
    setEditingField(null);
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-[#0d0d0d] border-l border-gray-800 overflow-y-auto animate-slide-in">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0d0d0d]/95 backdrop-blur-sm border-b border-gray-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <BrandAvatar brand={brand} size="lg" />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white truncate">{brand.name}</h2>
              <a href={brand.url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-[#CCFF00] flex items-center gap-1">
                {domainFromUrl(brand.url)} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <button onClick={() => { if (confirm(`Delete "${brand.name}"? This cannot be undone.`)) onDelete(brand.id); }}
              className="text-gray-600 hover:text-red-400 transition-colors" title="Delete brand"><Trash2 className="w-4 h-4" /></button>
            <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Status */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-2">Status</label>
            <div className="flex gap-2 flex-wrap">
              {STATUSES.map((s) => (
                <button key={s} onClick={() => changeStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                    ${brand.status === s ? `${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].color} ${STATUS_CONFIG[s].border}` : "border-gray-800 text-gray-500 hover:border-gray-600"}`}>
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-2">
              <DaysBadge brand={brand} />
              {isStalling(brand) && <span className="text-[10px] text-red-400 font-medium">Stalling — needs attention</span>}
            </div>
          </div>

          {/* Key details grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1.5">Aggregator</label>
              <select value={brand.aggregator} onChange={(e) => updateField("aggregator", e.target.value as Aggregator)}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-[#CCFF00]/50">
                {aggregators.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1.5">Lobby Status</label>
              <div className="flex items-center gap-2">
                <select value={brand.lobbyStatus} onChange={(e) => updateField("lobbyStatus", e.target.value as LobbyStatus)}
                  className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-[#CCFF00]/50">
                  {LOBBY_STATUSES.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                <button onClick={scanLobby} disabled={scanning} title="Scan Lobby"
                  className="p-1.5 rounded-lg border border-gray-800 text-gray-500 hover:text-[#CCFF00] hover:border-[#CCFF00]/30 disabled:opacity-50">
                  {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
                </button>
              </div>
              {brand.lobbyLastChecked && <p className="text-[9px] text-gray-600 mt-1">Last: {fmtDateTime(brand.lobbyLastChecked)}</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                Games Deployed {brand.games?.length ? `(${brand.games.length})` : ""}
              </label>
              {gameLibrary.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {gameLibrary.map((g) => {
                    const active = brand.games?.includes(g);
                    return (
                      <button key={g} onClick={() => {
                        const current = brand.games || [];
                        const next = active ? current.filter((x) => x !== g) : [...current, g];
                        onUpdate({ ...brand, games: next, gamesDeployed: next.length });
                      }}
                        className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-all
                          ${active ? "bg-[#CCFF00]/10 border-[#CCFF00]/30 text-[#CCFF00]" : "bg-gray-900 border-gray-800 text-gray-500 hover:border-gray-600"}`}>
                        {active && <Check className="w-2.5 h-2.5 inline mr-0.5" />}{g}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div>
                  <input type="number" value={brand.gamesDeployed ?? ""} onChange={(e) => updateField("gamesDeployed", e.target.value ? parseInt(e.target.value) : undefined)}
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-[#CCFF00]/50" placeholder="0" />
                  <p className="text-[9px] text-gray-600 mt-1">Add games in Settings to pick specific titles.</p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1.5">Monthly Handle</label>
              <input type="number" value={brand.monthlyHandle ?? ""} onChange={(e) => updateField("monthlyHandle", e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-[#CCFF00]/50" placeholder="$0" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1.5">Monthly GGR</label>
              <input type="number" value={brand.monthlyGGR ?? ""} onChange={(e) => updateField("monthlyGGR", e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-[#CCFF00]/50" placeholder="$0" />
            </div>
          </div>

          {/* Contact */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-2">Contact</label>
            <div className="grid grid-cols-3 gap-2">
              <input value={brand.contactName ?? ""} onChange={(e) => updateField("contactName", e.target.value || undefined)} placeholder="Name"
                className="bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-[#CCFF00]/50" />
              <input value={brand.contactEmail ?? ""} onChange={(e) => updateField("contactEmail", e.target.value || undefined)} placeholder="Email"
                className="bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-[#CCFF00]/50" />
              <input value={brand.contactTelegram ?? ""} onChange={(e) => updateField("contactTelegram", e.target.value || undefined)} placeholder="@telegram"
                className="bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-[#CCFF00]/50" />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-2">Tags</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {brand.tags.map((t, i) => (
                <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-800 text-gray-300 border border-gray-700">
                  {t}
                  <button onClick={() => updateField("tags", brand.tags.filter((_, j) => j !== i))} className="text-gray-600 hover:text-red-400"><X className="w-2.5 h-2.5" /></button>
                </span>
              ))}
            </div>
            <input placeholder="Add tag (press Enter)" className="w-full bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-[#CCFF00]/50"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = (e.target as HTMLInputElement).value.trim();
                  if (val && !brand.tags.includes(val)) { updateField("tags", [...brand.tags, val]); (e.target as HTMLInputElement).value = ""; }
                }
              }} />
          </div>

          {/* Dates */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-2">Timeline</label>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-gray-400"><CalendarDays className="w-3.5 h-3.5 text-gray-600" /> Added: {fmtDate(brand.dateAdded)}</div>
              {brand.dateConfirmed && <div className="flex items-center gap-2 text-blue-400"><Check className="w-3.5 h-3.5" /> Confirmed: {fmtDate(brand.dateConfirmed)}</div>}
              {brand.dateLive && <div className="flex items-center gap-2 text-green-400"><Globe className="w-3.5 h-3.5" /> Live: {fmtDate(brand.dateLive)}</div>}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-2">Notes</label>
            <div className="space-y-2 mb-3 max-h-[300px] overflow-y-auto">
              {brand.notes.length === 0 && <p className="text-xs text-gray-600 italic">No notes yet</p>}
              {[...brand.notes].reverse().map((n) => (
                <div key={n.id} className={`px-3 py-2 rounded-lg text-xs ${n.auto ? "bg-gray-900/50 border border-gray-800/50" : "bg-gray-900 border border-gray-800"}`}>
                  <p className={`${n.auto ? "text-gray-500 italic" : "text-gray-300"}`}>{n.text}</p>
                  <p className="text-[9px] text-gray-600 mt-1">{fmtDateTime(n.timestamp)}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add a note..."
                className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#CCFF00]/50"
                onKeyDown={(e) => e.key === "Enter" && addNote()} />
              <button onClick={addNote} className="px-3 py-2 rounded-lg bg-[#CCFF00] text-black hover:bg-[#b8e600] transition-colors"><Send className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// KANBAN VIEW
// ════════════════════════════════════════════════════════════════════
function KanbanView({ brands, onSelectBrand, onStatusChange }: {
  brands: Brand[];
  onSelectBrand: (b: Brand) => void;
  onStatusChange: (brandId: string, newStatus: BrandStatus) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<BrandStatus | null>(null);

  const columns = useMemo(() => {
    const map: Record<BrandStatus, Brand[]> = { live: [], confirmed: [], pending: [], churned: [], lost: [] };
    brands.forEach((b) => map[b.status].push(b));
    return map;
  }, [brands]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
      {STATUSES.map((status) => {
        const cfg = STATUS_CONFIG[status];
        const col = columns[status];
        return (
          <div key={status}
            className={`flex-1 min-w-[260px] max-w-[340px] rounded-xl border transition-all
              ${dragOver === status ? "border-[#CCFF00]/40 bg-[#CCFF00]/5" : "border-gray-800 bg-gray-900/20"}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(status); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => { if (dragId) { onStatusChange(dragId, status); setDragId(null); setDragOver(null); } }}>
            {/* Column header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800/50">
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
              <span className="ml-auto text-[10px] text-gray-600 font-medium">{col.length}</span>
            </div>
            {/* Cards */}
            <div className="p-2 space-y-2 min-h-[100px]">
              {col.map((brand) => (
                <div key={brand.id} draggable
                  onDragStart={() => setDragId(brand.id)}
                  onDragEnd={() => { setDragId(null); setDragOver(null); }}
                  onClick={() => onSelectBrand(brand)}
                  className={`group bg-[#111] border border-gray-800 rounded-xl p-3 cursor-pointer transition-all duration-150
                    hover:border-gray-600 hover:shadow-lg ${dragId === brand.id ? "opacity-50" : ""}`}>
                  <div className="flex items-start gap-2.5">
                    <BrandAvatar brand={brand} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-semibold text-white truncate group-hover:text-[#CCFF00] transition-colors">{brand.name}</h4>
                        <a href={brand.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                          className="text-gray-700 hover:text-gray-400 shrink-0"><ExternalLink className="w-3 h-3" /></a>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-800 text-gray-400">{brand.aggregator}</span>
                        <LobbyBadge status={brand.lobbyStatus} />
                        <DaysBadge brand={brand} />
                      </div>
                    </div>
                    <GripVertical className="w-3.5 h-3.5 text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5 cursor-grab" />
                  </div>
                  {brand.notes.length > 0 && (
                    <p className="text-[10px] text-gray-600 mt-2 truncate pl-[42px]">
                      <MessageSquare className="w-2.5 h-2.5 inline mr-1" />
                      {brand.notes[brand.notes.length - 1].text}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// TABLE VIEW
// ════════════════════════════════════════════════════════════════════
function TableView({ brands, onSelectBrand }: { brands: Brand[]; onSelectBrand: (b: Brand) => void }) {
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const sorted = useMemo(() => {
    const arr = [...brands];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "status": cmp = STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status); break;
        case "aggregator": cmp = a.aggregator.localeCompare(b.aggregator); break;
        case "days": cmp = getDaysInStage(a) - getDaysInStage(b); break;
        case "lobby": cmp = a.lobbyStatus.localeCompare(b.lobbyStatus); break;
        case "dateAdded": cmp = new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime(); break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [brands, sortKey, sortAsc]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const Th = ({ k, children }: { k: string; children: React.ReactNode }) => (
    <th className="text-left px-3 py-2.5 cursor-pointer hover:text-gray-300 transition-colors group" onClick={() => toggleSort(k)}>
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
        {children}
        <ArrowUpDown className={`w-3 h-3 ${sortKey === k ? "text-[#CCFF00]" : "text-gray-700 group-hover:text-gray-500"}`} />
      </span>
    </th>
  );

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500">
              <Th k="name">Name</Th>
              <Th k="status">Status</Th>
              <Th k="aggregator">Aggregator</Th>
              <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">Contact</th>
              <Th k="days">Days</Th>
              <Th k="lobby">Lobby</Th>
              <Th k="dateAdded">Added</Th>
              <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">Last Note</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((brand) => (
              <tr key={brand.id} onClick={() => onSelectBrand(brand)}
                className="border-b border-gray-800/50 hover:bg-gray-900/40 cursor-pointer transition-colors">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <BrandAvatar brand={brand} size="sm" />
                    <div>
                      <span className="text-sm font-medium text-white">{brand.name}</span>
                      <div className="flex gap-1 mt-0.5">
                        {brand.tags.slice(0, 2).map((t) => (
                          <span key={t} className="text-[8px] px-1 py-0 rounded bg-gray-800 text-gray-500">{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5"><StatusBadge status={brand.status} small /></td>
                <td className="px-3 py-2.5 text-xs text-gray-400">{brand.aggregator}</td>
                <td className="px-3 py-2.5 text-xs text-gray-500 truncate max-w-[120px]">{brand.contactName || "—"}</td>
                <td className="px-3 py-2.5"><DaysBadge brand={brand} /></td>
                <td className="px-3 py-2.5"><LobbyBadge status={brand.lobbyStatus} /></td>
                <td className="px-3 py-2.5 text-xs text-gray-500">{fmtDate(brand.dateAdded)}</td>
                <td className="px-3 py-2.5 text-[11px] text-gray-600 truncate max-w-[180px]">
                  {brand.notes.length > 0 ? brand.notes[brand.notes.length - 1].text : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// DASHBOARD VIEW
// ════════════════════════════════════════════════════════════════════
const CHART_COLORS = ["#4ade80", "#60a5fa", "#fbbf24", "#9ca3af", "#f87171"];
const AGG_COLORS = ["#CCFF00", "#60a5fa", "#f59e0b", "#a78bfa"];

function DashboardView({ brands, activity, onSelectBrand, aggregators }: {
  brands: Brand[]; activity: ActivityEntry[]; onSelectBrand: (b: Brand) => void; aggregators: string[];
}) {
  const statusData = STATUSES.map((s, i) => ({
    name: STATUS_CONFIG[s].label,
    value: brands.filter((b) => b.status === s).length,
    color: CHART_COLORS[i],
  })).filter((d) => d.value > 0);

  const aggData = aggregators.map((a, i) => ({
    name: a,
    count: brands.filter((b) => b.aggregator === a).length,
    color: AGG_COLORS[i],
  })).filter((d) => d.count > 0);

  const stalling = brands.filter((b) => isStalling(b));
  const recentActivity = activity.slice(-10).reverse();

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {STATUSES.map((s) => {
          const count = brands.filter((b) => b.status === s).length;
          const cfg = STATUS_CONFIG[s];
          return (
            <div key={s} className={`flex flex-col items-center justify-center px-4 py-4 rounded-xl border ${cfg.border} ${cfg.bg}`}>
              <span className={`text-2xl font-bold ${cfg.color}`}>{count}</span>
              <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mt-1">{cfg.label}</span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status pie */}
        <div className="bg-[#111] border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Brands by Status</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                {statusData.map((d, i) => <Cell key={i} fill={d.color} stroke="transparent" />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#111", border: "1px solid #333", borderRadius: "8px", fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {statusData.map((d) => (
              <span key={d.name} className="flex items-center gap-1.5 text-[10px] text-gray-400">
                <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                {d.name}
              </span>
            ))}
          </div>
        </div>

        {/* Aggregator bar */}
        <div className="bg-[#111] border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Brands by Aggregator</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={aggData} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" tick={{ fill: "#666", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#999", fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip contentStyle={{ background: "#111", border: "1px solid #333", borderRadius: "8px", fontSize: "12px" }} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {aggData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stalling alerts */}
        <div className="bg-[#111] border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" /> Stalling Brands ({stalling.length})
          </h3>
          {stalling.length === 0 ? (
            <p className="text-xs text-gray-600 italic">No stalling brands</p>
          ) : (
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {stalling.map((b) => (
                <button key={b.id} onClick={() => onSelectBrand(b)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/5 hover:border-red-500/40 transition-all text-left">
                  <BrandAvatar brand={b} size="sm" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-white truncate block">{b.name}</span>
                    <span className="text-[10px] text-gray-500">{STATUS_CONFIG[b.status].label} for {getDaysInStage(b)} days</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Activity feed */}
        <div className="bg-[#111] border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#CCFF00]" /> Recent Activity
          </h3>
          {recentActivity.length === 0 ? (
            <p className="text-xs text-gray-600 italic">No activity yet</p>
          ) : (
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {recentActivity.map((a) => (
                <div key={a.id} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-gray-900/50">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] mt-1.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-300"><span className="font-medium text-white">{a.brandName}</span> — {a.action}</p>
                    <p className="text-[9px] text-gray-600">{fmtDateTime(a.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// SETTINGS MODAL
// ════════════════════════════════════════════════════════════════════
function SettingsModal({ open, onClose, settings, onSave }: {
  open: boolean; onClose: () => void; settings: AppSettings; onSave: (s: AppSettings) => void;
}) {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [newAgg, setNewAgg] = useState("");
  const [newGame, setNewGame] = useState("");
  const [tab, setTab] = useState<"aggregators" | "games" | "alerts">("aggregators");

  useEffect(() => { if (open) setDraft(settings); }, [open, settings]);

  if (!open) return null;

  const addAggregator = () => {
    const v = newAgg.trim();
    if (!v || draft.aggregators.includes(v)) return;
    setDraft({ ...draft, aggregators: [...draft.aggregators, v] });
    setNewAgg("");
  };

  const removeAggregator = (a: string) => {
    if (DEFAULT_AGGREGATORS.includes(a)) return;
    setDraft({ ...draft, aggregators: draft.aggregators.filter((x) => x !== a) });
  };

  const addGame = () => {
    const v = newGame.trim();
    if (!v || draft.gameLibrary.includes(v)) return;
    setDraft({ ...draft, gameLibrary: [...draft.gameLibrary, v] });
    setNewGame("");
  };

  const removeGame = (g: string) => {
    setDraft({ ...draft, gameLibrary: draft.gameLibrary.filter((x) => x !== g) });
  };

  const save = () => { onSave(draft); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#111] border border-gray-800 rounded-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          {([["aggregators", "Aggregators"], ["games", "Game Library"], ["alerts", "Alerts & Defaults"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors
                ${tab === k ? "text-[#CCFF00] border-b-2 border-[#CCFF00]" : "text-gray-500 hover:text-gray-300"}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {/* Aggregators tab */}
          {tab === "aggregators" && (
            <>
              <p className="text-xs text-gray-500">Manage aggregator options available across the app. Default aggregators cannot be removed.</p>
              <div className="flex gap-2">
                <input value={newAgg} onChange={(e) => setNewAgg(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addAggregator()}
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#CCFF00]/50"
                  placeholder="New aggregator name..." />
                <button onClick={addAggregator}
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-[#CCFF00] text-black hover:bg-[#b8e600]">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1.5">
                {draft.aggregators.map((a) => (
                  <div key={a} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-900/60 border border-gray-800">
                    <span className="text-sm text-white">{a}</span>
                    {DEFAULT_AGGREGATORS.includes(a) ? (
                      <span className="text-[9px] text-gray-600 uppercase tracking-wider">Default</span>
                    ) : (
                      <button onClick={() => removeAggregator(a)} className="text-gray-600 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Game Library tab */}
          {tab === "games" && (
            <>
              <p className="text-xs text-gray-500">Define your game library. These games can then be assigned to each brand.</p>
              <div className="flex gap-2">
                <input value={newGame} onChange={(e) => setNewGame(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addGame()}
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#CCFF00]/50"
                  placeholder="New game name..." />
                <button onClick={addGame}
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-[#CCFF00] text-black hover:bg-[#b8e600]">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {draft.gameLibrary.length === 0 ? (
                <p className="text-xs text-gray-600 italic py-4 text-center">No games added yet. Add your games above.</p>
              ) : (
                <div className="space-y-1.5">
                  {draft.gameLibrary.map((g) => (
                    <div key={g} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-900/60 border border-gray-800">
                      <span className="text-sm text-white">{g}</span>
                      <button onClick={() => removeGame(g)} className="text-gray-600 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-gray-600">{draft.gameLibrary.length} game{draft.gameLibrary.length !== 1 ? "s" : ""} in library</p>
            </>
          )}

          {/* Alerts & Defaults tab */}
          {tab === "alerts" && (
            <>
              <p className="text-xs text-gray-500">Configure stalling alerts and default values for new brands.</p>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Stalling alert: Pending (days)</label>
                <input type="number" min={1} value={draft.stallingDaysPending} onChange={(e) => setDraft({ ...draft, stallingDaysPending: parseInt(e.target.value) || 30 })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#CCFF00]/50" />
                <p className="text-[10px] text-gray-600 mt-1">Brands in &quot;Pending&quot; longer than this will show a stalling warning.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Stalling alert: Confirmed (days)</label>
                <input type="number" min={1} value={draft.stallingDaysConfirmed} onChange={(e) => setDraft({ ...draft, stallingDaysConfirmed: parseInt(e.target.value) || 14 })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#CCFF00]/50" />
                <p className="text-[10px] text-gray-600 mt-1">Brands in &quot;Confirmed&quot; longer than this will show a stalling warning.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Default status for new brands</label>
                <select value={draft.defaultStatus} onChange={(e) => setDraft({ ...draft, defaultStatus: e.target.value as BrandStatus })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#CCFF00]/50">
                  {STATUSES.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                </select>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white">Cancel</button>
          <button onClick={save} className="px-4 py-2 rounded-lg text-sm font-medium bg-[#CCFF00] text-black hover:bg-[#b8e600]">Save</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════
export default function BrandsPortfolio() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<ViewMode>("kanban");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BrandStatus | "all">("all");
  const [aggFilter, setAggFilter] = useState<Aggregator | "all">("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [lobbyFilter, setLobbyFilter] = useState<LobbyStatus | "all">("all");
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Load data
  useEffect(() => {
    const stored = loadFromStorage<Brand[]>(STORAGE_KEY_BRANDS, []);
    if (stored.length > 0) {
      setBrands(stored);
    } else {
      setBrands(buildSeedBrands());
    }
    setActivity(loadFromStorage<ActivityEntry[]>(STORAGE_KEY_LOG, []));
    const loadedSettings = { ...DEFAULT_SETTINGS, ...loadFromStorage<Partial<AppSettings>>(STORAGE_KEY_SETTINGS, {}) };
    setSettings(loadedSettings);
    currentSettings = loadedSettings;
    setLoaded(true);
  }, []);

  // Persist
  useEffect(() => {
    if (loaded) saveToStorage(STORAGE_KEY_BRANDS, brands);
  }, [brands, loaded]);

  useEffect(() => {
    if (loaded) saveToStorage(STORAGE_KEY_LOG, activity);
  }, [activity, loaded]);

  useEffect(() => {
    if (loaded) saveToStorage(STORAGE_KEY_SETTINGS, settings);
    currentSettings = settings;
  }, [settings, loaded]);

  const aggregators = settings.aggregators;

  const addActivity = useCallback((a: Omit<ActivityEntry, "id" | "timestamp">) => {
    setActivity((prev) => [...prev, { ...a, id: uid(), timestamp: now() }]);
  }, []);

  const existingNames = useMemo(() => new Set(brands.map((b) => b.name.toLowerCase())), [brands]);

  // Filters
  const filtered = useMemo(() => {
    let result = [...brands];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((b) =>
        b.name.toLowerCase().includes(q) ||
        b.tags.some((t) => t.toLowerCase().includes(q)) ||
        b.notes.some((n) => n.text.toLowerCase().includes(q)) ||
        (b.contactName?.toLowerCase().includes(q)) ||
        (b.contactEmail?.toLowerCase().includes(q))
      );
    }
    if (statusFilter !== "all") result = result.filter((b) => b.status === statusFilter);
    if (aggFilter !== "all") result = result.filter((b) => b.aggregator === aggFilter);
    if (tagFilter) result = result.filter((b) => b.tags.includes(tagFilter));
    if (lobbyFilter !== "all") result = result.filter((b) => b.lobbyStatus === lobbyFilter);
    return result;
  }, [brands, search, statusFilter, aggFilter, tagFilter, lobbyFilter]);

  const allTags = useMemo(() => Array.from(new Set(brands.flatMap((b) => b.tags))).sort(), [brands]);

  const addBrand = (b: Brand) => {
    setBrands((prev) => [...prev, b]);
    addActivity({ brandName: b.name, action: "Brand added" });
  };

  const updateBrand = (b: Brand) => {
    setBrands((prev) => prev.map((x) => x.id === b.id ? b : x));
    if (selectedBrand?.id === b.id) setSelectedBrand(b);
  };

  const deleteBrand = (id: string) => {
    const brand = brands.find((b) => b.id === id);
    setBrands((prev) => prev.filter((b) => b.id !== id));
    setSelectedBrand(null);
    if (brand) addActivity({ brandName: brand.name, action: "Brand deleted" });
  };

  const handleStatusChange = (brandId: string, newStatus: BrandStatus) => {
    const brand = brands.find((b) => b.id === brandId);
    if (!brand || brand.status === newStatus) return;
    const old = brand.status;
    const updates: Partial<Brand> = { status: newStatus };
    if (newStatus === "confirmed" && !brand.dateConfirmed) updates.dateConfirmed = now();
    if (newStatus === "live" && !brand.dateLive) updates.dateLive = now();
    const autoNote: Note = { id: uid(), text: `Status changed from ${STATUS_CONFIG[old].label} → ${STATUS_CONFIG[newStatus].label}`, timestamp: now(), auto: true };
    updateBrand({ ...brand, ...updates, notes: [...brand.notes, autoNote] });
    addActivity({ brandName: brand.name, action: `Status: ${STATUS_CONFIG[old].label} → ${STATUS_CONFIG[newStatus].label}` });
  };

  const importBrands = (newBrands: Brand[]) => {
    setBrands((prev) => [...prev, ...newBrands]);
    newBrands.forEach((b) => addActivity({ brandName: b.name, action: "Imported via CSV" }));
  };

  const exportCSV = () => {
    const header = "Name,Website,Aggregator,Status,Contact,Tags,Lobby Status,Date Added\n";
    const rows = brands.map((b) =>
      `"${b.name}","${b.url}","${b.aggregator}","${b.status}","${b.contactName || ""}","${b.tags.join(";")}","${b.lobbyStatus}","${b.dateAdded}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "brands-export.csv"; a.click();
  };

  const resetData = () => {
    if (confirm("Reset all brand data to defaults? This cannot be undone.")) {
      const seed = buildSeedBrands();
      setBrands(seed);
      setActivity([{ id: uid(), brandName: "System", action: "Data reset to defaults", timestamp: now() }]);
    }
  };

  const activeFilterCount = [statusFilter !== "all", aggFilter !== "all", tagFilter !== null, lobbyFilter !== "all"].filter(Boolean).length;

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-0 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-900/60 border border-gray-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#CCFF00]/40"
            placeholder="Search brands, tags, notes..." />
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-gray-900/60 border border-gray-800 rounded-lg p-0.5">
          {([["kanban", LayoutGrid], ["table", Table2], ["dashboard", BarChart3]] as [ViewMode, typeof LayoutGrid][]).map(([v, Icon]) => (
            <button key={v} onClick={() => setView(v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                ${view === v ? "bg-[#CCFF00]/10 text-[#CCFF00]" : "text-gray-500 hover:text-gray-300"}`}>
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline capitalize">{v}</span>
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[#CCFF00] text-black hover:bg-[#b8e600] transition-colors">
            <Plus className="w-4 h-4" /> Add Brand
          </button>
          <button onClick={() => setShowImportModal(true)} className="p-2 rounded-lg border border-gray-800 text-gray-500 hover:text-white hover:border-gray-600 transition-all" title="Import CSV">
            <Upload className="w-4 h-4" />
          </button>
          <button onClick={exportCSV} className="p-2 rounded-lg border border-gray-800 text-gray-500 hover:text-white hover:border-gray-600 transition-all" title="Export CSV">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={resetData} className="p-2 rounded-lg border border-gray-800 text-gray-500 hover:text-red-400 hover:border-red-500/30 transition-all" title="Reset data">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowSettings(true)} className="p-2 rounded-lg border border-gray-800 text-gray-500 hover:text-[#CCFF00] hover:border-[#CCFF00]/30 transition-all" title="Settings">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Filter chips ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600">Filters</span>
        {/* Status */}
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as BrandStatus | "all")}
          className={`bg-gray-900/60 border rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-[#CCFF00]/40
            ${statusFilter !== "all" ? "border-[#CCFF00]/30 text-[#CCFF00]" : "border-gray-800 text-gray-400"}`}>
          <option value="all">All Status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
        </select>
        {/* Aggregator */}
        <select value={aggFilter} onChange={(e) => setAggFilter(e.target.value as Aggregator | "all")}
          className={`bg-gray-900/60 border rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-[#CCFF00]/40
            ${aggFilter !== "all" ? "border-[#CCFF00]/30 text-[#CCFF00]" : "border-gray-800 text-gray-400"}`}>
          <option value="all">All Aggregators</option>
          {aggregators.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        {/* Lobby */}
        <select value={lobbyFilter} onChange={(e) => setLobbyFilter(e.target.value as LobbyStatus | "all")}
          className={`bg-gray-900/60 border rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-[#CCFF00]/40
            ${lobbyFilter !== "all" ? "border-[#CCFF00]/30 text-[#CCFF00]" : "border-gray-800 text-gray-400"}`}>
          <option value="all">All Lobby</option>
          {LOBBY_STATUSES.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        {/* Tags */}
        {allTags.length > 0 && (
          <select value={tagFilter ?? ""} onChange={(e) => setTagFilter(e.target.value || null)}
            className={`bg-gray-900/60 border rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-[#CCFF00]/40
              ${tagFilter ? "border-[#CCFF00]/30 text-[#CCFF00]" : "border-gray-800 text-gray-400"}`}>
            <option value="">All Tags</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}

        {activeFilterCount > 0 && (
          <button onClick={() => { setStatusFilter("all"); setAggFilter("all"); setTagFilter(null); setLobbyFilter("all"); }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-red-400 hover:bg-red-500/10 transition-colors">
            <X className="w-3 h-3" /> Clear ({activeFilterCount})
          </button>
        )}

        <span className="ml-auto text-xs text-gray-600">{filtered.length} brand{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* ── Views ───────────────────────────────────────────────────── */}
      {view === "kanban" && (
        <KanbanView brands={filtered} onSelectBrand={setSelectedBrand} onStatusChange={handleStatusChange} />
      )}
      {view === "table" && (
        <TableView brands={filtered} onSelectBrand={setSelectedBrand} />
      )}
      {view === "dashboard" && (
        <DashboardView brands={filtered} activity={activity} onSelectBrand={setSelectedBrand} aggregators={aggregators} />
      )}

      {/* ── Modals ──────────────────────────────────────────────────── */}
      <AddBrandModal open={showAddModal} onClose={() => setShowAddModal(false)} onAdd={addBrand} existingNames={existingNames} aggregators={aggregators} defaultStatus={settings.defaultStatus} />
      <CSVImportModal open={showImportModal} onClose={() => setShowImportModal(false)} onImport={importBrands} aggregators={aggregators} />
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} settings={settings} onSave={setSettings} />

      {/* ── Detail panel ────────────────────────────────────────────── */}
      {selectedBrand && (
        <BrandDetailPanel
          brand={selectedBrand}
          onClose={() => setSelectedBrand(null)}
          onUpdate={updateBrand}
          onDelete={deleteBrand}
          onAddActivity={addActivity}
          aggregators={aggregators}
          gameLibrary={settings.gameLibrary}
        />
      )}

      {/* Slide-in animation */}
      <style jsx global>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-in { animation: slideIn 0.2s ease-out; }
      `}</style>
    </div>
  );
}
