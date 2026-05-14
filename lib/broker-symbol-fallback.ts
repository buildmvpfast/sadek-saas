/**
 * Fallbacks quand `symbol_mappings` est vide ou broker_name ≠ clé SQL.
 * Aligné sur app/api/telegram/parse-signal (Vantage notamment).
 */

const STATIC_BROKER_SYMBOL: Record<string, Partial<Record<string, string>>> = {
  Vantage: {
    GOLD: "XAUUSD+",
    BTC: "BTCUSD",
    EURUSD: "EURUSD+",
    GBPUSD: "GBPUSD+",
    USDJPY: "USDJPY+",
    US30: "DJ30",
    NAS100: "NAS100",
    GER40: "GER40",
    SOL30: "SOL30",
  },
};

/**
 * Clés à tester sur symbol_mappings + fallbacks (ex. "Vantage International" → "Vantage").
 */
export function brokerMappingKeys(brokerName: string | null | undefined): string[] {
  if (!brokerName) return [];
  const t = brokerName.trim();
  const out: string[] = [t];
  if (/vantage/i.test(t) && t !== "Vantage") {
    out.push("Vantage");
  }
  return out;
}

export function staticBrokerSymbol(
  brokerKey: string,
  standardSymbol: string,
): string | null {
  return STATIC_BROKER_SYMBOL[brokerKey]?.[standardSymbol] ?? null;
}
