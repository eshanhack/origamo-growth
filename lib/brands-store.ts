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

// On Vercel (and other serverless platforms) process.cwd() is read-only.
// We write mutations to /tmp which is always writable, and seed from the
// bundled data/brands.json that ships with the repo (if present).
const BUNDLED_FILE = path.join(process.cwd(), "data", "brands.json");
const TMP_FILE = "/tmp/origamo-brands.json";

function readJson(filePath: string): BrandsState | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.brands)) {
      return {
        brands: parsed.brands,
        activity: Array.isArray(parsed.activity) ? parsed.activity : [],
        settings: parsed.settings ?? null,
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function loadBrandsState(): BrandsState {
  // 1. Prefer /tmp (holds any in-session mutations)
  const tmp = readJson(TMP_FILE);
  if (tmp) return tmp;

  // 2. Fall back to the committed bundled file
  const bundled = readJson(BUNDLED_FILE);
  if (bundled) {
    try {
      fs.writeFileSync(TMP_FILE, JSON.stringify(bundled, null, 2));
    } catch {
      /* ignore */
    }
    return bundled;
  }

  // 3. Empty initial state
  return { ...EMPTY_STATE };
}

export function saveBrandsState(state: BrandsState): BrandsState {
  const next: BrandsState = {
    brands: Array.isArray(state.brands) ? state.brands : [],
    activity: Array.isArray(state.activity) ? state.activity : [],
    settings: state.settings ?? null,
    updatedAt: new Date().toISOString(),
  };
  try {
    fs.writeFileSync(TMP_FILE, JSON.stringify(next, null, 2));
  } catch (e) {
    console.error("[brands-store] Failed to write state:", e);
  }
  return next;
}

export function hasPersistedState(): boolean {
  return Boolean(readJson(TMP_FILE) || readJson(BUNDLED_FILE));
}
