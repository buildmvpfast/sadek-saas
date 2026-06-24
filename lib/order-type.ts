export type PendingOrderKind = "MARKET" | "LIMIT" | "STOP";

/**
 * LIMIT/STOP uniquement si le message contient clairement l'un des 4 :
 * buy limit, sell limit, buy stop, sell stop (FR : achat/vente + limite/stop).
 * Sinon → null (→ MARKET).
 */
export function explicitPendingOrderKindFromMessage(
  messageText: string,
): PendingOrderKind | null {
  const explicitLimit =
    /\b(?:buy|achat|long|sell|vente|short)\s+(?:limit|limite)\b/i.test(
      messageText,
    ) ||
    /\b(?:limit|limite)\s+(?:buy|achat|long|sell|vente|short)\b/i.test(
      messageText,
    );
  const explicitStop =
    /\b(?:buy|achat|long|sell|vente|short)\s+stop\b/i.test(messageText) ||
    /\bstop\s+(?:buy|achat|long|sell|vente|short)\b/i.test(messageText);

  if (explicitStop) return "STOP";
  if (explicitLimit) return "LIMIT";
  return null;
}

/** Règle canal : pas de limit/stop explicite → MARKET (même avec un prix d'entrée). */
export function resolveOrderTypeFromMessage(
  messageText: string,
): PendingOrderKind {
  return explicitPendingOrderKindFromMessage(messageText) ?? "MARKET";
}

const OPEN_SIDE =
  /\b(?:buy|sell|achat|vente|long|short|🟢|🔴)\b/i;
const OPEN_SYMBOL =
  /\b(?:gold|xau\s*\/?\s*usd|eur\s*\/?\s*usd|gbp\s*\/?\s*usd|usd\s*\/?\s*jpy|btc|eth|us30|nas100|ger40|uk100|spx500|sol30|[a-z]{6,10})\b/i;

/**
 * Message d'ouverture (market/limit/stop) — ne pas traiter comme mise à jour SL/TP/BE.
 */
export function looksLikeNewOpeningSignal(messageText: string): boolean {
  const t = messageText.trim();
  if (!t) return false;

  if (explicitPendingOrderKindFromMessage(t)) return true;

  const hasSide = OPEN_SIDE.test(t);
  const hasSymbol = OPEN_SYMBOL.test(t);
  const hasSl = /\b(?:SL|S\/L)\b/i.test(t);
  const hasTp = /\bTP\d*\b/i.test(t);
  const hasPrice = /\d{2,5}(?:[.,]\d+)?/.test(t);
  const hasEntry =
    /(?:entrée|entry)\s*[:=\s]/i.test(t) ||
    /\b(?:buy|sell|achat|vente|long|short)\s+\S+\s+[\d.,]+/i.test(t);

  if (hasSide && hasSymbol && hasSl && hasTp && hasPrice) return true;
  if (hasSide && hasSymbol && (hasEntry || hasSl) && hasPrice) return true;

  if (
    /(?:imprimante\s+trading|signal)\s*[•·]/i.test(t) &&
    hasSide &&
    hasSymbol
  ) {
    return true;
  }

  return false;
}

/**
 * Déduit MARKET / LIMIT / STOP à partir des champs trade + signal (texte ou codes).
 */
export function resolvePendingOrderKind(
  tradeOrderType: unknown,
  signalOrderType: unknown,
  _entryPriceParsed?: number,
): PendingOrderKind {
  const blob = `${String(tradeOrderType ?? "").trim()} ${String(signalOrderType ?? "").trim()}`
    .toUpperCase()
    .replace(/_/g, " ");

  if (blob.includes("STOP") && blob.includes("LIMIT")) {
    return "LIMIT";
  }
  if (blob.includes("STOP")) {
    return "STOP";
  }
  if (blob.includes("LIMIT") || blob.includes("LIMITE")) {
    return "LIMIT";
  }
  if (
    blob.includes("MARKET") ||
    blob.includes("INSTANT") ||
    blob.includes("AU MARCH")
  ) {
    return "MARKET";
  }

  return "MARKET";
}

export function adjustOrderKindForQuote(
  signalType: string,
  kind: PendingOrderKind,
  entry: number,
  quote: { bid: number; ask: number } | null,
): PendingOrderKind {
  if (!quote || !Number.isFinite(entry) || entry <= 0) return kind;
  const buy = signalType.toUpperCase() === "BUY";

  // Buy limit au-dessus du marché → buy stop ; sell limit en-dessous → sell stop
  if (kind === "LIMIT") {
    if (buy && entry >= quote.ask) return "STOP";
    if (!buy && entry <= quote.bid) return "STOP";
  }
  if (kind === "STOP") {
    if (buy && entry <= quote.bid) return "LIMIT";
    if (!buy && entry >= quote.ask) return "LIMIT";
  }
  return kind;
}

export function actionTypeForOrder(
  signalType: string,
  kind: PendingOrderKind,
): string {
  const buy = signalType.toUpperCase() === "BUY";
  if (kind === "STOP") {
    return buy ? "ORDER_TYPE_BUY_STOP" : "ORDER_TYPE_SELL_STOP";
  }
  if (kind === "LIMIT") {
    return buy ? "ORDER_TYPE_BUY_LIMIT" : "ORDER_TYPE_SELL_LIMIT";
  }
  return buy ? "ORDER_TYPE_BUY" : "ORDER_TYPE_SELL";
}
