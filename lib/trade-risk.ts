/**
 * Paramètres risque + sizing (trading_settings + mt5_accounts).
 */
export type SymbolProfile = "auto" | "ecn" | "stp";

export type TradingRiskSettings = {
  position_sizing_type?: "lot" | "percentage" | string;
  position_percentage?: number | string | null;
  max_open_positions?: number | string | null;
  max_lot_size?: number | string | null;
  lot_multiplier?: number | string | null;
  equity_risk_percent?: number | string | null;
  max_daily_loss?: number | string | null;
  max_weekly_loss?: number | string | null;
  max_spread_points?: number | string | null;
  max_slippage_points?: number | string | null;
  trading_paused?: boolean | null;
  trading_paused_until?: string | null;
  allowed_symbols?: string | null;
  blocked_symbols?: string | null;
  daily_equity_snapshot?: number | string | null;
  daily_equity_snapshot_date?: string | null;
  weekly_equity_snapshot?: number | string | null;
  weekly_equity_snapshot_week?: string | null;
  [key: string]: unknown;
};

export type RiskCheckInput = {
  standardSymbol: string;
  volume: number;
  openPositionCount: number;
  currentEquity?: number | null;
  currentSpreadPoints?: number | null;
  settings: TradingRiskSettings | null;
};

export type RiskCheckResult =
  | { allowed: true }
  | { allowed: false; reason: string; pause?: boolean };

function num(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === "") return fallback;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

function parseSymbolList(raw: string | null | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(/[,;\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
  );
}

function isPaused(settings: TradingRiskSettings | null): string | null {
  if (!settings) return null;
  if (settings.trading_paused) {
    const until = settings.trading_paused_until;
    if (until && new Date(until).getTime() > Date.now()) {
      return `Trading en pause jusqu'au ${until}`;
    }
    if (!until) return "Trading en pause (manuel)";
  }
  if (settings.trading_paused_until) {
    const t = new Date(settings.trading_paused_until).getTime();
    if (t > Date.now()) {
      return `Trading en pause jusqu'au ${settings.trading_paused_until}`;
    }
  }
  return null;
}

function lossExceeded(
  currentEquity: number | null | undefined,
  snapshot: unknown,
  maxLoss: number,
  label: string,
): string | null {
  if (maxLoss <= 0 || currentEquity == null || !Number.isFinite(currentEquity)) {
    return null;
  }
  const snap = num(snapshot, NaN);
  if (!Number.isFinite(snap)) return null;
  const loss = snap - currentEquity;
  if (loss >= maxLoss) {
    return `${label} dépassée (${loss.toFixed(2)} >= ${maxLoss})`;
  }
  return null;
}

export function checkTradeRisk(input: RiskCheckInput): RiskCheckResult {
  const { standardSymbol, volume, openPositionCount, settings } = input;
  const s = settings;

  const pauseReason = isPaused(s);
  if (pauseReason) return { allowed: false, reason: pauseReason, pause: true };

  const allowed = parseSymbolList(s?.allowed_symbols ?? null);
  if (allowed.size > 0 && !allowed.has(standardSymbol.toUpperCase())) {
    return {
      allowed: false,
      reason: `Instrument ${standardSymbol} non autorisé`,
    };
  }

  const blocked = parseSymbolList(s?.blocked_symbols ?? null);
  if (blocked.has(standardSymbol.toUpperCase())) {
    return {
      allowed: false,
      reason: `Instrument ${standardSymbol} interdit`,
    };
  }

  const maxPos = num(s?.max_open_positions, 999);
  if (openPositionCount >= maxPos) {
    return {
      allowed: false,
      reason: `Max positions ouvertes (${maxPos}) atteint`,
    };
  }

  const mult = num(s?.lot_multiplier, 1);
  const effectiveVol = volume * (mult > 0 ? mult : 1);
  const maxLot = num(s?.max_lot_size, 0);
  if (maxLot > 0 && effectiveVol > maxLot + 1e-9) {
    return {
      allowed: false,
      reason: `Lot ${effectiveVol} > max ${maxLot}`,
    };
  }

  const maxSpread = num(s?.max_spread_points, 0);
  if (
    maxSpread > 0 &&
    input.currentSpreadPoints != null &&
    input.currentSpreadPoints > maxSpread
  ) {
    return {
      allowed: false,
      reason: `Spread ${input.currentSpreadPoints} > max ${maxSpread}`,
    };
  }

  const daily = lossExceeded(
    input.currentEquity,
    s?.daily_equity_snapshot,
    num(s?.max_daily_loss, 0),
    "Perte journalière max",
  );
  if (daily) return { allowed: false, reason: daily, pause: true };

  const weekly = lossExceeded(
    input.currentEquity,
    s?.weekly_equity_snapshot,
    num(s?.max_weekly_loss, 0),
    "Perte hebdomadaire max",
  );
  if (weekly) return { allowed: false, reason: weekly, pause: true };

  return { allowed: true };
}

export function applyLotMultiplier(
  volume: number,
  settings: TradingRiskSettings | null,
): number {
  const mult = num(settings?.lot_multiplier, 1);
  if (mult <= 0) return volume;
  return Math.round(volume * mult * 100) / 100;
}

export function slippageDeviation(
  settings: TradingRiskSettings | null,
): number | undefined {
  const v = num(settings?.max_slippage_points, 30);
  return v > 0 ? Math.round(v) : undefined;
}

export function weekStartDate(d = new Date()): string {
  const x = new Date(d);
  const day = x.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setUTCDate(x.getUTCDate() + diff);
  return x.toISOString().slice(0, 10);
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function equitySnapshotUpdates(
  settings: TradingRiskSettings | null,
  currentEquity: number,
): Partial<TradingRiskSettings> | null {
  if (!Number.isFinite(currentEquity)) return null;
  const today = todayUtc();
  const week = weekStartDate();
  const out: Partial<TradingRiskSettings> = {};
  let changed = false;

  if (settings?.daily_equity_snapshot_date !== today) {
    out.daily_equity_snapshot = currentEquity;
    out.daily_equity_snapshot_date = today;
    changed = true;
  }
  if (settings?.weekly_equity_snapshot_week !== week) {
    out.weekly_equity_snapshot = currentEquity;
    out.weekly_equity_snapshot_week = week;
    changed = true;
  }
  return changed ? out : null;
}

export function autoPauseUpdate(): Partial<TradingRiskSettings> {
  const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  return {
    trading_paused: true,
    trading_paused_until: until,
  };
}

/** Volume depuis % equity (approximation MetaAPI). */
export function volumeFromEquityPercent(
  equity: number,
  equityRiskPercent: number,
  contractSize = 100000,
): number {
  if (!Number.isFinite(equity) || equity <= 0) return 0.01;
  const pct = equityRiskPercent > 0 ? equityRiskPercent : 1;
  const riskAmount = equity * (pct / 100);
  const vol = riskAmount / contractSize;
  return Math.max(0.01, Math.round(vol * 100) / 100);
}
