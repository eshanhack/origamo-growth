export function fmt(
  value: number,
  style: "currency" | "number" | "compact" | "percent" = "number",
  decimals = 0
): string {
  if (style === "currency") {
    if (value >= 1_000_000)
      return `$${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000)
      return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value.toFixed(decimals)}`;
  }
  if (style === "compact") {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toFixed(decimals);
  }
  if (style === "percent") {
    return `${(value * 100).toFixed(1)}%`;
  }
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

export function fmtGrowth(pct: number | null): string {
  if (pct === null) return "—";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function growthColor(pct: number | null): string {
  if (pct === null) return "text-gray-400";
  return pct >= 0 ? "text-emerald-400" : "text-red-400";
}
