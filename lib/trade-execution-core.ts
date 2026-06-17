/**
 * Logique partagée exécution telegram_trades (API + worker).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchMetaApiAccountEquity,
  postMetaApiClosePositionVolume,
  postMetaApiTradeWithStopsFallback,
} from "@/lib/metaapi-trade-client";
import { parseLocaleNumber } from "@/lib/locale-number";
import { resolvePendingOrderKind } from "@/lib/order-type";
import { snapVolumeForMetaApiSymbol } from "@/lib/trade-volume";
import { resolveBrokerSymbol } from "@/lib/broker-symbol-resolver";
import { normalizeSymbol } from "@/lib/symbol-normalizer";
import {
  applyLotMultiplier,
  autoPauseUpdate,
  checkTradeRisk,
  equitySnapshotUpdates,
  slippageDeviation,
  type TradingRiskSettings,
} from "@/lib/trade-risk";
import { isTransientMetaApiError } from "@/lib/metaapi-errors";

export type PendingTradeRow = {
  id: string;
  user_id: string;
  signal_id?: string;
  mt5_account_id?: string;
  symbol: string;
  signal_type: string;
  order_type?: string | null;
  volume: number | string;
  entry_price?: number | string | null;
  stop_loss?: number | string | null;
  take_profit?: number | string | null;
  error_message?: string | null;
  status: string;
  position_id?: number | string | null;
  partial_close_percent?: number | string | null;
  mt5_accounts?:
    | {
        metaapi_account_id?: string;
        broker_name?: string | null;
        symbol_profile?: string | null;
      }
    | {
        metaapi_account_id?: string;
        broker_name?: string | null;
        symbol_profile?: string | null;
      }[];
  telegram_signals?:
    | {
        entry_price?: number | string | null;
        order_type?: string | null;
        symbol?: string | null;
      }
    | {
        entry_price?: number | string | null;
        order_type?: string | null;
        symbol?: string | null;
      }[]
    | null;
};

function embed<T>(raw: T | T[] | null | undefined): T | null {
  if (raw == null) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

function parsePartialPercent(trade: PendingTradeRow): number {
  const col = trade.partial_close_percent;
  if (col != null) {
    const n = parseLocaleNumber(col);
    if (Number.isFinite(n) && n > 0) return Math.min(100, n);
  }
  const msg = trade.error_message ?? "";
  const m = msg.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (m?.[1]) {
    const n = parseLocaleNumber(m[1]);
    if (Number.isFinite(n)) return Math.min(100, n);
  }
  if (/half|moiti/i.test(msg)) return 50;
  return 50;
}

async function countOpenTrades(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count } = await supabase
    .from("telegram_trades")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["executed", "pending", "pending_partial", "executing"]);
  return count ?? 0;
}

async function loadRiskContext(
  supabase: SupabaseClient,
  userId: string,
  metaApiAccountId: string,
  token: string,
): Promise<{
  settings: TradingRiskSettings | null;
  equity: number | null;
  openCount: number;
}> {
  const [{ data: settings }, openCount, equity] = await Promise.all([
    supabase.from("trading_settings").select("*").eq("user_id", userId).maybeSingle(),
    countOpenTrades(supabase, userId),
    fetchMetaApiAccountEquity(metaApiAccountId, token),
  ]);

  if (equity != null && settings) {
    const snap = equitySnapshotUpdates(
      settings as TradingRiskSettings,
      equity,
    );
    if (snap) {
      await supabase
        .from("trading_settings")
        .update(snap)
        .eq("user_id", userId);
      Object.assign(settings, snap);
    }
  }

  return {
    settings: (settings as TradingRiskSettings) ?? null,
    equity,
    openCount,
  };
}

export type ExecuteOneResult =
  | { ok: true; positionId?: number | null; skipped?: boolean }
  | { ok: false; error: string; paused?: boolean };

/** Réserve un trade pending avant envoi MetaAPI (évite double exécution API + worker). */
export async function claimPendingTrade(
  supabase: SupabaseClient,
  tradeId: string,
  currentStatus: string,
): Promise<boolean> {
  const allowed =
    currentStatus === "pending_partial"
      ? (["pending_partial"] as const)
      : (["pending"] as const);

  const { data, error } = await supabase
    .from("telegram_trades")
    .update({
      status: "executing",
      executed_at: new Date().toISOString(),
    })
    .eq("id", tradeId)
    .in("status", [...allowed])
    .select("id")
    .maybeSingle();

  return !error && !!data?.id;
}

async function releaseExecutingTrade(
  supabase: SupabaseClient,
  tradeId: string,
  backTo: "pending" | "pending_partial",
): Promise<void> {
  await supabase
    .from("telegram_trades")
    .update({ status: backTo, executed_at: null })
    .eq("id", tradeId)
    .eq("status", "executing");
}

export async function executeOnePendingTrade(
  supabase: SupabaseClient,
  trade: PendingTradeRow,
  token: string,
): Promise<ExecuteOneResult> {
  const mt5Account = embed(trade.mt5_accounts);
  const metaApiAccountId = mt5Account?.metaapi_account_id;

  if (!metaApiAccountId) {
    return { ok: false, error: "Compte MT5 non configuré" };
  }

  const isPartialClosure = trade.status === "pending_partial";
  const claimFrom = isPartialClosure ? "pending_partial" : "pending";

  const claimed = await claimPendingTrade(supabase, trade.id, claimFrom);
  if (!claimed) {
    return { ok: true, skipped: true };
  }

  const releaseStatus = isPartialClosure ? "pending_partial" : "pending";

  try {
    const result = await executeClaimedTrade(
      supabase,
      trade,
      token,
      metaApiAccountId,
      isPartialClosure,
    );
    if (!result.ok) {
      if (isTransientMetaApiError(result.error)) {
        await releaseExecutingTrade(supabase, trade.id, releaseStatus);
      } else {
        await supabase
          .from("telegram_trades")
          .update({
            status: "failed",
            error_message: result.error,
          })
          .eq("id", trade.id)
          .eq("status", "executing");
      }
    }
    return result;
  } catch (err: unknown) {
    await releaseExecutingTrade(supabase, trade.id, releaseStatus);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

async function executeClaimedTrade(
  supabase: SupabaseClient,
  trade: PendingTradeRow,
  token: string,
  metaApiAccountId: string,
  isPartialClosure: boolean,
): Promise<ExecuteOneResult> {
  const mt5Account = embed(trade.mt5_accounts);

  const { settings, equity, openCount } = await loadRiskContext(
    supabase,
    trade.user_id,
    metaApiAccountId,
    token,
  );

  const signalRow = embed(trade.telegram_signals);
  const standardSymbol = normalizeSymbol(signalRow?.symbol ?? trade.symbol);
  const brokerName = mt5Account?.broker_name ?? null;
  let brokerSymbol = String(trade.symbol);
  if (brokerName) {
    brokerSymbol = await resolveBrokerSymbol(
      standardSymbol,
      brokerName,
      supabase,
      {
        metaApiAccountId,
        metaApiToken: token,
        symbolProfile:
          (mt5Account?.symbol_profile as "auto" | "ecn" | "stp" | null) ??
          "auto",
      },
    );
  }

  const rawVol = Number(trade.volume) > 0 ? Number(trade.volume) : 0.01;
  let volume = applyLotMultiplier(rawVol, settings);
  volume = snapVolumeForMetaApiSymbol(brokerSymbol, volume);

  if (!isPartialClosure) {
    const risk = checkTradeRisk({
      standardSymbol,
      volume,
      openPositionCount: openCount,
      currentEquity: equity,
      settings,
    });
    if (!risk.allowed) {
      if (risk.pause) {
        await supabase
          .from("trading_settings")
          .update(autoPauseUpdate())
          .eq("user_id", trade.user_id);
      }
      return { ok: false, error: risk.reason, paused: risk.pause };
    }
  }

  if (isPartialClosure) {
    const positionId =
      trade.position_id ??
      (trade.error_message && /^\d+$/.test(trade.error_message)
        ? trade.error_message
        : null);

    if (!positionId) {
      return { ok: false, error: "Fermeture partielle: position_id manquant" };
    }

    const percent = parsePartialPercent(trade);
    const closeVol = snapVolumeForMetaApiSymbol(
      brokerSymbol,
      (volume * percent) / 100,
    );

    const result = await postMetaApiClosePositionVolume(
      metaApiAccountId,
      String(positionId),
      token,
      closeVol,
    );

    if (!result.ok) {
      return {
        ok: false,
        error: result.error || "Fermeture partielle échouée",
      };
    }

    await supabase
      .from("telegram_trades")
      .update({
        status: "partially_closed",
        executed_at: new Date().toISOString(),
        error_message: `Fermeture partielle ${percent}% exécutée`,
      })
      .eq("id", trade.id);

    return { ok: true };
  }

  const entryFromTrade = parseLocaleNumber(trade.entry_price);
  const entryFromSignal = parseLocaleNumber(signalRow?.entry_price);
  const entryParsed =
    Number.isFinite(entryFromTrade) && entryFromTrade > 0
      ? entryFromTrade
      : Number.isFinite(entryFromSignal) && entryFromSignal > 0
        ? entryFromSignal
        : Number.NaN;

  const orderKind = resolvePendingOrderKind(
    trade.order_type,
    signalRow?.order_type,
    entryParsed,
  );

  if (
    (orderKind === "LIMIT" || orderKind === "STOP") &&
    (!Number.isFinite(entryParsed) || entryParsed <= 0)
  ) {
    return {
      ok: false,
      error: `Ordre ${orderKind} sans prix d'entrée valide`,
    };
  }

  let actionType: string;
  if (orderKind === "STOP") {
    actionType =
      trade.signal_type === "BUY"
        ? "ORDER_TYPE_BUY_STOP"
        : "ORDER_TYPE_SELL_STOP";
  } else if (orderKind === "LIMIT") {
    actionType =
      trade.signal_type === "BUY"
        ? "ORDER_TYPE_BUY_LIMIT"
        : "ORDER_TYPE_SELL_LIMIT";
  } else {
    actionType =
      trade.signal_type === "BUY" ? "ORDER_TYPE_BUY" : "ORDER_TYPE_SELL";
  }

  const order: Record<string, unknown> = {
    symbol: brokerSymbol,
    actionType,
    volume,
  };

  const deviation = slippageDeviation(settings);
  if (deviation != null && orderKind === "MARKET") {
    order.deviation = deviation;
  }

  if (orderKind === "LIMIT" || orderKind === "STOP") {
    order.openPrice = entryParsed;
  }

  if (trade.stop_loss) {
    const sl = parseLocaleNumber(trade.stop_loss);
    if (Number.isFinite(sl)) order.stopLoss = sl;
  }
  if (trade.take_profit) {
    const tp = parseLocaleNumber(trade.take_profit);
    if (Number.isFinite(tp)) order.takeProfit = tp;
  }

  const result = await postMetaApiTradeWithStopsFallback(
    metaApiAccountId,
    order,
    token,
  );

  if (!result.ok) {
    return {
      ok: false,
      error: result.error || `MetaAPI trade échoué (HTTP ${result.status})`,
    };
  }

  const data = result.data as Record<string, unknown>;
  const rawPositionId =
    data.positionId ??
    data.numericPositionId ??
    data.position_id ??
    data.numericOrderId ??
    data.orderId ??
    null;

  const positionId =
    rawPositionId != null ? parseInt(String(rawPositionId), 10) : null;

  await supabase
    .from("telegram_trades")
    .update({
      status: "executed",
      executed_at: new Date().toISOString(),
      entry_price: data.price ?? trade.entry_price,
      position_id: positionId,
      error_message:
        (data.orderId != null ? String(data.orderId) : null) ||
        (data.numericOrderId != null ? String(data.numericOrderId) : null),
    })
    .eq("id", trade.id);

  return { ok: true, positionId };
}
