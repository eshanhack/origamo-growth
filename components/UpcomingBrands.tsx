"use client";

import { useState } from "react";

interface Brand {
  name: string;
  domain: string;
  url: string;
  category: string;
  description: string;
  /** Extra domains to try for the logo if the primary fails */
  altDomains?: string[];
}

const BRANDS: Brand[] = [
  {
    name: "Winna",
    domain: "winna.com",
    url: "https://winna.com",
    category: "Casino",
    description: "Modern online casino offering slots, live casino, and sports betting.",
  },
  {
    name: "Bodog",
    domain: "bodog.eu",
    url: "https://bodog.eu",
    category: "Casino & Sportsbook",
    description: "Iconic North American-facing sportsbook and casino, founded in 1994.",
    altDomains: ["bodog.com"],
  },
  {
    name: "Bovada",
    domain: "bovada.lv",
    url: "https://bovada.lv",
    category: "Casino & Sportsbook",
    description: "US-focused sportsbook, online casino and poker platform.",
  },
  {
    name: "Sportingbet",
    domain: "sportingbet.com",
    url: "https://sportingbet.com",
    category: "Sportsbook",
    description: "Established global sports betting operator with a long-standing market presence.",
  },
  {
    name: "Entain",
    domain: "entaingroup.com",
    url: "https://entaingroup.com",
    category: "Gaming Group",
    description: "FTSE 100 gaming group owning Ladbrokes, bwin, Coral, and dozens more.",
    altDomains: ["entain.com"],
  },
];

// Build ordered list of logo src candidates for a brand
function buildSrcs(brand: Brand): string[] {
  const domains = [brand.domain, ...(brand.altDomains ?? [])];
  const srcs: string[] = [];
  for (const d of domains) {
    srcs.push(`https://logo.clearbit.com/${d}`);
  }
  for (const d of domains) {
    srcs.push(`https://www.google.com/s2/favicons?domain=${d}&sz=256`);
  }
  return srcs;
}

function BrandLogo({ brand }: { brand: Brand }) {
  const srcs = buildSrcs(brand);
  const [idx, setIdx] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  if (exhausted) {
    // Styled initial fallback
    return (
      <div className="flex items-center justify-center w-full h-full">
        <span className="text-5xl font-black text-gray-300 select-none">
          {brand.name.charAt(0)}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={srcs[idx]}
      src={srcs[idx]}
      alt={brand.name}
      className="max-h-[72px] max-w-[180px] w-auto h-auto object-contain"
      onError={() => {
        if (idx + 1 < srcs.length) setIdx(idx + 1);
        else setExhausted(true);
      }}
    />
  );
}

const CATEGORY_STYLES: Record<string, string> = {
  "Casino":               "text-purple-400  border-purple-800/40  bg-purple-950/20",
  "Casino & Sportsbook":  "text-blue-400    border-blue-800/40    bg-blue-950/20",
  "Sportsbook":           "text-emerald-400 border-emerald-800/40 bg-emerald-950/20",
  "Gaming Group":         "text-[#CCFF00]   border-[#CCFF00]/20   bg-[#CCFF00]/5",
};

export default function UpcomingBrands() {
  return (
    <div className="space-y-8 pb-6">

      {/* Section header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Upcoming Brands</h2>
          <p className="text-sm text-gray-500 mt-1">Pipeline · {BRANDS.length} brands in review</p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-600
                         border border-gray-800 bg-gray-900/60 px-3 py-1.5 rounded-full">
          In Review
        </span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {BRANDS.map((brand) => (
          <a
            key={brand.domain}
            href={brand.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col bg-[#111111] border border-gray-800 rounded-2xl overflow-hidden
                       hover:border-gray-600 transition-all duration-200
                       hover:shadow-[0_0_40px_-10px_rgba(204,255,0,0.10)]"
          >
            {/* Logo panel */}
            <div className="h-[150px] bg-white flex items-center justify-center p-8 shrink-0">
              <BrandLogo brand={brand} />
            </div>

            {/* Info panel */}
            <div className="flex flex-col flex-1 p-5 gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[15px] font-bold text-white group-hover:text-[#CCFF00]
                                 transition-colors duration-150 truncate">
                    {brand.name}
                  </h3>
                  <p className="text-[11px] text-gray-600 mt-0.5 truncate">{brand.domain}</p>
                </div>

                <span className={`shrink-0 text-[9px] font-bold uppercase tracking-[0.15em]
                                  border px-2 py-1 rounded-full whitespace-nowrap
                                  ${CATEGORY_STYLES[brand.category] ?? "text-gray-400 border-gray-700 bg-gray-900"}`}>
                  {brand.category}
                </span>
              </div>

              <p className="text-[12px] text-gray-500 leading-relaxed flex-1">
                {brand.description}
              </p>

              {/* Visit link indicator */}
              <div className="flex items-center gap-1.5 text-[11px] text-gray-700
                              group-hover:text-gray-500 transition-colors duration-150 mt-auto">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Visit website
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
