import fs from "fs";
import path from "path";

// Mirrors the Brand shape used by components/BrandsPortfolio.tsx, but kept
// as an opaque JSON blob here — this file just reads and writes the
// serialized portfolio state (brands + activity log + settings) without
// caring about the shape. Keeping it opaque means adding fields on the
// client doesn't require touching the server.
export interface BrandsState {
  brands: unknown[];
  activity: unknown[];
  settings: Record<string, unknown> | null;
  updatedAt?: string;
}

const EMPTY_STATE: BrandsState = {
  brands: [],
  activity: [],
  settings: null,
};

// ─── Vercel KV (Upstash Redis) ──────────────────────────────────────────────
// On Vercel we use KV as the source of truth so every serverless instance
// (and every device) sees the same state. Locally, where these env vars
// usually aren't set, we fall back to /tmp so the dev loop keeps working.
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const KV_KEY = "origamo:brands";

function kvConfigured(): boolean {
  return Boolean(KV_URL && KV_TOKEN);
}

async function kvGet(): Promise<BrandsState | null> {
  if (!kvConfigured()) return null;
  try {
    const res = await fetch(`${KV_URL}/get/${KV_KEY}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[brands-store] KV GET failed: ${res.status}`);
      return null;
    }
    const json = (await res.json()) as { result: string | null };
    if (!json.result) return null;
    const parsed = JSON.parse(json.result);
    return normalise(parsed);
  } catch (e) {
    console.error("[brands-store] KV GET error:", e);
    return null;
  }
}

async function kvSet(state: BrandsState): Promise<boolean> {
  if (!kvConfigured()) return false;
  try {
    const res = await fetch(`${KV_URL}/set/${KV_KEY}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(state),
    });
    if (!res.ok) {
      console.error(`[brands-store] KV SET failed: ${res.status}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[brands-store] KV SET error:", e);
    return false;
  }
}

// ─── Filesystem fallback ────────────────────────────────────────────────────
// On Vercel (and other serverless platforms) process.cwd() is read-only.
// We write mutations to /tmp which is always writable, and seed from the
// bundled data/brands.json that ships with the repo (if present).
const BUNDLED_FILE = path.join(process.cwd(), "data", "brands.json");
const TMP_FILE = "/tmp/origamo-brands.json";

function normalise(parsed: unknown): BrandsState | null {
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.brands)) return null;
  return {
    brands: obj.brands,
    activity: Array.isArray(obj.activity) ? obj.activity : [],
    settings: (obj.settings as Record<string, unknown> | null) ?? null,
    updatedAt: typeof obj.updatedAt === "string" ? obj.updatedAt : undefined,
  };
}

function readJson(filePath: string): BrandsState | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return normalise(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function loadBrandsState(): Promise<BrandsState> {
  // 1. Prefer KV when configured — this is the only durable, shared store
  if (kvConfigured()) {
    const fromKv = await kvGet();
    if (fromKv) return fromKv;
    // Fall through: KV is empty, seed it from bundled file or empty state below
  }

  // 2. /tmp (holds any in-session mutations on filesystem deployments)
  const tmp = readJson(TMP_FILE);
  if (tmp) {
    // If KV is configured but empty, push /tmp up so we have a durable copy
    if (kvConfigured()) await kvSet(tmp);
    return tmp;
  }

  // 3. Bundled file shipped with the repo
  const bundled = readJson(BUNDLED_FILE);
  if (bundled) {
    try {
      fs.writeFileSync(TMP_FILE, JSON.stringify(bundled, null, 2));
    } catch {
      /* ignore */
    }
    if (kvConfigured()) await kvSet(bundled);
    return bundled;
  }

  // 4. Empty initial state
  return { ...EMPTY_STATE };
}

export async function saveBrandsState(state: BrandsState): Promise<BrandsState> {
  const next: BrandsState = {
    brands: Array.isArray(state.brands) ? state.brands : [],
    activity: Array.isArray(state.activity) ? state.activity : [],
    settings: state.settings ?? null,
    updatedAt: new Date().toISOString(),
  };

  // Always try KV first when configured — it's the source of truth.
  if (kvConfigured()) {
    const ok = await kvSet(next);
    if (!ok) {
      console.error("[brands-store] KV SET failed; falling back to /tmp only");
    }
  }

  // Mirror to /tmp so local dev (and KV outages) still work.
  try {
    fs.writeFileSync(TMP_FILE, JSON.stringify(next, null, 2));
  } catch (e) {
    // /tmp may not be writable in some test envs — only log if KV also missed
    if (!kvConfigured()) console.error("[brands-store] Failed to write state:", e);
  }

  return next;
}
