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

/** Distance max SL/TP vs prix (gold a besoin de plus que 3%). */
export function maxStopDistancePct(refPrice: number): number {
  if (refPrice > 2000) return 0.08;
  if (refPrice > 1000) return 0.05;
  return 0.03;
}

/** Ramène SL/TP dans la distance max broker (~3–8% du prix selon actif). */
export function clampStopsToBrokerMaxDistance(
  side: StopSide,
  refPrice: number,
  stopLoss?: number | null,
  takeProfit?: number | null,
  maxPct?: number,
): { stopLoss?: number; takeProfit?: number } {
  const pct = maxPct ?? maxStopDistancePct(refPrice);
  const maxDist = Math.max(refPrice * pct, 30);
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

function isGoldBrokerSymbol(symbol?: string): boolean {
  if (!symbol) return false;
  const c = symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return c === "GOLD" || c.startsWith("XAUUSD") || c.startsWith("XAU");
}

function isIndexBrokerSymbol(symbol?: string): boolean {
  if (!symbol) return false;
  const raw = symbol.toUpperCase();
  const c = symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return (
    /^(NAS100|USTEC|US100|US30|DJ30|GER40|DE40|UK100|SPX500)/.test(c) ||
    /NAS|DJ30|US30|GER40|DE40|UK100|SPX500|USTEC/i.test(raw)
  );
}

export function minStopDistanceForSymbol(
  refPrice: number,
  symbol?: string,
): number {
  if (symbol && isGoldBrokerSymbol(symbol)) {
    return Math.max(refPrice * 0.00002, 0.05);
  }
  if (symbol && isIndexBrokerSymbol(symbol)) {
    return Math.max(refPrice * 0.00003, 1);
  }
  if (refPrice > 2000) return Math.max(refPrice * 0.002, 5);
  if (refPrice > 1000) return Math.max(refPrice * 0.001, 2);
  if (refPrice > 10) return Math.max(refPrice * 0.0001, 0.01);
  return 0.00005;
}

/** SL breakeven valide vs prix live (SELL: SL > ask + dist ; BUY: SL < bid - dist). */
export function computeBreakEvenStopLoss(
  side: StopSide,
  entry: number,
  quote: { bid: number; ask: number },
  brokerSymbol: string,
): number | null {
  if (!Number.isFinite(entry) || entry <= 0) return null;
  const dist = minStopDistanceForSymbol(entry, brokerSymbol);
  const buy = side === "BUY";

  if (buy) {
    const maxSl = quote.bid - dist;
    if (entry >= maxSl) return null;
    return entry;
  }

  const minSl = quote.ask + dist;
  if (entry <= minSl) return null;
  return entry;
}
