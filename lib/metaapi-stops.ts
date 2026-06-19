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

/** Détecte symbole broker incorrect (ex. XAUAUD vs XAUUSD), pas les SL/TP larges. */
export function isQuoteConsistentWithStops(
  quote: number,
  side: StopSide,
  stopLoss?: number | null,
  takeProfit?: number | null,
): boolean {
  if (stopLoss != null && Number.isFinite(stopLoss)) {
    if (side === "BUY" && quote <= stopLoss) return false;
    if (side === "SELL" && quote >= stopLoss) return false;
  }
  if (takeProfit != null && Number.isFinite(takeProfit)) {
    if (side === "BUY" && quote >= takeProfit) return false;
    if (side === "SELL" && quote <= takeProfit) return false;
  }

  const refs = [stopLoss, takeProfit].filter(
    (v): v is number => v != null && Number.isFinite(v) && v > 0,
  );
  if (refs.length >= 2) {
    const mid = refs.reduce((a, b) => a + b, 0) / refs.length;
    if (mid > 500 && mid < 50_000) {
      const drift = Math.abs(quote - mid) / mid;
      if (drift > 0.35) return false;
    }
  }
  return true;
}

/** Ramène SL/TP dans la distance max broker (~3% du prix). */
export function clampStopsToBrokerMaxDistance(
  side: StopSide,
  refPrice: number,
  stopLoss?: number | null,
  takeProfit?: number | null,
  maxPct = 0.03,
): { stopLoss?: number; takeProfit?: number } {
  const maxDist = Math.max(refPrice * maxPct, 30);
  const out: { stopLoss?: number; takeProfit?: number } = {};
  const buy = side === "BUY";

  if (stopLoss != null && Number.isFinite(stopLoss)) {
    if (buy) {
      const minSl = refPrice - maxDist;
      out.stopLoss = stopLoss < minSl ? minSl : stopLoss;
    } else {
      const maxSl = refPrice + maxDist;
      out.stopLoss = stopLoss > maxSl ? maxSl : stopLoss;
    }
  }
  if (takeProfit != null && Number.isFinite(takeProfit)) {
    if (buy) {
      const maxTp = refPrice + maxDist;
      out.takeProfit = takeProfit > maxTp ? maxTp : takeProfit;
    } else {
      const minTp = refPrice - maxDist;
      out.takeProfit = takeProfit < minTp ? minTp : takeProfit;
    }
  }
  return out;
}
