import { MonthlyData, MonthlyDataWithGrowth } from "./types";
import { fetchWeeklyRows, aggregateMonthly, MonthlyAggregate } from "./sheet";
import fs from "fs";
import path from "path";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// On Vercel (and other serverless platforms) process.cwd() is read-only.
// We write mutations to /tmp which is always writable, and seed from the
// bundled data/metrics.json that ships with the repo.
const BUNDLED_FILE = path.join(process.cwd(), "data", "metrics.json");
const TMP_FILE = "/tmp/origamo-metrics.json";

// ─── Seed data ────────────────────────────────────────────────────────────────
// Last-resort fallback — mirrors data/metrics.json exactly.
const SEED_DATA: MonthlyData[] = [
  {
    id: "2025-09",
    label: "Sep 2025",
    dateStart: "2025-09-01",
    dateEnd: "2025-09-30",
    mau: 2833,
    activeBrands: 11,
    betsPlaced: 1534241,
    effectiveEdge: 0.0137,
    wager: 4990000,
    ggr: 68180,
    fees: 3680,
    topBrands: ["Betbolt", "CSGO500", "Bitcasino"],
    source: "manual",
  },
  {
    id: "2025-10",
    label: "Oct 2025",
    dateStart: "2025-10-01",
    dateEnd: "2025-10-31",
    mau: 5258,
    activeBrands: 17,
    betsPlaced: 6408839,
    effectiveEdge: 0.0171,
    wager: 8410000,
    ggr: 144160,
    fees: 8010,
    topBrands: ["Betbolt", "Cloudbet", "CSGO500"],
    source: "manual",
  },
  {
    id: "2025-11",
    label: "Nov 2025",
    dateStart: "2025-11-01",
    dateEnd: "2025-11-30",
    mau: 4788,
    activeBrands: 21,
    betsPlaced: 4828503,
    effectiveEdge: 0.0222,
    wager: 12980000,
    ggr: 288330,
    fees: 14730,
    topBrands: ["Betbolt", "CSGO500", "Cloudbet"],
    source: "manual",
  },
  {
    id: "2025-12",
    label: "Dec 2025",
    dateStart: "2025-12-01",
    dateEnd: "2025-12-31",
    mau: 6558,
    activeBrands: 23,
    betsPlaced: 8409715,
    effectiveEdge: 0.0122,
    wager: 19770000,
    ggr: 241650,
    fees: 16280,
    topBrands: ["Drizzle", "CSGO500", "Cloudbet"],
    source: "manual",
    brandBreakdown: [
      { name: "Drizzle",  wager: 5360000, ggr: 88100,  fees: 4405 },
      { name: "CSGO500",  wager: 5220000, ggr: -79400, fees: 0    },
      { name: "Cloudbet", wager: 2220000, ggr: 58000,  fees: 2900 },
      { name: "Betbolt",  wager: 1750000, ggr: 24800,  fees: 1240 },
      { name: "Biggg",    wager: 1120000, ggr: 60000,  fees: 3000 },
    ],
  },
  {
    id: "2026-01",
    label: "Jan 2026",
    dateStart: "2026-01-01",
    dateEnd: "2026-01-31",
    mau: 7522,
    activeBrands: 31,
    betsPlaced: 7753860,
    effectiveEdge: 0.0312,
    wager: 15570000,
    ggr: 485970,
    fees: 25360,
    topBrands: ["Metaspins", "CSGO500", "Cloudbet"],
    source: "manual",
    brandBreakdown: [
      { name: "Metaspins", wager: 4340000, ggr: 109000, fees: 5450 },
      { name: "CSGO500",   wager: 3660000, ggr: 173000, fees: 8650 },
      { name: "Cloudbet",  wager: 1690000, ggr: 32400,  fees: 1620 },
      { name: "Kirgo",     wager: 1230000, ggr: 70700,  fees: 3535 },
      { name: "Gambana",   wager: 868000,  ggr: 13300,  fees: 665  },
    ],
  },
  {
    id: "2026-02",
    label: "Feb 2026",
    dateStart: "2026-02-01",
    dateEnd: "2026-02-28",
    mau: 14194,
    activeBrands: 35,
    betsPlaced: 6738015,
    effectiveEdge: 0.0133,
    wager: 16800000,
    ggr: 223010,
    fees: 15350,
    topBrands: ["Spartans", "Metaspins", "CSGO500"],
    source: "manual",
    brandBreakdown: [
      { name: "Metaspins", wager: 3790000, ggr: 50400,  fees: 2520 },
      { name: "CSGO500",   wager: 2890000, ggr: -12500, fees: -625 },
      { name: "Cloudbet",  wager: 1370000, ggr: 25800,  fees: 1290 },
      { name: "Kirgo",     wager: 1320000, ggr: 21300,  fees: 1065 },
      { name: "Chanced",   wager: 862000,  ggr: 18200,  fees: 910  },
    ],
  },
];

function readJson(filePath: string): MonthlyData[] | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as MonthlyData[];
  } catch {
    return null;
  }
}

function loadData(): MonthlyData[] {
  // 1. Prefer /tmp (holds any in-session additions)
  const tmp = readJson(TMP_FILE);
  if (tmp) return tmp;

  // 2. Fall back to the committed bundled file
  const bundled = readJson(BUNDLED_FILE);
  if (bundled) {
    // Copy into /tmp so future writes work
    try { fs.writeFileSync(TMP_FILE, JSON.stringify(bundled, null, 2)); } catch { /* ignore */ }
    return bundled;
  }

  // 3. Last resort: in-memory seed
  try { fs.writeFileSync(TMP_FILE, JSON.stringify(SEED_DATA, null, 2)); } catch { /* ignore */ }
  return SEED_DATA;
}

function getLocalData(): MonthlyData[] {
  return loadData().sort(
    (a, b) => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime()
  );
}

function aggregateToMonthlyData(agg: MonthlyAggregate): MonthlyData {
  const dateStart = `${agg.year}-${String(agg.month).padStart(2, "0")}-01`;
  const dateEnd = `${agg.year}-${String(agg.month).padStart(2, "0")}-${String(lastDayOfMonth(agg.year, agg.month)).padStart(2, "0")}`;
  return {
    id: agg.id,
    label: `${MONTH_NAMES[agg.month - 1]} ${agg.year}`,
    dateStart,
    dateEnd,
    mau: 0,
    activeBrands: 0,
    betsPlaced: agg.betsPlaced,
    effectiveEdge: agg.effectiveEdge,
    wager: agg.wager,
    ggr: agg.ggr,
    fees: agg.fees,
    topBrands: agg.topBrands,
    source: "sheet",
  };
}

/**
 * Returns the merged dataset:
 *   - Financial fields (wager, ggr, fees, bets, edge, topBrands) come from
 *     the Google Sheet when available (it's the source of truth).
 *   - Non-financial fields (mau, activeBrands, brandBreakdown) come from
 *     metrics.json / /tmp (manual).
 *   - If sheet fetch fails, returns local data only.
 */
export async function getAllData(): Promise<MonthlyData[]> {
  const local = getLocalData();

  let sheetMonths: MonthlyAggregate[] = [];
  try {
    const rows = await fetchWeeklyRows();
    sheetMonths = aggregateMonthly(rows);
  } catch (e) {
    console.error("[data] Sheet fetch failed, using local data only:", e);
    return local;
  }

  const byId = new Map<string, MonthlyData>();
  for (const d of local) byId.set(d.id, d);

  // For each month present in the sheet, override financials.
  // For months not yet in local, create a new entry with carry-forward
  // activeBrands and max-WAU as MAU approximation.
  const sorted = [...sheetMonths].sort((a, b) => a.id.localeCompare(b.id));
  let carryActiveBrands = 0;
  let carryMau = 0;
  for (const agg of sorted) {
    const existing = byId.get(agg.id);
    if (existing) {
      carryActiveBrands = existing.activeBrands || carryActiveBrands;
      carryMau = existing.mau || carryMau;
      byId.set(agg.id, {
        ...existing,
        betsPlaced: agg.betsPlaced,
        effectiveEdge: agg.effectiveEdge,
        wager: agg.wager,
        ggr: agg.ggr,
        fees: agg.fees,
        topBrands: agg.topBrands && agg.topBrands.length > 0 ? agg.topBrands : existing.topBrands,
        source: existing.source === "manual" ? "manual" : "sheet",
      });
    } else {
      const fresh = aggregateToMonthlyData(agg);
      fresh.activeBrands = carryActiveBrands;
      fresh.mau = Math.max(agg.maxWau, carryMau);
      byId.set(agg.id, fresh);
      carryMau = fresh.mau;
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime()
  );
}

export function saveData(data: MonthlyData[]): void {
  // Always write to /tmp — works on Vercel and locally
  fs.writeFileSync(TMP_FILE, JSON.stringify(data, null, 2));
}

export function upsertMonth(entry: MonthlyData): void {
  const all = getLocalData();
  const idx = all.findIndex((d) => d.id === entry.id);
  if (idx >= 0) {
    all[idx] = entry;
  } else {
    all.push(entry);
  }
  saveData(all);
}

function daysInPeriod(start: string, end: string): number {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)) + 1);
}

function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

export function enrichWithGrowth(data: MonthlyData[]): MonthlyDataWithGrowth[] {
  return data.map((row, i) => {
    const prev = i > 0 ? data[i - 1] : null;
    const days = daysInPeriod(row.dateStart, row.dateEnd);

    return {
      ...row,
      growth: {
        mau: prev ? pctChange(row.mau, prev.mau) : null,
        activeBrands: prev ? pctChange(row.activeBrands, prev.activeBrands) : null,
        betsPlaced: prev ? pctChange(row.betsPlaced, prev.betsPlaced) : null,
        wager: prev ? pctChange(row.wager, prev.wager) : null,
        ggr: prev ? pctChange(row.ggr, prev.ggr) : null,
        fees: prev ? pctChange(row.fees, prev.fees) : null,
      },
      daily: {
        wager: row.wager / days,
        ggr: row.ggr / days,
        fees: row.fees / days,
      },
      annualized: {
        wager: row.wager * 12,
        ggr: row.ggr * 12,
        fees: row.fees * 12,
      },
    };
  });
}
