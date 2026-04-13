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

  const saved = await saveBrandsState({
    brands: body.brands,
    activity: Array.isArray(body.activity) ? body.activity : [],
    settings: body.settings ?? null,
  });
  return NextResponse.json(saved);
}
