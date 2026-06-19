/**
 * Fallbacks quand `symbol_mappings` est vide ou broker_name ≠ clé SQL.
 * Pack standard PDF : métaux, crypto, indices, forex majeures + croisées principales.
 */

type SymbolMap = Partial<Record<string, string>>;

const GENERIC_FOREX: SymbolMap = {
  EURUSD: "EURUSD",
  GBPUSD: "GBPUSD",
  USDJPY: "USDJPY",
  USDCHF: "USDCHF",
  USDCAD: "USDCAD",
  AUDUSD: "AUDUSD",
  NZDUSD: "NZDUSD",
  EURGBP: "EURGBP",
  EURJPY: "EURJPY",
  GBPJPY: "GBPJPY",
  EURCHF: "EURCHF",
  GBPCHF: "GBPCHF",
  CHFJPY: "CHFJPY",
  CADJPY: "CADJPY",
  AUDJPY: "AUDJPY",
  NZDJPY: "NZDJPY",
  AUDCAD: "AUDCAD",
  AUDCHF: "AUDCHF",
  AUDNZD: "AUDNZD",
  CADCHF: "CADCHF",
  EURAUD: "EURAUD",
  EURCAD: "EURCAD",
  EURNZD: "EURNZD",
  GBPAUD: "GBPAUD",
  GBPCAD: "GBPCAD",
  GBPNZD: "GBPNZD",
  NZDCAD: "NZDCAD",
  NZDCHF: "NZDCHF",
};

const GENERIC_PACK: SymbolMap = {
  GOLD: "XAUUSD",
  BTC: "BTCUSD",
  ETH: "ETHUSD",
  SOL30: "SOL30",
  US30: "US30",
  NAS100: "NAS100",
  GER40: "GER40",
  UK100: "UK100",
  SPX500: "SPX500",
  ...GENERIC_FOREX,
};

const STATIC_BROKER_SYMBOL: Record<string, SymbolMap> = {
  Vantage: {
    ...GENERIC_PACK,
    GOLD: "XAUUSD+",
    EURUSD: "EURUSD+",
    GBPUSD: "GBPUSD+",
    USDJPY: "USDJPY+",
    USDCHF: "USDCHF+",
    USDCAD: "USDCAD+",
    AUDUSD: "AUDUSD+",
    NZDUSD: "NZDUSD+",
    EURGBP: "EURGBP+",
    EURJPY: "EURJPY+",
    GBPJPY: "GBPJPY+",
    US30: "DJ30",
    NAS100: "NAS100",
    GER40: "GER40",
    UK100: "UK100",
    SPX500: "SPX500",
  },
  "VT Markets": {
    ...GENERIC_PACK,
    GOLD: "XAUUSD-VIP",
    EURUSD: "EURUSD-ECN",
    EURGBP: "EURGBP-ECN",
    EURJPY: "EURJPY-ECN",
    GBPJPY: "GBPJPY-ECN",
    US30: "DJ30.s",
    NAS100: "NAS100.s",
    GER40: "GER40.s",
    UK100: "UK100.s",
    SPX500: "SPX500.s",
  },
  Axi: { ...GENERIC_PACK },
  FXcess: { ...GENERIC_PACK },
  "Raise FX": { ...GENERIC_PACK },
  "Raise Global": { ...GENERIC_PACK },
  "Raise Globale": { ...GENERIC_PACK },
};

/**
 * Clés à tester sur symbol_mappings + fallbacks.
 */
export function brokerMappingKeys(
  brokerName: string | null | undefined,
): string[] {
  if (!brokerName) return [];
  const t = brokerName.trim();
  const out: string[] = [t];
  const compact = t.replace(/\s+/g, "");
  const lower = t.toLowerCase();

  if (/vantage/i.test(t) && t !== "Vantage") out.push("Vantage");
  if (/vtmarkets/i.test(compact) || /^vt\s*markets$/i.test(t)) {
    if (t !== "VT Markets") out.push("VT Markets");
  }
  if (/^axi/i.test(t) || lower.includes("axitrader")) {
    if (t !== "Axi") out.push("Axi");
  }
  if (/fxcess/i.test(compact)) {
    if (t !== "FXcess") out.push("FXcess");
  }
  if (/raise/i.test(t)) {
    for (const k of ["Raise FX", "Raise Global", "Raise Globale"]) {
      if (!out.includes(k)) out.push(k);
    }
  }

  const seen = new Set<string>();
  return out.filter((x) => {
    if (seen.has(x)) return false;
    seen.add(x);
    return true;
  });
}

export function staticBrokerSymbol(
  brokerKey: string,
  standardSymbol: string,
): string | null {
  return STATIC_BROKER_SYMBOL[brokerKey]?.[standardSymbol] ?? null;
}

export function allStaticBrokerKeys(): string[] {
  return Object.keys(STATIC_BROKER_SYMBOL);
}
