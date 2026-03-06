"use client";

import { useState, useMemo } from "react";

// ── Types ────────────────────────────────────────────────────────────
type BrandStatus = "live" | "soon";
type BrandCategory = "crypto" | "sweeps" | "regulated" | "fiat" | "black" | "on-chain";

interface Brand {
  name: string;
  domain: string;
  url: string;
  category: BrandCategory;
  status: BrandStatus;
  /** Extra domains to try for logo if primary fails */
  altDomains?: string[];
  /** Whether this brand uses Origamo bankroll */
  bankroll?: boolean;
  /** Local logo path (overrides domain-based lookup) */
  logoSrc?: string;
  /** ISO date string for when the brand was integrated (used for "Recently Integrated" sort) */
  integratedAt?: string;
}

// ── Priority brands (hidden ordering — always float to top) ──────────
const PRIORITY_DOMAINS = new Set([
  "csgo500.com", "metaspins.com", "cloudbet.com", "kirgo.com",
  "degencity.com", "vave.com", "chanced.com", "bodog.eu",
  "bovada.lv", "sportingbet.com", "entaingroup.com", "winna.com",
  "parimatch.com", "bluff.com",
]);

// ── Brand data ───────────────────────────────────────────────────────
const BRANDS: Brand[] = [
  // ── Black ──
  { name: "Bovada", domain: "bovada.lv", url: "https://bovada.lv", category: "black", status: "soon" },
  { name: "Bodog", domain: "bodog.eu", url: "https://bodog.eu", category: "black", status: "soon", altDomains: ["bodog.com"] },
  { name: "Sultanbet", domain: "sultanbet.com", url: "https://sultanbet.com", category: "black", status: "live" },
  { name: "BetTurkey", domain: "betturkey.com", url: "https://betturkey.com", category: "black", status: "soon" },
  { name: "Bahis", domain: "bahis.com", url: "https://bahis.com", category: "black", status: "soon" },
  { name: "Matadorbet", domain: "matadorbet.com", url: "https://matadorbet.com", category: "black", status: "soon" },
  { name: "Onwin", domain: "onwin.com", url: "https://onwin.com", category: "black", status: "soon" },
  { name: "Sahabet", domain: "sahabet.com", url: "https://sahabet.com", category: "black", status: "soon" },
  { name: "Fixbet", domain: "fixbet.com", url: "https://fixbet.com", category: "black", status: "soon" },
  { name: "Zbahis", domain: "zbahis.com", url: "https://zbahis.com", category: "black", status: "soon" },
  { name: "Hondubet", domain: "hondubet.com", url: "https://hondubet.com", category: "black", status: "soon" },
  { name: "Sivarbet", domain: "sivarbet.com", url: "https://sivarbet.com", category: "black", status: "soon" },

  // ── Fiat ──
  { name: "Spinbet", domain: "spinbet.com", url: "https://spinbet.com", category: "fiat", status: "live" },
  { name: "Spinbit", domain: "spinbit.com", url: "https://spinbit.com", category: "fiat", status: "live" },
  { name: "Lilibet", domain: "lilibet.com", url: "https://lilibet.com", category: "fiat", status: "live" },
  { name: "Parimatch", domain: "parimatch.com", url: "https://parimatch.com", category: "fiat", status: "soon" },
  { name: "NairaBet", domain: "nairabet.com", url: "https://nairabet.com", category: "fiat", status: "soon" },
  { name: "Spinnaus", domain: "spinnaus.com", url: "https://spinnaus.com", category: "fiat", status: "live" },

  // ── Sweeps ──
  { name: "Kirgo.us", domain: "kirgo.us", url: "https://kirgo.us", category: "sweeps", status: "soon" },
  { name: "Chanced", domain: "chanced.com", url: "https://chanced.com", category: "sweeps", status: "live" },
  { name: "Punt", domain: "punt.com", url: "https://punt.com", category: "sweeps", status: "live" },
  { name: "Gold Rush City", domain: "goldrushcity.com", url: "https://goldrushcity.com", category: "sweeps", status: "live" },

  // ── Crypto ──
  { name: "CSGO500", domain: "csgo500.com", url: "https://csgo500.com", category: "crypto", status: "live", bankroll: true },
  { name: "Metaspins", domain: "metaspins.com", url: "https://metaspins.com", category: "crypto", status: "live" },
  { name: "DegenCity", domain: "degencity.com", url: "https://degencity.com", category: "crypto", status: "live" },
  { name: "Kirgo", domain: "kirgo.com", url: "https://kirgo.com", category: "crypto", status: "live", bankroll: true },
  { name: "Vave", domain: "vave.com", url: "https://vave.com", category: "crypto", status: "live" },
  { name: "Tigrabit", domain: "tigrabit.com", url: "https://tigrabit.com", category: "crypto", status: "live" },
  { name: "Cloudbet", domain: "cloudbet.com", url: "https://cloudbet.com", category: "crypto", status: "live" },
  { name: "Menace", domain: "menace.com", url: "https://menace.com", category: "crypto", status: "live", altDomains: ["menace.casino"] },
  { name: "Respin", domain: "respin.com", url: "https://respin.com", category: "crypto", status: "live" },
  { name: "EpicBet", domain: "epicbet.com", url: "https://epicbet.com", category: "crypto", status: "live" },
  { name: "Sportsbet.io", domain: "sportsbet.io", url: "https://sportsbet.io", category: "crypto", status: "live" },
  { name: "CasinoMega", domain: "casinomega.com", url: "https://casinomega.com", category: "crypto", status: "live" },
  { name: "RollHub", domain: "rollhub.com", url: "https://rollhub.com", category: "crypto", status: "live" },
  { name: "Biggg", domain: "biggg.com", url: "https://biggg.com", category: "crypto", status: "live" },
  { name: "Winna", domain: "winna.com", url: "https://winna.com", category: "crypto", status: "soon", bankroll: true },
  { name: "Bluff", domain: "bluff.com", url: "https://bluff.com", category: "crypto", status: "soon", bankroll: true },
  { name: "Bitcasino", domain: "bitcasino.io", url: "https://bitcasino.io", category: "crypto", status: "live" },
  { name: "BetBaba", domain: "betbaba.com", url: "https://betbaba.com", category: "crypto", status: "live" },
  { name: "Akcebet", domain: "akcebet.com", url: "https://akcebet.com", category: "crypto", status: "live" },
  { name: "Gamblr", domain: "gamblr.com", url: "https://gamblr.com", category: "crypto", status: "live" },
  { name: "Kiekka", domain: "kiekka.com", url: "https://kiekka.com", category: "crypto", status: "live" },
  { name: "Betivo", domain: "betivo.com", url: "https://betivo.com", category: "crypto", status: "live" },
  { name: "BetBolt", domain: "betbolt.com", url: "https://betbolt.com", category: "crypto", status: "live" },
  { name: "PEC Bet", domain: "pec.bet", url: "https://pec.bet", category: "crypto", status: "live" },
  { name: "Kings.game", domain: "kings.game", url: "https://kings.game", category: "crypto", status: "live", altDomains: ["kingscasino.io"] },
  { name: "EfesCasino", domain: "efescasino.com", url: "https://efescasino.com", category: "crypto", status: "live" },
  { name: "Rivalry", domain: "rivalry.com", url: "https://rivalry.com", category: "crypto", status: "live" },
  { name: "Spiidi", domain: "spiidi.com", url: "https://spiidi.com", category: "crypto", status: "live" },
  { name: "SolPengu", domain: "solpengu.com", url: "https://solpengu.com", category: "crypto", status: "live" },
  { name: "Shokker", domain: "shokker.com", url: "https://shokker.com", category: "crypto", status: "live" },
  { name: "Minebit", domain: "minebit.com", url: "https://minebit.com", category: "crypto", status: "soon" },
  { name: "Gambana", domain: "gambana.com", url: "https://gambana.com", category: "crypto", status: "live" },
  { name: "DailySpins", domain: "dailyspins.com", url: "https://dailyspins.com", category: "crypto", status: "soon" },
  { name: "Bombastic", domain: "bombastic.com", url: "https://bombastic.com", category: "crypto", status: "soon" },
  { name: "Ember", domain: "emberfund.io", url: "https://emberfund.io", category: "crypto", status: "soon" },
  { name: "Drizzle", domain: "drizzle.bet", url: "https://drizzle.bet", category: "crypto", status: "live" },
  { name: "Baywin", domain: "baywin.com", url: "https://baywin.com", category: "crypto", status: "live" },

  // ── On-chain ──
  { name: "Scatter", domain: "ui.scatter-fe.pages.dev", url: "https://ui.scatter-fe.pages.dev", category: "on-chain", status: "soon", bankroll: true, logoSrc: "/scatter-logo.png" },

  // ── Regulated ──
  { name: "Sportingbet", domain: "sportingbet.com", url: "https://sportingbet.com", category: "regulated", status: "soon" },
  { name: "Entain", domain: "entaingroup.com", url: "https://entaingroup.com", category: "regulated", status: "soon", altDomains: ["entain.com"] },
  { name: "PickleBet", domain: "picklebet.com", url: "https://picklebet.com", category: "regulated", status: "live" },
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
  crypto:    { label: "Crypto",    color: "text-orange-300",  bg: "bg-orange-900",  border: "border-orange-700" },
  sweeps:    { label: "Sweeps",    color: "text-purple-300",  bg: "bg-purple-900",  border: "border-purple-700" },
  regulated: { label: "Regulated", color: "text-blue-300",    bg: "bg-blue-900",    border: "border-blue-700" },
  fiat:      { label: "Fiat",      color: "text-emerald-300", bg: "bg-emerald-900", border: "border-emerald-700" },
  black:     { label: "Black",     color: "text-gray-200",    bg: "bg-gray-700",    border: "border-gray-500" },
  "on-chain": { label: "On-Chain", color: "text-cyan-300",    bg: "bg-cyan-900",    border: "border-cyan-700" },
};

const STATUS_META: Record<BrandStatus, { label: string; dot: string; text: string; bg: string; border: string }> = {
  live: { label: "Live", dot: "bg-green-400", text: "text-green-300", bg: "bg-green-900", border: "border-green-700" },
  soon: { label: "Soon", dot: "bg-yellow-400", text: "text-yellow-300", bg: "bg-yellow-900", border: "border-yellow-700" },
};

// ── BrandLogo ────────────────────────────────────────────────────────
function BrandLogo({ brand }: { brand: Brand }) {
  const srcs = brand.logoSrc ? [brand.logoSrc, ...buildSrcs(brand)] : buildSrcs(brand);
  const [idx, setIdx] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  if (exhausted) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <span className="text-4xl font-black text-gray-500 select-none">{brand.name.charAt(0)}</span>
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
  const [bankrollFilter, setBankrollFilter] = useState(false);
  const [headerFilter, setHeaderFilter] = useState<string | null>(null);
  const [sortRecent, setSortRecent] = useState(false);

  // Counts
  const allCount       = BRANDS.length;
  const liveCount      = BRANDS.filter((b) => b.status === "live").length;
  const cryptoCount    = BRANDS.filter((b) => b.category === "crypto").length;
  const sweepsCount    = BRANDS.filter((b) => b.category === "sweeps").length;
  const regulatedCount = BRANDS.filter((b) => b.category === "regulated").length;
  const blackCount     = BRANDS.filter((b) => b.category === "black").length;
  const onChainCount   = BRANDS.filter((b) => b.category === "on-chain").length;
  const bankrollCount  = BRANDS.filter((b) => b.bankroll).length;

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

    // Bankroll filter
    if (bankrollFilter) {
      result = result.filter((b) => b.bankroll);
    }

    if (sortRecent) {
      // Reverse array order so brands added later (= more recently integrated) appear first
      result.reverse();
    } else {
      // Priority brands float to top, rest keep original order
      result.sort((a, b) => {
        const aPri = PRIORITY_DOMAINS.has(a.domain) ? 0 : 1;
        const bPri = PRIORITY_DOMAINS.has(b.domain) ? 0 : 1;
        return aPri - bPri;
      });
    }

    return result;
  }, [statusFilter, categoryFilters, bankrollFilter, sortRecent]);

  const CATEGORIES: BrandCategory[] = ["crypto", "sweeps", "regulated", "fiat", "black", "on-chain"];

  return (
    <div className="space-y-6 pb-6">
      {/* ── Header stat cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard label="All Brands" count={allCount} active={headerFilter === "all"} onClick={() => handleHeaderClick("all")} />
        <StatCard label="Live" count={liveCount} active={headerFilter === "live"} onClick={() => handleHeaderClick("live")} />
        <StatCard label="Crypto" count={cryptoCount} active={headerFilter === "crypto"} onClick={() => handleHeaderClick("crypto")} />
        <StatCard label="Sweeps" count={sweepsCount} active={headerFilter === "sweeps"} onClick={() => handleHeaderClick("sweeps")} />
        <StatCard label="Regulated" count={regulatedCount} active={headerFilter === "regulated"} onClick={() => handleHeaderClick("regulated")} />
        <StatCard label="Black" count={blackCount} active={headerFilter === "black"} onClick={() => handleHeaderClick("black")} />
        <StatCard label="On-Chain" count={onChainCount} active={headerFilter === "on-chain"} onClick={() => handleHeaderClick("on-chain")} />
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

          {/* Bankroll filter */}
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-600 mb-2.5">Bankroll</h4>
            <button
              onClick={() => { setBankrollFilter((v) => !v); setHeaderFilter(null); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150
                ${bankrollFilter
                  ? "bg-[#CCFF00]/10 text-[#CCFF00] border border-[#CCFF00]/20"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 border border-transparent"
                }`}
            >
              <span className={`w-2 h-2 rounded-full ${bankrollFilter ? "bg-[#CCFF00]" : "bg-gray-600"}`} />
              Bankroll
              <span className="ml-auto text-[10px] text-gray-600">{bankrollCount}</span>
            </button>
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
            <button
              onClick={() => setBankrollFilter((v) => !v)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                ${bankrollFilter
                  ? "border-[#CCFF00]/30 text-[#CCFF00] bg-[#CCFF00]/10"
                  : "border-gray-700 text-gray-400"
                }`}
            >
              Bankroll
            </button>
          </div>

          {/* Results count + sort */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              {filtered.length} brand{filtered.length !== 1 ? "s" : ""}
              {statusFilter !== "all" || categoryFilters.size > 0 || bankrollFilter ? " (filtered)" : ""}
            </p>
            <button
              onClick={() => setSortRecent((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150
                ${sortRecent
                  ? "border-[#CCFF00]/30 text-[#CCFF00] bg-[#CCFF00]/10"
                  : "border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600"
                }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <path d="M12 5v14" /><path d="m19 12-7 7-7-7" />
              </svg>
              Recently Integrated
            </button>
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
                  {/* Logo panel */}
                  <div className="h-[100px] bg-white flex items-center justify-center p-5 shrink-0">
                    <BrandLogo brand={brand} />
                  </div>

                  {/* Info panel */}
                  <div className="flex flex-col flex-1 p-4 gap-2.5">
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
                    {/* Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider
                        ${statusMeta.bg} ${statusMeta.text} ${statusMeta.border} border`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot} ${brand.status === "live" ? "animate-pulse" : ""}`} />
                        {statusMeta.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider
                        ${catMeta.bg} ${catMeta.color} ${catMeta.border} border`}>
                        {catMeta.label}
                      </span>
                      {brand.bankroll && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider
                          bg-[#CCFF00]/20 text-[#CCFF00] border border-[#CCFF00]/30">
                          Bankroll
                        </span>
                      )}
                    </div>
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
