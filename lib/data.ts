import { MonthlyData, MonthlyDataWithGrowth } from "./types";
import fs from "fs";
import path from "path";

// On Vercel (and other serverless platforms) process.cwd() is read-only.
// We write mutations to /tmp which is always writable, and seed from the
// bundled data/metrics.json that ships with the repo.
const BUNDLED_FILE = path.join(process.cwd(), "data", "metrics.json");
const TMP_FILE = "/tmp/origamo-metrics.json";

// ─── Seed data ────────────────────────────────────────────────────────────────
// Replace these placeholder values with your real numbers from the spreadsheet.
const SEED_DATA: MonthlyData[] = [
  {
    id: "2024-05",
    label: "May 2024",
    dateStart: "2024-05-01",
    dateEnd: "2024-05-31",
    mau: 210,
    activeBrands: 4,
    betsPlaced: 48200,
    effectiveEdge: 0.031,
    wager: 320000,
    ggr: 9920,
    fees: 4960,
    source: "manual",
  },
  {
    id: "2024-06",
    label: "Jun 2024",
    dateStart: "2024-06-01",
    dateEnd: "2024-06-30",
    mau: 265,
    activeBrands: 5,
    betsPlaced: 61400,
    effectiveEdge: 0.029,
    wager: 398000,
    ggr: 11542,
    fees: 5771,
    source: "manual",
  },
  {
    id: "2024-07",
    label: "Jul 2024",
    dateStart: "2024-07-01",
    dateEnd: "2024-07-31",
    mau: 310,
    activeBrands: 5,
    betsPlaced: 72100,
    effectiveEdge: 0.030,
    wager: 451000,
    ggr: 13530,
    fees: 6765,
    source: "manual",
  },
  {
    id: "2024-08",
    label: "Aug 2024",
    dateStart: "2024-08-01",
    dateEnd: "2024-08-31",
    mau: 378,
    activeBrands: 6,
    betsPlaced: 88900,
    effectiveEdge: 0.032,
    wager: 524000,
    ggr: 16768,
    fees: 8384,
    source: "manual",
  },
  {
    id: "2024-09",
    label: "Sep 2024",
    dateStart: "2024-09-01",
    dateEnd: "2024-09-30",
    mau: 442,
    activeBrands: 7,
    betsPlaced: 104500,
    effectiveEdge: 0.031,
    wager: 611000,
    ggr: 18941,
    fees: 9470,
    source: "manual",
  },
  {
    id: "2024-10",
    label: "Oct 2024",
    dateStart: "2024-10-01",
    dateEnd: "2024-10-31",
    mau: 523,
    activeBrands: 8,
    betsPlaced: 124800,
    effectiveEdge: 0.033,
    wager: 728000,
    ggr: 24024,
    fees: 12012,
    source: "manual",
  },
  {
    id: "2024-11",
    label: "Nov 2024",
    dateStart: "2024-11-01",
    dateEnd: "2024-11-30",
    mau: 601,
    activeBrands: 9,
    betsPlaced: 148600,
    effectiveEdge: 0.032,
    wager: 852000,
    ggr: 27264,
    fees: 13632,
    source: "manual",
  },
  {
    id: "2024-12",
    label: "Dec 2024",
    dateStart: "2024-12-01",
    dateEnd: "2024-12-31",
    mau: 694,
    activeBrands: 10,
    betsPlaced: 175200,
    effectiveEdge: 0.031,
    wager: 983000,
    ggr: 30473,
    fees: 15236,
    source: "manual",
  },
  {
    id: "2025-01",
    label: "Jan 2025",
    dateStart: "2025-01-01",
    dateEnd: "2025-01-31",
    mau: 758,
    activeBrands: 11,
    betsPlaced: 192400,
    effectiveEdge: 0.030,
    wager: 1072000,
    ggr: 32160,
    fees: 16080,
    source: "manual",
  },
  {
    id: "2025-02",
    label: "Feb 2025",
    dateStart: "2025-02-01",
    dateEnd: "2025-02-28",
    mau: 844,
    activeBrands: 12,
    betsPlaced: 218700,
    effectiveEdge: 0.031,
    wager: 1198000,
    ggr: 37138,
    fees: 18569,
    source: "manual",
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

export function getAllData(): MonthlyData[] {
  return loadData().sort(
    (a, b) => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime()
  );
}

export function saveData(data: MonthlyData[]): void {
  // Always write to /tmp — works on Vercel and locally
  fs.writeFileSync(TMP_FILE, JSON.stringify(data, null, 2));
}

export function upsertMonth(entry: MonthlyData): void {
  const all = getAllData();
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
