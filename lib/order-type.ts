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
