/**
 * Normalise les symboles Telegram → clé standard interne (GOLD, EURUSD, US30…).
 * Couvre le pack PDF : métaux, crypto, indices, forex majeures/croisées/exotiques.
 */

const INDEX_ALIASES: Record<string, string> = {
  US30: "US30",
  DJ30: "US30",
  WS30: "US30",
  DOW: "US30",
  DOWJONES: "US30",
  USTEC: "NAS100",
  US100: "NAS100",
  NAS100: "NAS100",
  NASDAQ: "NAS100",
  SPX500: "SPX500",
  SP500: "SPX500",
  US500: "SPX500",
  GER40: "GER40",
  DAX: "GER40",
  DE40: "GER40",
  GER30: "GER40",
  UK100: "UK100",
  FTSE: "UK100",
  FTSE100: "UK100",
};

const METAL_ALIASES = new Set(["XAU", "GOLD", "XAUUSD"]);

const CRYPTO_ALIASES: Record<string, string> = {
  BTC: "BTC",
  BTCUSD: "BTC",
  BITCOIN: "BTC",
  ETH: "ETH",
  ETHUSD: "ETH",
  ETHEREUM: "ETH",
  SOL: "SOL30",
  SOL30: "SOL30",
  SOLUSD: "SOL30",
  SOLUSDT: "SOL30",
};

/** Paires forex 6 lettres reconnues telles quelles après nettoyage. */
const FOREX_SIX = new Set([
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "USDCHF",
  "USDCAD",
  "AUDUSD",
  "NZDUSD",
  "EURGBP",
  "EURJPY",
  "GBPJPY",
  "EURCHF",
  "GBPCHF",
  "CHFJPY",
  "CADJPY",
  "AUDJPY",
  "NZDJPY",
  "AUDCAD",
  "AUDCHF",
  "AUDNZD",
  "CADCHF",
  "EURAUD",
  "EURCAD",
  "EURNZD",
  "GBPAUD",
  "GBPCAD",
  "GBPNZD",
  "NZDCAD",
  "NZDCHF",
  "USDTRY",
  "EURTRY",
  "USDZAR",
  "GBPZAR",
  "USDMXN",
  "USDSGD",
  "USDCNH",
  "USDHKD",
  "USDNOK",
  "USDSEK",
  "USDDKK",
  "EURNOK",
  "EURSEK",
  "EURPLN",
]);

function stripSymbol(raw: string): string {
  return raw
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Normalise un symbole brut (Telegram, AI, broker) vers la clé standard.
 */
export function normalizeSymbol(symbol: string): string {
  if (!symbol?.trim()) return "";

  const upper = symbol.toUpperCase().trim();
  const compact = stripSymbol(symbol);

  if (!compact) return upper.replace(/[._/]/g, "");

  // Métaux
  if (
    METAL_ALIASES.has(compact) ||
    compact.includes("XAU") ||
    compact.includes("GOLD")
  ) {
    return "GOLD";
  }

  // Crypto
  for (const [needle, std] of Object.entries(CRYPTO_ALIASES)) {
    if (compact === needle || compact.startsWith(needle)) return std;
  }

  // Indices (match partiel pour symboles broker type DJ30.s)
  for (const [needle, std] of Object.entries(INDEX_ALIASES)) {
    if (compact.includes(needle)) return std;
  }
  if (/CASH/.test(upper) && /US30|NAS|GER40|UK100|SPX|DOW/i.test(upper)) {
    if (/US30|DOW|DJ30/i.test(upper)) return "US30";
    if (/NAS|USTEC|US100/i.test(upper)) return "NAS100";
    if (/GER|DAX|DE40/i.test(upper)) return "GER40";
    if (/UK100|FTSE/i.test(upper)) return "UK100";
    if (/SPX|SP500|US500/i.test(upper)) return "SPX500";
  }

  // Forex 6 lettres
  if (FOREX_SIX.has(compact)) return compact;

  // Format EUR/USD → EURUSD déjà géré par strip
  if (compact.length === 6) return compact;

  return compact.replace(/[._/]/g, "");
}

/** Lot settings key dans trading_settings (null → défaut 0.01). */
export function lotSettingKeyForSymbol(standardSymbol: string): string | null {
  const map: Record<string, string> = {
    GOLD: "gold_lot_size",
    BTC: "btc_lot_size",
    ETH: "eth_lot_size",
    SOL30: "sol_lot_size",
    US30: "us30_lot_size",
    NAS100: "nas100_lot_size",
    GER40: "ger40_lot_size",
    UK100: "uk100_lot_size",
    SPX500: "spx500_lot_size",
    EURUSD: "eurusd_lot_size",
    GBPUSD: "gbpusd_lot_size",
    USDJPY: "usdjpy_lot_size",
    USDCHF: "usdchf_lot_size",
    USDCAD: "usdcad_lot_size",
    AUDUSD: "audusd_lot_size",
    NZDUSD: "nzdusd_lot_size",
    EURGBP: "eurgbp_lot_size",
    EURJPY: "eurjpy_lot_size",
    GBPJPY: "gbpjpy_lot_size",
  };
  return map[standardSymbol] ?? null;
}

const KNOWN_TRADING_SYMBOLS = new Set<string>([
  "GOLD",
  "BTC",
  "ETH",
  "SOL30",
  "US30",
  "NAS100",
  "SPX500",
  "GER40",
  "UK100",
  ...FOREX_SIX,
]);

/** Rejette les faux signaux (POUR, CLAIRE, messages de clôture mal parsés…). */
export function isKnownTradingSymbol(symbol: string): boolean {
  const std = normalizeSymbol(symbol);
  return std.length > 0 && KNOWN_TRADING_SYMBOLS.has(std);
}
