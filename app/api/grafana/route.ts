import { NextRequest, NextResponse } from "next/server";
import { fetchMonthFromGrafana } from "@/lib/grafana";
import { upsertMonth, getAllData, enrichWithGrowth } from "@/lib/data";
import { MonthlyData } from "@/lib/types";
import { format } from "date-fns";

/**
 * POST /api/grafana
 * Body: { year: number, month: number }  (month = 1-12)
 *
 * Fetches data for the given month from Grafana and saves it.
 * Requires GRAFANA_URL and GRAFANA_API_KEY env vars.
 */
export async function POST(req: NextRequest) {
  const { GRAFANA_URL, GRAFANA_API_KEY } = process.env;

  if (!GRAFANA_URL || !GRAFANA_API_KEY) {
    return NextResponse.json(
      {
        error: "Grafana not configured",
        hint: "Add GRAFANA_URL and GRAFANA_API_KEY to .env.local",
      },
      { status: 503 }
    );
  }

  const body = await req.json();
  const { year, month } = body as { year: number; month: number };

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json(
      { error: "Provide { year, month } where month is 1-12" },
      { status: 400 }
    );
  }

  const partial = await fetchMonthFromGrafana(year, month);
  if (!partial) {
    return NextResponse.json(
      {
        error: "No data returned from Grafana",
        hint: "Check panel IDs in lib/grafana.ts match your dashboard",
      },
      { status: 502 }
    );
  }

  const dateStart = new Date(year, month - 1, 1);
  const dateEnd = new Date(year, month, 0); // last day of month

  const entry: MonthlyData = {
    id: format(dateStart, "yyyy-MM"),
    label: format(dateStart, "MMM yyyy"),
    dateStart: format(dateStart, "yyyy-MM-dd"),
    dateEnd: format(dateEnd, "yyyy-MM-dd"),
    mau: partial.mau ?? 0,
    activeBrands: partial.activeBrands ?? 0,
    betsPlaced: partial.betsPlaced ?? 0,
    effectiveEdge: partial.effectiveEdge ?? 0,
    wager: partial.wager ?? 0,
    ggr: partial.ggr ?? 0,
    fees: partial.fees ?? 0,
    source: "grafana",
  };

  upsertMonth(entry);

  const updated = enrichWithGrowth(await getAllData());
  return NextResponse.json({ saved: entry, all: updated });
}
