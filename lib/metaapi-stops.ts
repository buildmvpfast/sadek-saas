/** Validation SL/TP avant envoi ordre MARKET (prix live bid/ask). */

export type StopSide = "BUY" | "SELL";

export function parseStopSide(actionType: string): StopSide {
  return /SELL/i.test(actionType) ? "SELL" : "BUY";
}

export function openPriceFromTradeData(
  data: unknown,
  fallback?: number | null,
): number | null {
  const d = data as Record<string, unknown> | null;
  if (!d) return fallback ?? null;
  const candidates = [d.price, d.openPrice, d.currentPrice, d.entryPrice];
  for (const c of candidates) {
    const n = typeof c === "number" ? c : parseFloat(String(c ?? ""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback ?? null;
}

export function openPriceFromPosition(row: Record<string, unknown>): number | null {
  const candidates = [row.openPrice, row.price, row.currentPrice];
  for (const c of candidates) {
    const n = typeof c === "number" ? c : parseFloat(String(c ?? ""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/** Retourne SL/TP valides côté broker (direction + distance mini optionnelle). */
export function sanitizeStopsForOpenPrice(
  side: StopSide,
  openPrice: number,
  stopLoss?: number | null,
  takeProfit?: number | null,
  minDistance = 0,
): { stopLoss?: number; takeProfit?: number } {
  const out: { stopLoss?: number; takeProfit?: number } = {};
  const buy = side === "BUY";

  if (stopLoss != null && Number.isFinite(stopLoss)) {
    const slOk = buy
      ? stopLoss < openPrice - minDistance
      : stopLoss > openPrice + minDistance;
    if (slOk) out.stopLoss = stopLoss;
  }

  if (takeProfit != null && Number.isFinite(takeProfit)) {
    const tpOk = buy
      ? takeProfit > openPrice + minDistance
      : takeProfit < openPrice - minDistance;
    if (tpOk) out.takeProfit = takeProfit;
  }

  return out;
}
