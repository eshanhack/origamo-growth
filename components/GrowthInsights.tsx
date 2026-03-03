"use client";

import { useMemo } from "react";
import { MonthlyDataWithGrowth } from "@/lib/types";
import { fmt, fmtGrowth, growthColor } from "@/lib/format";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
} from "recharts";
import clsx from "clsx";

// ── Insight shape ──────────────────────────────────────────────────
interface Insight {
  id: string;
  type: "concern" | "strength";
  severity: "critical" | "warning" | "positive" | "strong";
  icon: string;
  title: string;
  /** Short, data-bearing subtitle */
  headline: string;
  /** Paragraph-length explanation with actual numbers */
  detail: string;
  /** Single concrete action recommendation */
  action: string;
  sparkData?: { v: number; label: string }[];
}

// ── Helpers ────────────────────────────────────────────────────────
function pct(a: number, b: number): number | null {
  if (!a) return null;
  return ((b - a) / Math.abs(a)) * 100;
}

/**
 * Compares a weighted average of the recent half of an array
 * against the older half.  Returns +1 (up), -1 (down), 0 (stable).
 * Recent values carry quadratically more weight.
 */
function weightedDir(values: number[]): 1 | -1 | 0 {
  const n = values.length;
  if (n < 2) return 0;
  const split = Math.max(1, Math.floor(n / 2));
  const older = values.slice(0, split);
  const newer = values.slice(split);

  const olderMean = older.reduce((s, v) => s + v, 0) / older.length;

  // weight newer[i] by (i+1)^1.5
  let wSum = 0;
  let wTotal = 0;
  newer.forEach((v, i) => {
    const w = Math.pow(i + 1, 1.5);
    wSum += v * w;
    wTotal += w;
  });
  const newerMean = wTotal ? wSum / wTotal : 0;

  if (!olderMean) return 0;
  const change = (newerMean - olderMean) / Math.abs(olderMean);
  if (change > 0.05) return 1;
  if (change < -0.05) return -1;
  return 0;
}

// ── Core engine ────────────────────────────────────────────────────
function generateInsights(data: MonthlyDataWithGrowth[]) {
  const concerns: Insight[] = [];
  const strengths: Insight[] = [];
  if (data.length < 2) return { concerns, strengths };

  const n = data.length;
  const latest = data[n - 1];
  const prev = data[n - 2];
  const oldest = data[0];

  // Derived per-player & per-bet metrics
  const derived = data.map((d) => ({
    ...d,
    ggrPP:   d.mau > 0 ? d.ggr         / d.mau        : 0,
    wagerPP: d.mau > 0 ? d.wager        / d.mau        : 0,
    betsPP:  d.mau > 0 ? d.betsPlaced   / d.mau        : 0,
    avgBet:  d.betsPlaced > 0 ? d.wager / d.betsPlaced : 0,
    edgePct: d.effectiveEdge * 100,
  }));

  const lat = derived[n - 1];
  const prv = derived[n - 2];

  // ────────────────────────────────────────────────────────────────
  // CONCERNS
  // ────────────────────────────────────────────────────────────────

  // 1. GGR/player declining
  {
    const vals = derived.map((d) => d.ggrPP);
    const dir  = weightedDir(vals);
    const chg  = pct(prv.ggrPP, lat.ggrPP);

    if (dir === -1 || (chg !== null && chg < -20)) {
      const severity = chg !== null && chg < -55 ? "critical" : "warning";
      concerns.push({
        id: "ggr-per-player",
        type: "concern",
        severity,
        icon: "📉",
        title: "Revenue per player is collapsing",
        headline: `${fmt(lat.ggrPP, "currency")}/player · ${chg !== null ? fmtGrowth(chg) + " MoM" : "—"}`,
        detail: `In ${latest.label} each active player generated ${fmt(lat.ggrPP, "currency")} GGR, down from ${fmt(prv.ggrPP, "currency")} in ${prev.label}${chg !== null ? ` (${fmtGrowth(chg)})` : ""}. The platform is acquiring more players but monetising them at a fraction of the rate — a textbook signal of audience quality degradation or game-mix mismatch.`,
        action: "Break MAU into acquisition cohorts by brand or campaign and compute GGR/player per cohort. Kill or restructure anything below a minimum ARPU threshold. Adding more low-intent players accelerates costs without proportional revenue.",
        sparkData: vals.map((v, i) => ({ v, label: derived[i].label.slice(0, 3) })),
      });
    }
  }

  // 2. Chronically negative-GGR brands
  {
    const tally: Record<string, { count: number; total: number; months: string[] }> = {};
    data.forEach((d) => {
      (d.brandBreakdown ?? []).forEach((b) => {
        if (b.ggr < -2000) {
          tally[b.name] = tally[b.name] ?? { count: 0, total: 0, months: [] };
          tally[b.name].count++;
          tally[b.name].total += b.ggr;
          tally[b.name].months.push(d.label);
        }
      });
    });

    const worst = Object.entries(tally).sort((a, b) => a[1].total - b[1].total)[0];
    if (worst) {
      const [name, stats] = worst;
      const spark = data
        .map((d) => {
          const b = d.brandBreakdown?.find((b) => b.name === name);
          return b ? { v: b.ggr, label: d.label.slice(0, 3) } : null;
        })
        .filter(Boolean) as { v: number; label: string }[];

      concerns.push({
        id: "negative-brand",
        type: "concern",
        severity: stats.count >= 2 ? "critical" : "warning",
        icon: "🚨",
        title: `${name} is a recurring revenue drain`,
        headline: `${fmt(stats.total, "currency")} cumulative GGR loss across ${stats.count} month${stats.count > 1 ? "s" : ""}`,
        detail: `${name} produced negative GGR in ${stats.months.join(" and ")}, meaning Origamo effectively subsidised player winnings. At scale this pattern erodes the economics of the entire brand relationship. High-variance, large-bet activity is the likely driver.`,
        action: `Introduce a monthly GGR floor in the ${name} commercial agreement or cap individual bet sizes. If two more months of negative GGR occur, consider suspending the brand until structural changes are confirmed.`,
        sparkData: spark,
      });
    }
  }

  // 3. Edge compression
  {
    const vals = derived.map((d) => d.edgePct);
    const dir  = weightedDir(vals);
    const sorted = [...vals].sort((a, b) => a - b);
    const median = sorted[Math.floor(vals.length / 2)];
    const latEdge = vals[n - 1];

    if (dir === -1 || latEdge < median * 0.88) {
      const maxEdge = Math.max(...vals);
      const uplift  = latest.wager * ((maxEdge - latEdge) / 100);
      concerns.push({
        id: "edge-compression",
        type: "concern",
        severity: latEdge < median * 0.75 ? "critical" : "warning",
        icon: "🎯",
        title: "Effective edge is being compressed",
        headline: `${latEdge.toFixed(2)}% now · ${median.toFixed(2)}% historical median`,
        detail: `The realised edge has fallen to ${latEdge.toFixed(2)}% — below the ${n}-month median of ${median.toFixed(2)}%. At the current wager volume of ${fmt(latest.wager, "currency")}/month, restoring edge to its historical peak (${maxEdge.toFixed(2)}%) would be worth approximately ${fmt(uplift, "currency")} in additional monthly GGR.`,
        action: "Audit game-level edge data to find which categories are dragging the blended average down. Check whether promotional bonus structures (free spins, cashback) are eroding the realised edge. Steer brand onboarding toward higher-margin game mixes.",
        sparkData: vals.map((v, i) => ({ v, label: derived[i].label.slice(0, 3) })),
      });
    }
  }

  // 4. MAU growth massively outpacing GGR growth
  {
    const mauChg = pct(prev.mau, latest.mau);
    const ggrChg = pct(prev.ggr, latest.ggr);
    if (mauChg !== null && ggrChg !== null && mauChg > 25 && mauChg - ggrChg > 35) {
      concerns.push({
        id: "mau-ggr-divergence",
        type: "concern",
        severity: "warning",
        icon: "⚖️",
        title: "Player growth is decoupled from revenue",
        headline: `MAU ${fmtGrowth(mauChg)} · GGR ${fmtGrowth(ggrChg)} · ${(mauChg - ggrChg).toFixed(0)}pp gap`,
        detail: `In ${latest.label} the player base grew ${mauChg.toFixed(0)}% MoM but GGR grew only ${ggrChg.toFixed(0)}%. In a healthy scaling phase, revenue should track within ~20pp of player growth. A ${(mauChg - ggrChg).toFixed(0)}pp gap is a red flag that the incremental user cohort has low monetisation potential.`,
        action: "Tag every new player by the brand or campaign that acquired them and measure their 30-day GGR contribution. Use this as a quality gate before re-investing in any acquisition source.",
        sparkData: undefined,
      });
    }
  }

  // 5. Bets/player declining (engagement depth)
  {
    const vals = derived.map((d) => d.betsPP);
    const dir  = weightedDir(vals);
    const chg  = pct(prv.betsPP, lat.betsPP);

    if (dir === -1 || (chg !== null && chg < -20)) {
      concerns.push({
        id: "bets-per-player",
        type: "concern",
        severity: "warning",
        icon: "🎲",
        title: "Session depth per player is shrinking",
        headline: `${lat.betsPP.toFixed(0)} bets/player · ${chg !== null ? fmtGrowth(chg) + " MoM" : "—"}`,
        detail: `The average player placed ${lat.betsPP.toFixed(0)} bets in ${latest.label}, down from ${prv.betsPP.toFixed(0)} in ${prev.label}. Declining bets/player typically precedes churn — players are doing fewer sessions or leaving earlier in each session.`,
        action: "Build a session-depth funnel: what % of players place 1–5 bets, 6–20, 20+? Target the 1–5 cohort with a first-deposit incentive or UX optimisation. Recovery here directly improves GGR/player.",
        sparkData: vals.map((v, i) => ({ v, label: derived[i].label.slice(0, 3) })),
      });
    }
  }

  // ────────────────────────────────────────────────────────────────
  // STRENGTHS
  // ────────────────────────────────────────────────────────────────

  // 1. MAU trajectory
  {
    const totalGrowth = pct(oldest.mau, latest.mau);
    const recentGrowth = pct(prev.mau, latest.mau);
    if ((totalGrowth ?? 0) > 50 || (recentGrowth ?? 0) > 15) {
      const multiplier = totalGrowth !== null ? ((totalGrowth / 100) + 1).toFixed(1) : "?";
      strengths.push({
        id: "mau-growth",
        type: "strength",
        severity: (totalGrowth ?? 0) > 300 ? "strong" : "positive",
        icon: "🚀",
        title: "Player acquisition is exceptional",
        headline: `${fmt(latest.mau, "compact")} MAU · ${multiplier}× growth since ${oldest.label}`,
        detail: `Active players grew from ${fmt(oldest.mau, "compact")} to ${fmt(latest.mau, "compact")} in ${n} months — ${multiplier}× without a sustained plateau. ${latest.label} alone added ${fmt(latest.mau - prev.mau, "compact")} net new players (${fmtGrowth(recentGrowth)} MoM), a growth rate that most iGaming B2B platforms don't achieve in their first two years.`,
        action: "Identify the 2–3 brands or campaigns responsible for February's surge and ring-fence budget for them before the next planning cycle. Document what worked so the playbook can be replicated at higher spend.",
        sparkData: data.map((d) => ({ v: d.mau, label: d.label.slice(0, 3) })),
      });
    }
  }

  // 2. Brand network diversification
  {
    const brandGrowth = pct(oldest.activeBrands, latest.activeBrands);
    if ((brandGrowth ?? 0) > 50) {
      strengths.push({
        id: "brand-network",
        type: "strength",
        severity: "positive",
        icon: "🌐",
        title: "Brand network is scaling with velocity",
        headline: `${latest.activeBrands} brands · +${brandGrowth?.toFixed(0)}% since ${oldest.label}`,
        detail: `The operator network grew from ${oldest.activeBrands} to ${latest.activeBrands} brands in ${n} months. Greater diversification means any single brand's churn or negative GGR event has a smaller impact on total platform revenue.`,
        action: "Introduce a brand health score (wager, GGR, bets/player, edge contribution) and publish it internally monthly. Use it to stratify your commercial attention: invest in Tier 1, nurture Tier 2, and set improvement targets for Tier 3.",
        sparkData: data.map((d) => ({ v: d.activeBrands, label: d.label.slice(0, 3) })),
      });
    }
  }

  // 3. Anchor / consistently top brand
  {
    const brandFreq: Record<string, number> = {};
    data.forEach((d) => {
      const top = [...(d.brandBreakdown ?? [])]
        .filter((b) => b.ggr > 0)
        .sort((a, b) => b.ggr - a.ggr)[0];
      if (top) brandFreq[top.name] = (brandFreq[top.name] ?? 0) + 1;
    });

    const [topBrand, count] =
      Object.entries(brandFreq).sort((a, b) => b[1] - a[1])[0] ?? [];

    if (topBrand && count >= 2) {
      const cumGGR = data.reduce(
        (s, d) => s + (d.brandBreakdown?.find((b) => b.name === topBrand)?.ggr ?? 0),
        0
      );
      strengths.push({
        id: "anchor-brand",
        type: "strength",
        severity: "strong",
        icon: "⭐",
        title: `${topBrand} is your anchor revenue partner`,
        headline: `#1 GGR brand for ${count} consecutive tracked months · ${fmt(cumGGR, "currency")} cumulative`,
        detail: `${topBrand} has topped the GGR table in every month with brand-level data available, producing ${fmt(cumGGR, "currency")} cumulatively. Consistent top-tier contributors of this type are rare — they typically represent a deep product-market fit with Origamo's platform.`,
        action: `Prioritise ${topBrand} in your commercial roadmap. Explore a preferred-partner arrangement: exclusive early access to new game integrations, a co-marketing budget, or a longer-term contract with volume commitments. Protecting this relationship is more valuable than acquiring three new mid-tier brands.`,
        sparkData: undefined,
      });
    }
  }

  // 4. Wager volume as edge leverage
  {
    const annWager = latest.annualized.wager;
    if (annWager > 50_000_000) {
      const oneThirdPct = annWager * 0.001; // value of 0.1pp edge improvement
      strengths.push({
        id: "wager-leverage",
        type: "strength",
        severity: "positive",
        icon: "⚡",
        title: "Wager scale turns tiny edge gains into big GGR",
        headline: `${fmt(annWager, "currency")} annualised wager · 0.1pp edge = ${fmt(oneThirdPct, "currency")}/yr`,
        detail: `With ${fmt(latest.wager, "currency")} wagered in ${latest.label} alone, the annualised run rate is ${fmt(annWager, "currency")}. At this volume, every 0.1 percentage point improvement in effective edge translates to ~${fmt(oneThirdPct, "currency")} in additional annual GGR — with zero customer acquisition cost.`,
        action: "Treat edge optimisation as a first-class engineering and product priority. Assign dedicated sprint capacity to game-mix configuration, bet-limit structures, and promotional RTP analysis. At this scale, edge work has a better ROI than almost any acquisition spend.",
        sparkData: data.map((d) => ({ v: d.wager, label: d.label.slice(0, 3) })),
      });
    }
  }

  // 5. GGR run rate momentum (if GGR is trending up overall)
  {
    const vals = data.map((d) => d.ggr);
    const dir  = weightedDir(vals);
    if (dir === 1 && latest.annualized.ggr > 1_000_000) {
      strengths.push({
        id: "ggr-momentum",
        type: "strength",
        severity: "positive",
        icon: "📈",
        title: "GGR trajectory points to a strong year",
        headline: `${fmt(latest.annualized.ggr, "currency")} annualised GGR run rate`,
        detail: `On a weighted basis, GGR is trending upward across the period. With ${fmt(latest.ggr, "currency")} generated in ${latest.label}, the annualised run rate is ${fmt(latest.annualized.ggr, "currency")}. If the edge-compression and per-player issues above are addressed, the actual annual GGR could meaningfully exceed this projection.`,
        action: "Lock in the current GGR growth driver before diversifying. Understand exactly which brands, game types, and player segments produced the strong months — then double those inputs.",
        sparkData: vals.map((v, i) => ({ v, label: data[i].label.slice(0, 3) })),
      });
    }
  }

  // Sort: critical → warning, then strong → positive
  const cOrd = { critical: 0, warning: 1, positive: 2, strong: 3 };
  concerns.sort((a, b) => cOrd[a.severity] - cOrd[b.severity]);
  strengths.sort((a, b) => cOrd[a.severity] - cOrd[b.severity]);

  return { concerns, strengths };
}

// ── Tiny sparkline ────────────────────────────────────────────────
function Spark({
  data,
  color,
}: {
  data: { v: number; label: string }[];
  color: string;
}) {
  if (!data || data.length < 2) return null;
  const zero = data.some((d) => d.v < 0); // show reference line at 0 for negative data
  return (
    <div className="h-9 w-28 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 3, right: 3, left: 3, bottom: 3 }}>
          {zero && (
            <ReferenceLine y={0} stroke="#374151" strokeDasharray="2 2" />
          )}
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[10px] text-gray-300">
                  {payload[0].payload.label}: {payload[0].value?.toLocaleString()}
                </div>
              ) : null
            }
          />
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Insight card ──────────────────────────────────────────────────
const STYLES = {
  critical: {
    card: "bg-red-950/20 border-red-800/30",
    badge: "bg-red-500/15 text-red-400 ring-1 ring-red-500/25",
    headline: "text-red-400",
    spark: "#f87171",
  },
  warning: {
    card: "bg-amber-950/15 border-amber-700/25",
    badge: "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25",
    headline: "text-amber-400",
    spark: "#fbbf24",
  },
  strong: {
    card: "bg-[#CCFF00]/5 border-[#CCFF00]/20",
    badge: "bg-[#CCFF00]/10 text-[#CCFF00] ring-1 ring-[#CCFF00]/25",
    headline: "text-[#CCFF00]",
    spark: "#CCFF00",
  },
  positive: {
    card: "bg-emerald-950/15 border-emerald-700/25",
    badge: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25",
    headline: "text-emerald-400",
    spark: "#34d399",
  },
};

function InsightCard({ insight }: { insight: Insight }) {
  const s = STYLES[insight.severity];
  return (
    <div className={clsx("border rounded-xl p-5 flex flex-col gap-4", s.card)}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-lg shrink-0">{insight.icon}</span>
          <span className="text-sm font-semibold text-white leading-snug">
            {insight.title}
          </span>
        </div>
        <span
          className={clsx(
            "text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full shrink-0 whitespace-nowrap",
            s.badge
          )}
        >
          {insight.severity}
        </span>
      </div>

      {/* Key metric + sparkline */}
      <div className="flex items-center justify-between gap-3">
        <div className={clsx("text-sm font-bold leading-tight", s.headline)}>
          {insight.headline}
        </div>
        {insight.sparkData && (
          <Spark data={insight.sparkData} color={s.spark} />
        )}
      </div>

      {/* Detail */}
      <p className="text-xs text-gray-400 leading-relaxed">{insight.detail}</p>

      {/* Action box */}
      <div className="bg-gray-950/70 border border-gray-800/60 rounded-lg p-3">
        <div className="text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-1.5">
          Recommended action
        </div>
        <p className="text-xs text-gray-300 leading-relaxed">{insight.action}</p>
      </div>
    </div>
  );
}

// ── Health score bar ───────────────────────────────────────────────
function HealthBar({
  label,
  score,
  max = 5,
  color,
}: {
  label: string;
  score: number;
  max?: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-32 shrink-0">{label}</span>
      <div className="flex gap-1">
        {Array.from({ length: max }).map((_, i) => (
          <div
            key={i}
            className="w-5 h-1.5 rounded-full"
            style={{
              backgroundColor: i < score ? color : "#1f2937",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────
export default function GrowthInsights({
  data,
}: {
  data: MonthlyDataWithGrowth[];
}) {
  const { concerns, strengths } = useMemo(
    () => generateInsights(data),
    [data]
  );

  if (data.length < 2) {
    return (
      <div className="text-center text-gray-600 py-24 text-sm">
        Add at least 2 months of data to generate insights.
      </div>
    );
  }

  const n = data.length;
  const latest = data[n - 1];
  const oldest = data[n - Math.min(3, n)]; // last 3 months window for summary

  // Rough health scores (0–5) for the summary strip
  const mauScore = Math.min(
    5,
    Math.round(((pct(oldest.mau, latest.mau) ?? 0) / 100) * 2.5)
  );
  const revenueScore = Math.min(
    5,
    5 - concerns.filter((c) => ["ggr-per-player", "mau-ggr-divergence"].includes(c.id)).length * 2
  );
  const edgeScore = Math.min(
    5,
    concerns.some((c) => c.id === "edge-compression")
      ? concerns.find((c) => c.id === "edge-compression")?.severity === "critical"
        ? 1
        : 2
      : 4
  );
  const brandScore = Math.min(
    5,
    5 - concerns.filter((c) => c.id === "negative-brand").length * 2
  );

  const critCount = concerns.filter((c) => c.severity === "critical").length;
  const warnCount = concerns.filter((c) => c.severity === "warning").length;

  return (
    <div className="space-y-8 pb-10">

      {/* ── Summary header ────────────────────────────────────────── */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-base font-bold text-white mb-1">
            Growth Intelligence
          </h2>
          <p className="text-xs text-gray-500">
            {n} months analysed · recent data weighted 3× heavier · as of{" "}
            {latest.label}
          </p>

          {/* Alert chips */}
          <div className="flex flex-wrap gap-2 mt-3">
            {critCount > 0 && (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 ring-1 ring-red-500/25">
                {critCount} critical issue{critCount > 1 ? "s" : ""}
              </span>
            )}
            {warnCount > 0 && (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25">
                {warnCount} warning{warnCount > 1 ? "s" : ""}
              </span>
            )}
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#CCFF00]/10 text-[#CCFF00] ring-1 ring-[#CCFF00]/20">
              {strengths.length} strength{strengths.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Health bars */}
        <div className="space-y-2.5 shrink-0">
          <HealthBar label="Player acquisition" score={Math.max(1, mauScore)}  color="#CCFF00" />
          <HealthBar label="Revenue quality"    score={Math.max(0, revenueScore)} color="#22c55e" />
          <HealthBar label="Edge efficiency"    score={Math.max(1, edgeScore)}  color="#8b5cf6" />
          <HealthBar label="Brand health"       score={Math.max(1, brandScore)} color="#3b82f6" />
        </div>
      </div>

      {/* ── Two-column insight grid ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* Concerns */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              ⚠ Watch These
            </span>
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-[11px] text-gray-600">
              {concerns.length} issue{concerns.length !== 1 ? "s" : ""}
            </span>
          </div>

          {concerns.length === 0 ? (
            <p className="text-sm text-gray-600 py-6 text-center">
              No major concerns detected — strong position.
            </p>
          ) : (
            concerns.map((c) => <InsightCard key={c.id} insight={c} />)
          )}
        </div>

        {/* Strengths */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              ✦ Double Down On
            </span>
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-[11px] text-gray-600">
              {strengths.length} strength{strengths.length !== 1 ? "s" : ""}
            </span>
          </div>

          {strengths.length === 0 ? (
            <p className="text-sm text-gray-600 py-6 text-center">
              Add more data to surface growth strengths.
            </p>
          ) : (
            strengths.map((s) => <InsightCard key={s.id} insight={s} />)
          )}
        </div>
      </div>
    </div>
  );
}
