"use client";

import { useState, useMemo } from "react";

// ── Types ────────────────────────────────────────────────────────────
type BrandStatus = "live" | "soon";
type BrandCategory = "crypto" | "sweeps" | "regulated" | "fiat" | "black";

interface Brand {
  name: string;
  domain: string;
  url: string;
  category: BrandCategory;
  status: BrandStatus;
  /** AI-estimated revenue rank (1 = highest revenue) */
  revenueRank: number;
  /** Extra domains to try for logo if primary fails */
  altDomains?: string[];
}

// ── Brand data ───────────────────────────────────────────────────────
const BRANDS: Brand[] = [
  // ── Black ──
  { name: "Bovada", domain: "bovada.lv", url: "https://bovada.lv", category: "black", status: "soon", revenueRank: 1 },
  { name: "Bodog", domain: "bodog.eu", url: "https://bodog.eu", category: "black", status: "soon", revenueRank: 2, altDomains: ["bodog.com"] },

  // ── Fiat ──
  { name: "Spinbet", domain: "spinbet.com", url: "https://spinbet.com", category: "fiat", status: "live", revenueRank: 28 },
  { name: "Spinbit", domain: "spinbit.com", url: "https://spinbit.com", category: "fiat", status: "live", revenueRank: 29 },
  { name: "Lilibet", domain: "lilibet.com", url: "https://lilibet.com", category: "fiat", status: "live", revenueRank: 27 },
  { name: "Parimatch", domain: "parimatch.com", url: "https://parimatch.com", category: "fiat", status: "soon", revenueRank: 8 },

  // ── Sweeps ──
  { name: "Kirgo.us", domain: "kirgo.us", url: "https://kirgo.us", category: "sweeps", status: "soon", revenueRank: 37 },
  { name: "Chanced", domain: "chanced.com", url: "https://chanced.com", category: "sweeps", status: "live", revenueRank: 21 },
  { name: "Punt", domain: "punt.com", url: "https://punt.com", category: "sweeps", status: "live", revenueRank: 20 },
  { name: "Ember", domain: "ember.com", url: "https://ember.com", category: "sweeps", status: "soon", revenueRank: 52, altDomains: ["ember.casino"] },
  { name: "Gold Rush City", domain: "goldrushcity.com", url: "https://goldrushcity.com", category: "sweeps", status: "live", revenueRank: 33 },
  { name: "TurboStakes", domain: "turbostakes.com", url: "https://turbostakes.com", category: "sweeps", status: "live", revenueRank: 49 },

  // ── Crypto ──
  { name: "CSGO500", domain: "csgo500.com", url: "https://csgo500.com", category: "crypto", status: "live", revenueRank: 13 },
  { name: "Metaspins", domain: "metaspins.com", url: "https://metaspins.com", category: "crypto", status: "live", revenueRank: 25 },
  { name: "DegenCity", domain: "degencity.com", url: "https://degencity.com", category: "crypto", status: "live", revenueRank: 47 },
  { name: "Kirgo", domain: "kirgo.com", url: "https://kirgo.com", category: "crypto", status: "live", revenueRank: 24 },
  { name: "Vave", domain: "vave.com", url: "https://vave.com", category: "crypto", status: "live", revenueRank: 14 },
  { name: "Tigrabit", domain: "tigrabit.com", url: "https://tigrabit.com", category: "crypto", status: "live", revenueRank: 48 },
  { name: "Cloudbet", domain: "cloudbet.com", url: "https://cloudbet.com", category: "crypto", status: "live", revenueRank: 5 },
  { name: "Menace", domain: "menace.com", url: "https://menace.com", category: "crypto", status: "live", revenueRank: 45, altDomains: ["menace.casino"] },
  { name: "Respin", domain: "respin.com", url: "https://respin.com", category: "crypto", status: "live", revenueRank: 44 },
  { name: "EpicBet", domain: "epicbet.com", url: "https://epicbet.com", category: "crypto", status: "live", revenueRank: 39 },
  { name: "Sportsbet.io", domain: "sportsbet.io", url: "https://sportsbet.io", category: "crypto", status: "live", revenueRank: 3 },
  { name: "CasinoMega", domain: "casinomega.com", url: "https://casinomega.com", category: "crypto", status: "live", revenueRank: 35 },
  { name: "RollHub", domain: "rollhub.com", url: "https://rollhub.com", category: "crypto", status: "live", revenueRank: 40 },
  { name: "Biggg", domain: "biggg.com", url: "https://biggg.com", category: "crypto", status: "live", revenueRank: 41 },
  { name: "Winna", domain: "winna.com", url: "https://winna.com", category: "crypto", status: "soon", revenueRank: 56 },
  { name: "Bluff", domain: "bluff.com", url: "https://bluff.com", category: "crypto", status: "soon", revenueRank: 54 },
  { name: "Spinnaus", domain: "spinnaus.com", url: "https://spinnaus.com", category: "crypto", status: "soon", revenueRank: 55 },
  { name: "Bitcasino", domain: "bitcasino.io", url: "https://bitcasino.io", category: "crypto", status: "live", revenueRank: 9 },
  { name: "BetBaba", domain: "betbaba.com", url: "https://betbaba.com", category: "crypto", status: "live", revenueRank: 22 },
  { name: "Akcebet", domain: "akcebet.com", url: "https://akcebet.com", category: "crypto", status: "live", revenueRank: 32 },
  { name: "Gamblr", domain: "gamblr.com", url: "https://gamblr.com", category: "crypto", status: "live", revenueRank: 42 },
  { name: "Kiekka", domain: "kiekka.com", url: "https://kiekka.com", category: "crypto", status: "live", revenueRank: 43 },
  { name: "Betivo", domain: "betivo.com", url: "https://betivo.com", category: "crypto", status: "live", revenueRank: 31 },
  { name: "Drizzle", domain: "drizzle.com", url: "https://drizzle.com", category: "crypto", status: "live", revenueRank: 38, altDomains: ["drizzle.casino"] },
  { name: "BetBolt", domain: "betbolt.com", url: "https://betbolt.com", category: "crypto", status: "live", revenueRank: 36 },
  { name: "PEC Bet", domain: "pec.bet", url: "https://pec.bet", category: "crypto", status: "live", revenueRank: 62 },
  { name: "Kings.game", domain: "kings.game", url: "https://kings.game", category: "crypto", status: "live", revenueRank: 12, altDomains: ["kingscasino.io"] },
  { name: "EfesCasino", domain: "efescasino.com", url: "https://efescasino.com", category: "crypto", status: "live", revenueRank: 34 },
  { name: "Rivalry", domain: "rivalry.com", url: "https://rivalry.com", category: "crypto", status: "live", revenueRank: 7 },
  { name: "PickleBet", domain: "picklebet.com", url: "https://picklebet.com", category: "crypto", status: "live", revenueRank: 30 },
  { name: "Sultanbet", domain: "sultanbet.com", url: "https://sultanbet.com", category: "crypto", status: "live", revenueRank: 10 },
  { name: "Spiidi", domain: "spiidi.com", url: "https://spiidi.com", category: "crypto", status: "live", revenueRank: 50 },
  { name: "SolPengu", domain: "solpengu.com", url: "https://solpengu.com", category: "crypto", status: "live", revenueRank: 51 },
  { name: "Shokker", domain: "shokker.com", url: "https://shokker.com", category: "crypto", status: "live", revenueRank: 46 },
  { name: "Minebit", domain: "minebit.com", url: "https://minebit.com", category: "crypto", status: "soon", revenueRank: 53 },
  { name: "Gambana", domain: "gambana.com", url: "https://gambana.com", category: "crypto", status: "live", revenueRank: 61 },
  { name: "Hondubet", domain: "hondubet.com", url: "https://hondubet.com", category: "crypto", status: "soon", revenueRank: 58 },
  { name: "Sivarbet", domain: "sivarbet.com", url: "https://sivarbet.com", category: "crypto", status: "soon", revenueRank: 59 },
  { name: "DailySpins", domain: "dailyspins.com", url: "https://dailyspins.com", category: "crypto", status: "soon", revenueRank: 57 },
  { name: "Bombastic", domain: "bombastic.com", url: "https://bombastic.com", category: "crypto", status: "soon", revenueRank: 26 },
  { name: "NairaBet", domain: "nairabet.com", url: "https://nairabet.com", category: "crypto", status: "soon", revenueRank: 23 },
  { name: "Bahis", domain: "bahis.com", url: "https://bahis.com", category: "crypto", status: "soon", revenueRank: 17 },
  { name: "Matadorbet", domain: "matadorbet.com", url: "https://matadorbet.com", category: "crypto", status: "soon", revenueRank: 18 },
  { name: "Fixbet", domain: "fixbet.com", url: "https://fixbet.com", category: "crypto", status: "soon", revenueRank: 19 },
  { name: "Sahabet", domain: "sahabet.com", url: "https://sahabet.com", category: "crypto", status: "soon", revenueRank: 16 },
  { name: "Onwin", domain: "onwin.com", url: "https://onwin.com", category: "crypto", status: "soon", revenueRank: 15 },
  { name: "BetTurkey", domain: "betturkey.com", url: "https://betturkey.com", category: "crypto", status: "soon", revenueRank: 11 },
  { name: "Zbahis", domain: "zbahis.com", url: "https://zbahis.com", category: "crypto", status: "soon", revenueRank: 60 },

  // ── Regulated ──
  { name: "Sportingbet", domain: "sportingbet.com", url: "https://sportingbet.com", category: "regulated", status: "soon", revenueRank: 6 },
  { name: "Entain", domain: "entaingroup.com", url: "https://entaingroup.com", category: "regulated", status: "soon", revenueRank: 4, altDomains: ["entain.com"] },
];

// ── Helpers ──────────────────────────────────────────────────────────
function buildSrcs(brand: Brand): string[] {
  const domains = [brand.domain, ...(brand.altDomains ?? [])];
  const srcs: string[] = [];
  for (const d of domains) srcs.push(`https://logo.clearbit.com/${d}`);
  for (const d of domains) srcs.push(`https://www.google.com/s2/favicons?domain=${d}&sz=256`);
  return srcs;
}

const CATEGORY_META: Record<BrandCategory, { label: string; color: string; bg: string; border: string }> = {
  crypto:    { label: "Crypto",    color: "text-orange-400",  bg: "bg-orange-950/30",  border: "border-orange-800/40" },
  sweeps:    { label: "Sweeps",    color: "text-purple-400",  bg: "bg-purple-950/30",  border: "border-purple-800/40" },
  regulated: { label: "Regulated", color: "text-blue-400",    bg: "bg-blue-950/30",    border: "border-blue-800/40" },
  fiat:      { label: "Fiat",      color: "text-emerald-400", bg: "bg-emerald-950/30", border: "border-emerald-800/40" },
  black:     { label: "Black",     color: "text-gray-300",    bg: "bg-gray-800/40",    border: "border-gray-600/40" },
};

const STATUS_META: Record<BrandStatus, { label: string; dot: string; text: string; bg: string; border: string }> = {
  live: { label: "Live", dot: "bg-green-400", text: "text-green-400", bg: "bg-green-950/30", border: "border-green-800/40" },
  soon: { label: "Soon", dot: "bg-yellow-400", text: "text-yellow-400", bg: "bg-yellow-950/30", border: "border-yellow-800/40" },
};

// ── BrandLogo ────────────────────────────────────────────────────────
function BrandLogo({ brand }: { brand: Brand }) {
  const srcs = buildSrcs(brand);
  const [idx, setIdx] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  if (exhausted) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <span className="text-4xl font-black text-gray-300 select-none">{brand.name.charAt(0)}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={srcs[idx]}
      src={srcs[idx]}
      alt={brand.name}
      className="max-h-[56px] max-w-[140px] w-auto h-auto object-contain"
      onError={() => {
        if (idx + 1 < srcs.length) setIdx(idx + 1);
        else setExhausted(true);
      }}
    />
  );
}

// ── StatCard ─────────────────────────────────────────────────────────
function StatCard({ label, count, active, onClick }: { label: string; count: number; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center px-4 py-3 rounded-xl border transition-all duration-200 min-w-0
        ${active
          ? "border-[#CCFF00]/40 bg-[#CCFF00]/5"
          : "border-gray-800 bg-gray-900/40 hover:border-gray-700"
        }`}
    >
      <span className={`text-xl font-bold ${active ? "text-[#CCFF00]" : "text-white"}`}>{count}</span>
      <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">{label}</span>
    </button>
  );
}

// ── Main component ───────────────────────────────────────────────────
export default function BrandsPortfolio() {
  const [statusFilter, setStatusFilter] = useState<BrandStatus | "all">("all");
  const [categoryFilters, setCategoryFilters] = useState<Set<BrandCategory>>(new Set());
  const [headerFilter, setHeaderFilter] = useState<string | null>(null);

  // Counts
  const allCount       = BRANDS.length;
  const liveCount      = BRANDS.filter((b) => b.status === "live").length;
  const cryptoCount    = BRANDS.filter((b) => b.category === "crypto").length;
  const sweepsCount    = BRANDS.filter((b) => b.category === "sweeps").length;
  const regulatedCount = BRANDS.filter((b) => b.category === "regulated").length;
  const blackCount     = BRANDS.filter((b) => b.category === "black").length;

  function toggleCategory(cat: BrandCategory) {
    setCategoryFilters((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
    setHeaderFilter(null);
  }

  function handleHeaderClick(filter: string) {
    if (headerFilter === filter) {
      // Deactivate
      setHeaderFilter(null);
      setStatusFilter("all");
      setCategoryFilters(new Set());
    } else {
      setHeaderFilter(filter);
      if (filter === "all") {
        setStatusFilter("all");
        setCategoryFilters(new Set());
      } else if (filter === "live") {
        setStatusFilter("live");
        setCategoryFilters(new Set());
      } else {
        setStatusFilter("all");
        setCategoryFilters(new Set([filter as BrandCategory]));
      }
    }
  }

  // Filtered + sorted
  const filtered = useMemo(() => {
    let result = [...BRANDS];

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((b) => b.status === statusFilter);
    }

    // Category filter
    if (categoryFilters.size > 0) {
      result = result.filter((b) => categoryFilters.has(b.category));
    }

    // Sort by revenue rank (ascending = highest revenue first)
    result.sort((a, b) => a.revenueRank - b.revenueRank);

    return result;
  }, [statusFilter, categoryFilters]);

  const CATEGORIES: BrandCategory[] = ["crypto", "sweeps", "regulated", "fiat", "black"];

  return (
    <div className="space-y-6 pb-6">
      {/* ── Header stat cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <StatCard label="All Brands" count={allCount} active={headerFilter === "all"} onClick={() => handleHeaderClick("all")} />
        <StatCard label="Live" count={liveCount} active={headerFilter === "live"} onClick={() => handleHeaderClick("live")} />
        <StatCard label="Crypto" count={cryptoCount} active={headerFilter === "crypto"} onClick={() => handleHeaderClick("crypto")} />
        <StatCard label="Sweeps" count={sweepsCount} active={headerFilter === "sweeps"} onClick={() => handleHeaderClick("sweeps")} />
        <StatCard label="Regulated" count={regulatedCount} active={headerFilter === "regulated"} onClick={() => handleHeaderClick("regulated")} />
        <StatCard label="Black" count={blackCount} active={headerFilter === "black"} onClick={() => handleHeaderClick("black")} />
      </div>

      {/* ── Content area: sidebar + grid ───────────────────────────── */}
      <div className="flex gap-6">

        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <div className="w-[220px] shrink-0 space-y-5 hidden md:block">

          {/* Status filter */}
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-600 mb-2.5">Status</h4>
            <div className="space-y-1">
              {(["all", "live", "soon"] as const).map((s) => {
                const active = statusFilter === s;
                return (
                  <button
                    key={s}
                    onClick={() => { setStatusFilter(s); setHeaderFilter(null); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150
                      ${active
                        ? "bg-[#CCFF00]/10 text-[#CCFF00] border border-[#CCFF00]/20"
                        : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 border border-transparent"
                      }`}
                  >
                    {s === "all" ? (
                      <span className="w-2 h-2 rounded-full bg-gray-500" />
                    ) : (
                      <span className={`w-2 h-2 rounded-full ${STATUS_META[s].dot}`} />
                    )}
                    <span className="capitalize">{s === "all" ? "All" : s === "live" ? "Live" : "Coming Soon"}</span>
                    <span className="ml-auto text-[10px] text-gray-600">
                      {s === "all" ? allCount : BRANDS.filter((b) => b.status === s).length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sort indicator */}
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-600 mb-2.5">Sort By</h4>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/40 border border-gray-800">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-[#CCFF00]">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-xs text-gray-300 font-medium">Est. Revenue</span>
            </div>
          </div>

          {/* Category filters */}
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-600 mb-2.5">Category</h4>
            <div className="space-y-1">
              {CATEGORIES.map((cat) => {
                const meta = CATEGORY_META[cat];
                const active = categoryFilters.has(cat);
                const count = BRANDS.filter((b) => b.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150
                      ${active
                        ? `${meta.bg} ${meta.color} border ${meta.border}`
                        : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 border border-transparent"
                      }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${active ? meta.color.replace("text-", "bg-") : "bg-gray-600"}`} />
                    {meta.label}
                    <span className="ml-auto text-[10px] text-gray-600">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Brand cards grid ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* Mobile filters */}
          <div className="flex flex-wrap gap-2 mb-4 md:hidden">
            {(["all", "live", "soon"] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setHeaderFilter(null); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                  ${statusFilter === s
                    ? "border-[#CCFF00]/30 text-[#CCFF00] bg-[#CCFF00]/10"
                    : "border-gray-700 text-gray-400"
                  }`}
              >
                {s === "all" ? "All" : s === "live" ? "Live" : "Soon"}
              </button>
            ))}
            {CATEGORIES.map((cat) => {
              const active = categoryFilters.has(cat);
              const meta = CATEGORY_META[cat];
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                    ${active
                      ? `${meta.border} ${meta.color} ${meta.bg}`
                      : "border-gray-700 text-gray-400"
                    }`}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>

          {/* Results count */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              {filtered.length} brand{filtered.length !== 1 ? "s" : ""}
              {statusFilter !== "all" || categoryFilters.size > 0 ? " (filtered)" : ""}
            </p>
            <span className="text-[10px] text-gray-600 font-medium">Sorted by est. revenue</span>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((brand) => {
              const catMeta = CATEGORY_META[brand.category];
              const statusMeta = STATUS_META[brand.status];

              return (
                <a
                  key={brand.domain}
                  href={brand.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col bg-[#111111] border border-gray-800 rounded-2xl overflow-hidden
                             hover:border-gray-600 transition-all duration-200
                             hover:shadow-[0_0_40px_-10px_rgba(204,255,0,0.08)]"
                >
                  {/* Logo panel with badges */}
                  <div className="relative h-[120px] bg-white flex items-center justify-center p-6 shrink-0">
                    <BrandLogo brand={brand} />

                    {/* Status badge - top left */}
                    <span className={`absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider
                      ${statusMeta.bg} ${statusMeta.text} ${statusMeta.border} border backdrop-blur-sm`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot} ${brand.status === "live" ? "animate-pulse" : ""}`} />
                      {statusMeta.label}
                    </span>

                    {/* Category badge - top right */}
                    <span className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider
                      ${catMeta.bg} ${catMeta.color} ${catMeta.border} border backdrop-blur-sm`}>
                      {catMeta.label}
                    </span>
                  </div>

                  {/* Info panel */}
                  <div className="flex flex-col flex-1 p-4 gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-white group-hover:text-[#CCFF00] transition-colors duration-150 truncate">
                        {brand.name}
                      </h3>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round"
                        className="w-3.5 h-3.5 text-gray-700 group-hover:text-gray-500 transition-colors shrink-0">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </div>
                    <p className="text-[11px] text-gray-600 truncate">{brand.domain}</p>
                  </div>
                </a>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 mb-3 text-gray-700">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <p className="text-sm">No brands match your filters</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
