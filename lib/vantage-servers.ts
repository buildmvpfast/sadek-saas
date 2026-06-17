/**
 * Liste exhaustive serveurs Vantage (MT5) — UI + fallback si MetaAPI indisponible.
 * Source : MetaTrader Web Trader, docs Vantage, MetaAPI known servers.
 */
function liveNumbers(max: number): string[] {
  const out: string[] = [];
  for (let i = 1; i <= max; i++) {
    out.push(`VantageInternational-Live ${i}`, `VantageInternational-Live${i}`);
    out.push(`VantageMarkets-Live ${i}`, `VantageMarkets-Live${i}`);
  }
  return out;
}

export const VANTAGE_MT5_SERVERS: string[] = [
  // Demo (les plus courants en premier)
  "VantageInternational-Demo",
  "VantageInternational-Demo 2",
  "VantageMarkets-Demo",
  "VantageFX-Demo",
  "VantagePrimeLimited-Demo",

  // Live génériques
  "VantageInternational-Live",
  "VantageMarkets-Live",
  "VantageFX-Live",
  "VantageFXInternational-Live",
  "VantagePrimeLimited-Live",
  "VantageGlobalPrimeLLP-Live",
  "VantageGlobalPrimeLLP-Live 2",
  "VantageGlobalPrimeAU-Live",

  // Live numérotés (MetaTrader web + VPS benchmarks)
  ...liveNumbers(22),

  // Variantes sans espace / legacy
  "VantageInternational-Live 1",
  "VantageInternational-Live 2",
  "VantageInternational-Live 9",
  "VantageInternational-Live 12",
  "VantageInternational-Live 14",
  "VantageInternational-Live 16",
  "VantageInternational-Live 18",
  "VantageInternational-Live 21",
  "VantageInternational-Live 22",
  "VantageMarkets-Live 3",
  "VantageMarkets-Live 4",
  "VantageMarkets-Live 5",
  "VantageMarkets-Live 6",
  "VantageMarkets-Live 7",
  "VantageMarkets-Live 8",
  "VantageMarkets-Live 10",
  "VantageMarkets-Live 11",
  "VantageMarkets-Live 13",
  "VantageMarkets-Live 14",
  "VantageMarkets-Live 15",
  "VantageMarkets-Live 19",
  "VantageMarkets-Live 21",
];
