export interface MonthlyData {
  id: string;
  label: string;          // e.g. "Oct 2024"
  dateStart: string;      // ISO date string
  dateEnd: string;        // ISO date string

  // Core growth metrics
  mau: number;            // Monthly Active Users (players)
  activeBrands: number;   // Number of active operator brands

  // Betting metrics
  betsPlaced: number;
  effectiveEdge: number;  // House edge as a decimal, e.g. 0.032 = 3.2%
  wager: number;          // Total wagered in USD

  // Revenue metrics
  ggr: number;            // Gross Gaming Revenue (USD)
  fees: number;           // Origamo platform fees (USD)

  // Optional fields (populate as data becomes available)
  maxPlayerGgr?: number;  // Top single player GGR
  topBrands?: string[];   // e.g. ["Brand A", "Brand B", "Brand C"]
  source?: "manual" | "grafana";
}

export interface MonthlyDataWithGrowth extends MonthlyData {
  growth: {
    mau: number | null;
    activeBrands: number | null;
    betsPlaced: number | null;
    wager: number | null;
    ggr: number | null;
    fees: number | null;
  };
  daily: {
    wager: number;
    ggr: number;
    fees: number;
  };
  annualized: {
    wager: number;
    ggr: number;
    fees: number;
  };
}

export interface GrafanaConfig {
  url: string;
  apiKey: string;
  dashboardUid: string;
}
