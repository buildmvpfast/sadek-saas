export type PendingOrderKind = "MARKET" | "LIMIT" | "STOP";

/**
 * Déduit MARKET / LIMIT / STOP à partir des champs trade + signal (texte ou codes).
 */
export function resolvePendingOrderKind(
  tradeOrderType: unknown,
  signalOrderType: unknown,
  entryPriceParsed: number,
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

  if (Number.isFinite(entryPriceParsed) && entryPriceParsed > 0) {
    return "LIMIT";
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
