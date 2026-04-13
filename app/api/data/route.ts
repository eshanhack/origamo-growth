import { NextRequest, NextResponse } from "next/server";
import { getAllData, enrichWithGrowth, upsertMonth } from "@/lib/data";
import { MonthlyData } from "@/lib/types";

export async function GET() {
  const raw = await getAllData();
  const enriched = enrichWithGrowth(raw);
  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  try {
    const body: MonthlyData = await req.json();

    // Basic validation
    const required: (keyof MonthlyData)[] = [
      "id", "label", "dateStart", "dateEnd",
      "mau", "activeBrands", "betsPlaced",
      "effectiveEdge", "wager", "ggr", "fees",
    ];
    for (const field of required) {
      if (body[field] === undefined || body[field] === null) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    body.source = body.source ?? "manual";
    upsertMonth(body);

    const updated = enrichWithGrowth(await getAllData());
    return NextResponse.json(updated, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
