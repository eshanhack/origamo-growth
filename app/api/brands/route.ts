import { NextRequest, NextResponse } from "next/server";
import { loadBrandsState, saveBrandsState, BrandsState } from "@/lib/brands-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// NOTE: this route is gated by middleware — any request that reaches
// this handler has already had its session cookie verified.

export async function GET() {
  const state = await loadBrandsState();
  return NextResponse.json(state);
}

// Safety net: refuse any PUT that would catastrophically shrink the
// brands list. A legitimate delete drops one brand at a time; a buggy
// client pushing seed/stale data usually wants to halve or empty it.
// The ?force=1 query param bypasses the guard for intentional restores.
const SHRINK_RATIO_LIMIT = 0.5;
const SHRINK_MIN_BRANDS = 10;

export async function PUT(req: NextRequest) {
  let body: Partial<BrandsState>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || !Array.isArray(body.brands)) {
    return NextResponse.json(
      { error: "Expected body { brands: [], activity?: [], settings?: {} }" },
      { status: 400 },
    );
  }

  const force = req.nextUrl.searchParams.get("force") === "1";
  if (!force) {
    const existing = await loadBrandsState();
    const existingCount = existing.brands.length;
    const incomingCount = body.brands.length;
    if (
      existingCount >= SHRINK_MIN_BRANDS &&
      incomingCount < existingCount * SHRINK_RATIO_LIMIT
    ) {
      console.error(
        `[api/brands] refusing PUT: would shrink ${existingCount} → ${incomingCount}`,
      );
      return NextResponse.json(
        {
          error: "refused: catastrophic shrink guard",
          existingCount,
          incomingCount,
          hint: "pass ?force=1 if this is an intentional restore",
        },
        { status: 409 },
      );
    }
  }

  const saved = await saveBrandsState({
    brands: body.brands,
    activity: Array.isArray(body.activity) ? body.activity : [],
    settings: body.settings ?? null,
  });
  return NextResponse.json(saved);
}
