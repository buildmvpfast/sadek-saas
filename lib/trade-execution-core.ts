/**
 * Logique partagée exécution telegram_trades (API + worker).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchMetaApiAccountEquity,
  postMetaApiClosePositionVolume,
  postMetaApiTradeWithStopsFallback,
  postMetaApiMarketReliable,
} from "@/lib/metaapi-trade-client";
import { parseLocaleNumber } from "@/lib/locale-number";
import { resolvePendingOrderKind } from "@/lib/order-type";
import { snapVolumeForMetaApiSymbol } from "@/lib/trade-volume";
import { resolveBrokerSymbol, invalidateSymbolCache } from "@/lib/broker-symbol-resolver";
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
    .eq("status", "executed");
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

/** Débloque les trades restés en `executing` après crash / timeout MetaAPI. */
export async function releaseStaleExecutingTrades(
  supabase: SupabaseClient,
  olderThanMs = 30 * 1000,
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();

  const { data: byClaimTime } = await supabase
    .from("telegram_trades")
    .update({ status: "pending", executed_at: null })
    .eq("status", "executing")
    .lt("executed_at", cutoff)
    .select("id");

  const { data: byCreatedAt } = await supabase
    .from("telegram_trades")
    .update({ status: "pending", executed_at: null })
    .eq("status", "executing")
    .is("executed_at", null)
    .lt("created_at", cutoff)
    .select("id");

  const ids = new Set([
    ...(byClaimTime ?? []).map((r) => r.id),
    ...(byCreatedAt ?? []).map((r) => r.id),
  ]);
  return ids.size;
}

async function markTradeFailed(
  supabase: SupabaseClient,
  tradeId: string,
  fromStatuses: string[],
  error: string,
): Promise<void> {
  await supabase
    .from("telegram_trades")
    .update({ status: "failed", error_message: error, executed_at: null })
    .eq("id", tradeId)
    .in("status", fromStatuses);
}

type PreparedMarketOrder = {
  kind: "market";
  order: Record<string, unknown>;
  brokerSymbol: string;
  standardSymbol: string;
  brokerName: string | null;
  symbolProfile: "auto" | "ecn" | "stp";
};

type PreparedPartialClose = {
  kind: "partial";
  positionId: string;
  closeVol: number;
  percent: number;
  brokerSymbol: string;
};

type PrepareResult =
  | { ok: true; prepared: PreparedMarketOrder | PreparedPartialClose }
  | { ok: false; error: string; paused?: boolean };

async function prepareTradeExecution(
  supabase: SupabaseClient,
  trade: PendingTradeRow,
  token: string,
  metaApiAccountId: string,
  isPartialClosure: boolean,
): Promise<PrepareResult> {
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
  const profile =
    (mt5Account?.symbol_profile as "auto" | "ecn" | "stp" | null) ?? "auto";
  let brokerSymbol = String(trade.symbol);
  if (brokerName) {
    brokerSymbol = await resolveBrokerSymbol(
      standardSymbol,
      brokerName,
      supabase,
      {
        metaApiAccountId,
        metaApiToken: token,
        symbolProfile: profile,
      },
    );
    if (
      brokerSymbol === standardSymbol ||
      brokerSymbol === "GOLD"
    ) {
      brokerSymbol = await resolveBrokerSymbol(
        standardSymbol,
        brokerName,
        supabase,
        {
          metaApiAccountId,
          metaApiToken: token,
          symbolProfile: profile,
          refreshSymbols: true,
        },
      );
    }
  }

  const rawVol = Number(trade.volume) > 0 ? Number(trade.volume) : 0.01;
  let volume = applyLotMultiplier(rawVol, settings);
  volume = snapVolumeForMetaApiSymbol(brokerSymbol, volume);

  if (isPartialClosure) {
    const positionId =
      trade.position_id ??
      (trade.error_message && /^\d+$/.test(trade.error_message)
        ? trade.error_message
        : null);

    if (!positionId) {
      return {
        ok: false,
        error: "Fermeture partielle: position_id manquant",
      };
    }

    const percent = parsePartialPercent(trade);
    const closeVol = snapVolumeForMetaApiSymbol(
      brokerSymbol,
      (volume * percent) / 100,
    );

    return {
      ok: true,
      prepared: {
        kind: "partial",
        positionId: String(positionId),
        closeVol,
        percent,
        brokerSymbol,
      },
    };
  }

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
    return { ok: false, error: risk.reason ?? "Risque refusé", paused: risk.pause };
  }

  const entryFromTrade = parseLocaleNumber(trade.entry_price);
  const entryFromSignal = parseLocaleNumber(signalRow?.entry_price);
  const entryParsed =
    Number.isFinite(entryFromTrade) && entryFromTrade > 0
      ? entryFromTrade
      : Number.isFinite(entryFromSignal) && entryFromSignal > 0
        ? entryFromSignal
        : Number.NaN;

  const orderKind =
    String(trade.order_type ?? "")
      .toUpperCase()
      .includes("MARKET") ||
    String(signalRow?.order_type ?? "")
      .toUpperCase()
      .includes("MARKET")
      ? "MARKET"
      : resolvePendingOrderKind(
          trade.order_type,
          signalRow?.order_type,
          entryParsed,
        );

  const entryForOrder =
    orderKind === "MARKET"
      ? Number.NaN
      : entryParsed;

  if (
    (orderKind === "LIMIT" || orderKind === "STOP") &&
    (!Number.isFinite(entryForOrder) || entryForOrder <= 0)
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
    order.openPrice = entryForOrder;
  }

  if (trade.stop_loss) {
    const sl = parseLocaleNumber(trade.stop_loss);
    if (Number.isFinite(sl)) order.stopLoss = sl;
  }
  if (trade.take_profit) {
    const tp = parseLocaleNumber(trade.take_profit);
    if (Number.isFinite(tp)) order.takeProfit = tp;
  }

  return { ok: true, prepared: { kind: "market", order, brokerSymbol, standardSymbol, brokerName, symbolProfile: profile } };
}

function isUnknownSymbolError(error?: string | null): boolean {
  if (!error) return false;
  return /UNKNOWN_SYMBOL|ERR_MARKET_UNKNOWN|4301|invalid symbol|unknown symbol|ERR_QUOTE_SYMBOL_MISMATCH/i.test(
    error,
  );
}

async function postTradeWithSymbolRetry(
  supabase: SupabaseClient,
  metaApiAccountId: string,
  prepared: PreparedMarketOrder,
  token: string,
): Promise<
  Awaited<ReturnType<typeof postMetaApiTradeWithStopsFallback>> & {
    symbol: string;
  }
> {
  const tried = new Set<string>();
  let order = { ...prepared.order };
  let symbol = prepared.brokerSymbol;

  for (let attempt = 0; attempt < 4; attempt++) {
    tried.add(symbol);
    order = { ...order, symbol };
    const action = String(order.actionType ?? "");
    const isMarket =
      action === "ORDER_TYPE_BUY" || action === "ORDER_TYPE_SELL";
    const result = isMarket
      ? await postMetaApiMarketReliable(metaApiAccountId, order, token)
      : await postMetaApiTradeWithStopsFallback(metaApiAccountId, order, token);
    if (result.ok || !isUnknownSymbolError(result.error)) {
      return { ...result, symbol };
    }

    invalidateSymbolCache(metaApiAccountId);
    const alt = await resolveBrokerSymbol(
      prepared.standardSymbol,
      prepared.brokerName,
      supabase,
      {
        metaApiAccountId,
        metaApiToken: token,
        symbolProfile: prepared.symbolProfile,
        excludeSymbols: Array.from(tried),
        refreshSymbols: true,
      },
    );
    if (!alt || tried.has(alt)) break;
    symbol = alt;
  }

  const last = await postMetaApiTradeWithStopsFallback(
    metaApiAccountId,
    order,
    token,
  );
  const lastAction = String(order.actionType ?? "");
  if (lastAction === "ORDER_TYPE_BUY" || lastAction === "ORDER_TYPE_SELL") {
    const m = await postMetaApiMarketReliable(metaApiAccountId, order, token);
    return { ...m, symbol };
  }
  return { ...last, symbol };
}

export async function executeOnePendingTrade(
  supabase: SupabaseClient,
  trade: PendingTradeRow,
  token: string,
): Promise<ExecuteOneResult> {
  const mt5Account = embed(trade.mt5_accounts);
  const metaApiAccountId = mt5Account?.metaapi_account_id;

  if (!metaApiAccountId) {
    await markTradeFailed(supabase, trade.id, ["pending", "pending_partial"], "Compte MT5 non configuré");
    return { ok: false, error: "Compte MT5 non configuré" };
  }

  const isPartialClosure = trade.status === "pending_partial";
  const claimFrom = isPartialClosure ? "pending_partial" : "pending";
  const releaseStatus = isPartialClosure ? "pending_partial" : "pending";
  const pendingStatuses = isPartialClosure
    ? ["pending_partial"]
    : ["pending"];

  const prepared = await prepareTradeExecution(
    supabase,
    trade,
    token,
    metaApiAccountId,
    isPartialClosure,
  );

  if (!prepared.ok) {
    await markTradeFailed(
      supabase,
      trade.id,
      pendingStatuses,
      prepared.error,
    );
    return { ok: false, error: prepared.error, paused: prepared.paused };
  }

  const claimed = await claimPendingTrade(supabase, trade.id, claimFrom);
  if (!claimed) {
    return { ok: true, skipped: true };
  }

  try {
    if (prepared.prepared.kind === "partial") {
      const { positionId, closeVol, percent } = prepared.prepared;
      const result = await postMetaApiClosePositionVolume(
        metaApiAccountId,
        positionId,
        token,
        closeVol,
      );

      if (!result.ok) {
        const err = result.error || "Fermeture partielle échouée";
        if (isTransientMetaApiError(err)) {
          await releaseExecutingTrade(supabase, trade.id, releaseStatus);
        } else {
          await supabase
            .from("telegram_trades")
            .update({ status: "failed", error_message: err, executed_at: null })
            .eq("id", trade.id)
            .eq("status", "executing");
        }
        return { ok: false, error: err };
      }

      const { error: updErr } = await supabase
        .from("telegram_trades")
        .update({
          status: "partially_closed",
          executed_at: new Date().toISOString(),
          error_message: `Fermeture partielle ${percent}% exécutée`,
        })
        .eq("id", trade.id)
        .eq("status", "executing");

      if (updErr) {
        await releaseExecutingTrade(supabase, trade.id, releaseStatus);
        return { ok: false, error: updErr.message };
      }
      return { ok: true };
    }

    const result = await postTradeWithSymbolRetry(
      supabase,
      metaApiAccountId,
      prepared.prepared,
      token,
    );

    if (!result.ok) {
      const err =
        result.error || `MetaAPI trade échoué (HTTP ${result.status})`;
      if (isTransientMetaApiError(err)) {
        await releaseExecutingTrade(supabase, trade.id, releaseStatus);
      } else {
        await supabase
          .from("telegram_trades")
          .update({ status: "failed", error_message: err, executed_at: null })
          .eq("id", trade.id)
          .eq("status", "executing");
      }
      return { ok: false, error: err };
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

    const { error: updErr } = await supabase
      .from("telegram_trades")
      .update({
        status: "executed",
        executed_at: new Date().toISOString(),
        entry_price: data.price ?? trade.entry_price,
        position_id: positionId,
        symbol: result.symbol,
        error_message:
          (data.orderId != null ? String(data.orderId) : null) ||
          (data.numericOrderId != null ? String(data.numericOrderId) : null),
      })
      .eq("id", trade.id)
      .eq("status", "executing");

    if (updErr) {
      await releaseExecutingTrade(supabase, trade.id, releaseStatus);
      return {
        ok: false,
        error: `MetaAPI OK mais DB update échoué: ${updErr.message}`,
      };
    }

    return { ok: true, positionId };
  } catch (err: unknown) {
    await releaseExecutingTrade(supabase, trade.id, releaseStatus);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
