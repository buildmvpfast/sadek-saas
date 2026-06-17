/** Positions ouvertes normalisées depuis MetaAPI (source = compte MT4/MT5 réel). */
export type NormalizedPosition = {
  id: string;
  symbol: string;
  type: "BUY" | "SELL";
  volume: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  stopLoss?: number;
  takeProfit?: number;
  openTime?: string;
};

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseSide(raw: Record<string, unknown>): "BUY" | "SELL" {
  const blob = `${raw.type ?? ""} ${raw.side ?? ""}`.toUpperCase();
  return /SELL|SHORT/i.test(blob) ? "SELL" : "BUY";
}

export function normalizeMetaApiPosition(
  raw: unknown,
): NormalizedPosition | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = row.id ?? row.positionId ?? row.ticket;
  const symbol = row.symbol;
  if (id == null || symbol == null || String(symbol).trim() === "") {
    return null;
  }

  return {
    id: String(id),
    symbol: String(symbol),
    type: parseSide(row),
    volume: num(row.volume),
    openPrice: num(row.openPrice ?? row.price),
    currentPrice: num(row.currentPrice ?? row.current),
    profit: num(row.profit ?? row.unrealizedProfit),
    stopLoss:
      row.stopLoss != null && row.stopLoss !== ""
        ? num(row.stopLoss)
        : undefined,
    takeProfit:
      row.takeProfit != null && row.takeProfit !== ""
        ? num(row.takeProfit)
        : undefined,
    openTime:
      row.time != null
        ? String(row.time)
        : row.openTime != null
          ? String(row.openTime)
          : undefined,
  };
}

export function normalizeMetaApiPositions(raw: unknown[]): NormalizedPosition[] {
  const out: NormalizedPosition[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const pos = normalizeMetaApiPosition(item);
    if (!pos || seen.has(pos.id)) continue;
    seen.add(pos.id);
    out.push(pos);
  }
  return out;
}
