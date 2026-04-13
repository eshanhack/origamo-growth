/**
 * Google Sheet integration
 *
 * Pulls weekly metrics from a published Google Sheet and aggregates them
 * into monthly totals. The sheet URL can be overridden via the
 * METRICS_SHEET_URL env var.
 *
 * Required sheet columns (first row = headers):
 *   A: Date Start (dd/MM/yyyy)
 *   B: Date End   (dd/MM/yyyy)
 *   C: WAU
 *   D: Effective Edge (e.g. "2.35%")
 *   E: Bets Placed
 *   F: Wager
 *   G: GGR
 *   H: Fees
 *   I: #1 Brand
 *   J: #2 Brand
 *   K: #3 Brand
 */

const DEFAULT_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1Mpwcc_UZL1Z4R1d6aVsb95IM_2KLYkpXhCvOd_EhKWY/export?format=csv";

// Same spreadsheet, second tab ("MoM") — pre-computed one-row-per-month totals.
const DEFAULT_MONTHLY_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1Mpwcc_UZL1Z4R1d6aVsb95IM_2KLYkpXhCvOd_EhKWY/export?format=csv&gid=928606044";

export interface WeeklyRow {
  dateStart: Date;
  dateEnd: Date;
  wau: number;
  effectiveEdge: number;
  betsPlaced: number;
  wager: number;
  ggr: number;
  fees: number;
  brand1?: string;
  brand2?: string;
  brand3?: string;
}

export interface MonthlyRow {
  id: string;           // yyyy-MM
  year: number;
  month: number;        // 1-12
  dateStart: Date;
  dateEnd: Date;
  mau: number;
  effectiveEdge: number;
  betsPlaced: number;
  wager: number;
  ggr: number;
  fees: number;
  brand1?: string;
  brand2?: string;
  brand3?: string;
}

export interface MonthlyAggregate {
  id: string;            // yyyy-MM
  year: number;
  month: number;         // 1-12
  wager: number;
  ggr: number;
  fees: number;
  betsPlaced: number;
  effectiveEdge: number;
  maxWau: number;
  topBrands: string[];
}

// ─── CSV parsing ────────────────────────────────────────────────────────────
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cell);
        cell = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += ch;
      }
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

function parseDmy(s: string): Date | null {
  if (!s) return null;
  const parts = s.split("/").map((x) => parseInt(x, 10));
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [d, m, y] = parts;
  return new Date(Date.UTC(y, m - 1, d));
}

function parseNum(s: string): number {
  if (!s) return 0;
  const cleaned = s.replace(/,/g, "").replace(/%/g, "").trim();
  if (!cleaned) return 0;
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

// ─── Fetch ──────────────────────────────────────────────────────────────────
export async function fetchWeeklyRows(): Promise<WeeklyRow[]> {
  const url = process.env.METRICS_SHEET_URL || DEFAULT_SHEET_URL;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) {
    throw new Error(`Sheet fetch failed: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  const rows = parseCsv(text);
  const out: WeeklyRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 8) continue;
    const ds = parseDmy(r[0]);
    const de = parseDmy(r[1]);
    if (!ds || !de) continue;
    out.push({
      dateStart: ds,
      dateEnd: de,
      wau: parseNum(r[2]),
      effectiveEdge: parseNum(r[3]) / 100, // "2.35%" → 0.0235
      betsPlaced: parseNum(r[4]),
      wager: parseNum(r[5]),
      ggr: parseNum(r[6]),
      fees: parseNum(r[7]),
      brand1: (r[8] || "").trim() || undefined,
      brand2: (r[9] || "").trim() || undefined,
      brand3: (r[10] || "").trim() || undefined,
    });
  }
  return out;
}

/**
 * Fetch the MoM tab, which contains one authoritative row per calendar month.
 * Header columns mirror the weekly tab except column C is MAU (not WAU).
 */
export async function fetchMonthlyRows(): Promise<MonthlyRow[]> {
  const url = process.env.METRICS_MONTHLY_SHEET_URL || DEFAULT_MONTHLY_SHEET_URL;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) {
    throw new Error(`Monthly sheet fetch failed: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  const rows = parseCsv(text);
  const out: MonthlyRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 8) continue;
    const ds = parseDmy(r[0]);
    const de = parseDmy(r[1]);
    if (!ds || !de) continue;
    const year = ds.getUTCFullYear();
    const month = ds.getUTCMonth() + 1;
    out.push({
      id: `${year}-${String(month).padStart(2, "0")}`,
      year,
      month,
      dateStart: ds,
      dateEnd: de,
      mau: parseNum(r[2]),
      effectiveEdge: parseNum(r[3]) / 100,
      betsPlaced: parseNum(r[4]),
      wager: parseNum(r[5]),
      ggr: parseNum(r[6]),
      fees: parseNum(r[7]),
      brand1: (r[8] || "").trim() || undefined,
      brand2: (r[9] || "").trim() || undefined,
      brand3: (r[10] || "").trim() || undefined,
    });
  }
  return out;
}

// ─── Brand name normalization ──────────────────────────────────────────────
// Unifies case-variants like "Degencity" vs "DegenCity".
const BRAND_CANONICAL: Record<string, string> = {
  degencity: "DegenCity",
  csgo500: "CSGO500",
  metaspins: "Metaspins",
  cloudbet: "Cloudbet",
  betbolt: "Betbolt",
  drizzle: "Drizzle",
  bitcasino: "Bitcasino",
  spartans: "Spartans",
  kirgo: "Kirgo",
  gambana: "Gambana",
  biggg: "Biggg",
  rivalry: "Rivalry",
  sportsbet: "Sportsbet",
  spinbet: "Spinbet",
  gamblr: "Gamblr",
  tigrabit: "Tigrabit",
  chanced: "Chanced",
};

function normalizeBrand(name: string): string {
  const lower = name.toLowerCase().trim();
  return BRAND_CANONICAL[lower] || name.trim();
}

// ─── Aggregation ────────────────────────────────────────────────────────────
function totalDays(start: Date, end: Date): number {
  const diff = end.getTime() - start.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
}

interface InternalAggregate extends MonthlyAggregate {
  _brandScore: Map<string, number>;
}

export function aggregateMonthly(rows: WeeklyRow[]): MonthlyAggregate[] {
  const months = new Map<string, InternalAggregate>();

  const getOrCreate = (id: string, y: number, m: number): InternalAggregate => {
    let agg = months.get(id);
    if (!agg) {
      agg = {
        id,
        year: y,
        month: m,
        wager: 0,
        ggr: 0,
        fees: 0,
        betsPlaced: 0,
        effectiveEdge: 0,
        maxWau: 0,
        topBrands: [],
        _brandScore: new Map(),
      };
      months.set(id, agg);
    }
    return agg;
  };

  for (const row of rows) {
    const totalDaysInWeek = totalDays(row.dateStart, row.dateEnd);
    if (totalDaysInWeek <= 0) continue;

    const dailyWager = row.wager / totalDaysInWeek;
    const dailyGgr = row.ggr / totalDaysInWeek;
    const dailyFees = row.fees / totalDaysInWeek;
    const dailyBets = row.betsPlaced / totalDaysInWeek;

    // Walk each day in the week and attribute proportionally
    const monthDays = new Map<string, { year: number; month: number; days: number }>();
    const cursor = new Date(row.dateStart.getTime());
    while (cursor <= row.dateEnd) {
      const y = cursor.getUTCFullYear();
      const m = cursor.getUTCMonth() + 1;
      const id = `${y}-${String(m).padStart(2, "0")}`;
      const existing = monthDays.get(id);
      if (existing) existing.days++;
      else monthDays.set(id, { year: y, month: m, days: 1 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    monthDays.forEach(({ year, month, days }, id) => {
      const agg = getOrCreate(id, year, month);
      agg.wager += dailyWager * days;
      agg.ggr += dailyGgr * days;
      agg.fees += dailyFees * days;
      agg.betsPlaced += dailyBets * days;
      if (row.wau > agg.maxWau) agg.maxWau = row.wau;

      const weightFactor = days / totalDaysInWeek;
      const brands: (string | undefined)[] = [row.brand1, row.brand2, row.brand3];
      brands.forEach((b, idx) => {
        if (!b) return;
        const norm = normalizeBrand(b);
        const weight = (3 - idx) * weightFactor;
        agg._brandScore.set(norm, (agg._brandScore.get(norm) || 0) + weight);
      });
    });
  }

  // Finalize
  const result: MonthlyAggregate[] = [];
  months.forEach((agg) => {
    const sorted = Array.from(agg._brandScore.entries()).sort((a, b) => b[1] - a[1]);
    const { _brandScore, ...rest } = agg;
    void _brandScore;
    result.push({
      ...rest,
      topBrands: sorted.slice(0, 3).map(([name]) => name),
      wager: Math.round(agg.wager),
      ggr: Math.round(agg.ggr),
      fees: Math.round(agg.fees),
      betsPlaced: Math.round(agg.betsPlaced),
      effectiveEdge:
        agg.wager > 0 ? Math.round((agg.ggr / agg.wager) * 10000) / 10000 : 0,
    });
  });
  return result.sort((a, b) => a.id.localeCompare(b.id));
}
