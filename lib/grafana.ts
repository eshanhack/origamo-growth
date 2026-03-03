/**
 * Grafana HTTP API integration
 *
 * HOW TO GET YOUR API KEY (no admin required in most Grafana versions):
 *   1. Log in to Grafana
 *   2. Go to your avatar (bottom-left) → Profile → API Keys  (Grafana < 9)
 *      OR: Administration → Service Accounts → New (Grafana 9+)
 *   3. Create a key with "Viewer" role
 *   4. Copy the key — set it as GRAFANA_API_KEY in .env.local
 *
 * .env.local should contain:
 *   GRAFANA_URL=https://your-grafana.example.com
 *   GRAFANA_API_KEY=glsa_xxxxxxxxxxxx
 *   GRAFANA_DASHBOARD_UID=your_dashboard_uid
 */

import { MonthlyData } from "./types";

interface GrafanaPanelTarget {
  datasource?: { type: string; uid: string };
  expr?: string;      // Prometheus/Loki query
  rawSql?: string;    // SQL datasource
  [key: string]: unknown;
}

interface GrafanaQueryResult {
  results: Record<
    string,
    {
      frames: Array<{
        data: { values: number[][] };
        schema: { fields: Array<{ name: string }> };
      }>;
    }
  >;
}

export async function fetchGrafanaPanel(
  panelId: number,
  from: string,
  to: string
): Promise<number | null> {
  const { GRAFANA_URL, GRAFANA_API_KEY, GRAFANA_DASHBOARD_UID } = process.env;
  if (!GRAFANA_URL || !GRAFANA_API_KEY) return null;

  try {
    // Use Grafana's data-proxy endpoint to query a panel's raw data
    const url = new URL(
      `/api/ds/query`,
      GRAFANA_URL
    );

    // Fetch dashboard JSON to get panel datasource/query info
    const dashRes = await fetch(
      `${GRAFANA_URL}/api/dashboards/uid/${GRAFANA_DASHBOARD_UID}`,
      {
        headers: { Authorization: `Bearer ${GRAFANA_API_KEY}` },
      }
    );
    if (!dashRes.ok) return null;

    const dash = await dashRes.json();
    const panels: Array<{ id: number; targets: GrafanaPanelTarget[] }> =
      dash.dashboard?.panels ?? [];
    const panel = panels.find((p) => p.id === panelId);
    if (!panel) return null;

    const target = panel.targets?.[0];
    if (!target?.datasource) return null;

    const body = {
      queries: [
        {
          ...target,
          refId: "A",
          maxDataPoints: 1,
        },
      ],
      from,
      to,
    };

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GRAFANA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const json: GrafanaQueryResult = await res.json();
    const frame = Object.values(json.results ?? {})[0]?.frames?.[0];
    const values = frame?.data?.values?.[1]; // [timestamps[], values[]]
    if (!values?.length) return null;

    return values[values.length - 1]; // last data point (end of period)
  } catch {
    return null;
  }
}

/**
 * Pull a full month's data from Grafana using known panel IDs.
 * Panel ID mapping — update these to match YOUR dashboard.
 *
 * To find panel IDs: open a panel in Grafana, click the panel title →
 * "Edit", then look at the URL — it contains panelId=XX.
 */
export const GRAFANA_PANEL_IDS = {
  mau: 2,           // Active Players panel
  activeBrands: 3,  // Active Brands panel
  betsPlaced: 4,    // Bets Placed panel
  wager: 5,         // Total Wager panel
  ggr: 6,           // GGR panel
  fees: 7,          // Origamo Fees panel
  effectiveEdge: 8, // Effective House Edge panel
};

export async function fetchMonthFromGrafana(
  year: number,
  month: number // 1-12
): Promise<Partial<MonthlyData> | null> {
  const from = new Date(year, month - 1, 1).getTime().toString();
  const to = new Date(year, month, 0, 23, 59, 59).getTime().toString();

  const [mau, activeBrands, betsPlaced, wager, ggr, fees, effectiveEdge] =
    await Promise.all([
      fetchGrafanaPanel(GRAFANA_PANEL_IDS.mau, from, to),
      fetchGrafanaPanel(GRAFANA_PANEL_IDS.activeBrands, from, to),
      fetchGrafanaPanel(GRAFANA_PANEL_IDS.betsPlaced, from, to),
      fetchGrafanaPanel(GRAFANA_PANEL_IDS.wager, from, to),
      fetchGrafanaPanel(GRAFANA_PANEL_IDS.ggr, from, to),
      fetchGrafanaPanel(GRAFANA_PANEL_IDS.fees, from, to),
      fetchGrafanaPanel(GRAFANA_PANEL_IDS.effectiveEdge, from, to),
    ]);

  // Return null if none of the panels responded
  if (
    mau === null &&
    betsPlaced === null &&
    ggr === null
  ) {
    return null;
  }

  return {
    mau: mau ?? 0,
    activeBrands: activeBrands ?? 0,
    betsPlaced: betsPlaced ?? 0,
    wager: wager ?? 0,
    ggr: ggr ?? 0,
    fees: fees ?? 0,
    effectiveEdge: effectiveEdge ?? 0,
    source: "grafana",
  };
}
