import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchMetaApiPositionsJson,
  fetchMetaApiSymbolQuote,
  findMatchingOpenPosition,
  parseMetaApiOpenPositions,
  postMetaApiModifyPosition,
  type MetaApiOpenPosition,
} from "@/lib/metaapi-trade-client";
import { looksLikeNewOpeningSignal } from "@/lib/order-type";
import { parseLocaleNumber } from "@/lib/locale-number";
import { normalizeSymbol } from "@/lib/symbol-normalizer";
import { computeBreakEvenStopLoss, type StopSide } from "@/lib/metaapi-stops";

export function parseBeDirectionFilter(
  messageText: string,
): "BUY" | "SELL" | null {
  const hasBuy = /\b(?:buy|achat|long)\b/i.test(messageText);
  const hasSell = /\b(?:sell|vente|short)\b/i.test(messageText);
  if (hasSell && !hasBuy) return "SELL";
  if (hasBuy && !hasSell) return "BUY";
  return null;
}

export function parseBeSymbolFilter(messageText: string): string | null {
  const m = messageText.match(
    /\b(gold|xau\s*\/?\s*usd|or|nas100|ustec|ger40|de40|us30|dj30|eurusd|gbpusd|btc)\b/i,
  );
  return m?.[1] ? normalizeSymbol(m[1]) : null;
}

export function detectSlTpUpdateMessage(messageText: string): {
  isBeUpdate: boolean;
  nextStopLoss: number | null;
  takeProfits: number[];
  hasUpdate: boolean;
  signalTypeFilter: "BUY" | "SELL" | null;
  symbolFilter: string | null;
} {
  if (looksLikeNewOpeningSignal(messageText)) {
    return {
      isBeUpdate: false,
      nextStopLoss: null,
      takeProfits: [],
      hasUpdate: false,
      signalTypeFilter: null,
      symbolFilter: null,
    };
  }

  const isStatusNotInstruction =
    /\b(?:be|tp\d?)\s+hit\b/i.test(messageText) ||
    /\bhit\s*[.!…]*\s*$/i.test(messageText.trim());

  const isBeUpdate =
    (!isStatusNotInstruction &&
      (/\bBE\b/i.test(messageText) ||
        /break[-\s]?even/i.test(messageText))) ||
    /mettez?\s+(?:le\s+)?(?:sl\s+)?(?:en\s+|à\s+|au\s+)?(?:be|break[-\s]?even)/i.test(
      messageText,
    ) ||
    /mettre\s+(à|en|au)\s*BE/i.test(messageText) ||
    /passer\s+.*\sBE/i.test(messageText) ||
    /move\s*sl\s*(to|=)\s*(be|break\s*even|break-even)/i.test(messageText) ||
    /sl\s*(to|=)\s*(be|break\s*even|break-even)/i.test(messageText);

  const slMatch =
    messageText.match(/\bS\/?L\b[:=\s]*([\d.]+)/i) ||
    messageText.match(/\bSL\b[:=\s]*([\d.]+)/i);
  const nextStopLoss = slMatch?.[1] ? parseFloat(slMatch[1]) : null;

  const takeProfits = Array.from(
    messageText.matchAll(/\bTP\d*\b[:=\s]*([\d.]+)/gi),
  )
    .map((m) => (m[1] ? parseFloat(m[1]) : NaN))
    .filter((v) => Number.isFinite(v));

  const hasUpdate = Boolean(
    isBeUpdate || nextStopLoss !== null || takeProfits.length > 0,
  );

  return {
    isBeUpdate,
    nextStopLoss,
    takeProfits,
    hasUpdate,
    signalTypeFilter: parseBeDirectionFilter(messageText),
    symbolFilter: parseBeSymbolFilter(messageText),
  };
}

/** Signal cible : reply Telegram ou dernier signal avec positions ouvertes (24h). */
export async function resolveSignalIdForPositionUpdate(
  supabase: SupabaseClient,
  channelId: string,
  replyToMessageId?: number | null,
  filters?: {
    signalType?: "BUY" | "SELL" | null;
    symbol?: string | null;
  },
): Promise<string | null> {
  if (replyToMessageId) {
    const { data } = await supabase
      .from("telegram_signals")
      .select("id")
      .eq("channel_id", channelId)
      .eq("message_id", replyToMessageId)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentSignals } = await supabase
    .from("telegram_signals")
    .select("id, parsed_at, signal_type, symbol")
    .eq("channel_id", channelId)
    .gte("parsed_at", since)
    .order("parsed_at", { ascending: false })
    .limit(20);

  for (const sig of recentSignals ?? []) {
    if (
      filters?.signalType &&
      String(sig.signal_type ?? "").toUpperCase() !== filters.signalType
    ) {
      continue;
    }
    if (
      filters?.symbol &&
      normalizeSymbol(String(sig.symbol ?? "")) !==
        normalizeSymbol(filters.symbol)
    ) {
      continue;
    }
    const { count } = await supabase
      .from("telegram_trades")
      .select("id", { count: "exact", head: true })
      .eq("signal_id", sig.id)
      .eq("status", "executed");
    if ((count ?? 0) > 0) return sig.id;
  }

  return null;
}

function parseStoredPositionId(
  positionId: string | number | null | undefined,
  errorMessage: string | null | undefined,
): string | null {
  if (positionId != null && positionId !== "") {
    return String(positionId);
  }
  const msg = (errorMessage ?? "").trim();
  if (/^\d+$/.test(msg)) return msg;
  return null;
}

function resolveOpenPriceForBe(
  tradeEntry: string | number | null | undefined,
  signalEntry: string | number | null | undefined,
  position: MetaApiOpenPosition | null,
): number | null {
  const fromTrade = parseLocaleNumber(tradeEntry);
  if (Number.isFinite(fromTrade) && fromTrade > 0) return fromTrade;

  const fromSignal = parseLocaleNumber(signalEntry);
  if (Number.isFinite(fromSignal) && fromSignal > 0) return fromSignal;

  if (
    position?.openPrice != null &&
    Number.isFinite(position.openPrice) &&
    position.openPrice > 0
  ) {
    return position.openPrice;
  }

  return null;
}

function resolveExistingTakeProfit(
  tradeTp: string | number | null | undefined,
  livePosition: MetaApiOpenPosition | null,
): number | null {
  if (
    livePosition?.takeProfit != null &&
    Number.isFinite(livePosition.takeProfit) &&
    livePosition.takeProfit > 0
  ) {
    return livePosition.takeProfit;
  }
  const fromDb = parseLocaleNumber(tradeTp);
  if (Number.isFinite(fromDb) && fromDb > 0) return fromDb;
  return null;
}

async function loadAccountPositions(
  accountId: string,
  token: string,
  cache: Map<string, MetaApiOpenPosition[]>,
): Promise<MetaApiOpenPosition[]> {
  if (cache.has(accountId)) return cache.get(accountId)!;

  const res = await fetchMetaApiPositionsJson(accountId, token);
  const positions = res.ok ? parseMetaApiOpenPositions(res.positions) : [];
  cache.set(accountId, positions);
  return positions;
}

function matchLivePosition(
  positions: MetaApiOpenPosition[],
  trade: {
    symbol: string;
    signal_type: string;
    take_profit: string | number | null;
    position_id: string | number | null;
  },
): MetaApiOpenPosition | null {
  const storedId = parseStoredPositionId(trade.position_id, null);
  if (storedId) {
    const byId = positions.find((p) => p.id === storedId);
    if (byId) return byId;
  }

  const tp = parseLocaleNumber(trade.take_profit);
  return findMatchingOpenPosition(
    positions,
    trade.symbol,
    trade.signal_type,
    Number.isFinite(tp) ? tp : null,
  );
}

export async function applySlTpUpdatesForSignal(
  supabase: SupabaseClient,
  signalId: string,
  metaToken: string,
  update: {
    isBeUpdate: boolean;
    nextStopLoss: number | null;
    takeProfits: number[];
    signalTypeFilter?: "BUY" | "SELL" | null;
    symbolFilter?: string | null;
  },
): Promise<{ updated: number; skipped: number }> {
  const { data: executedTrades, error: tradesError } = await supabase
    .from("telegram_trades")
    .select(
      `
      id,
      user_id,
      mt5_account_id,
      symbol,
      signal_type,
      position_id,
      entry_price,
      take_profit,
      stop_loss,
      error_message,
      mt5_accounts!inner(metaapi_account_id),
      telegram_signals(entry_price)
    `,
    )
    .eq("signal_id", signalId)
    .eq("status", "executed");

  if (tradesError || !executedTrades?.length) {
    return { updated: 0, skipped: 0 };
  }

  const sortedTakeProfits = [...update.takeProfits].sort((a, b) => a - b);
  const sortedTradesByTp = [...executedTrades].sort((a, b) => {
    const aTp =
      a.take_profit === null ? Number.POSITIVE_INFINITY : Number(a.take_profit);
    const bTp =
      b.take_profit === null ? Number.POSITIVE_INFINITY : Number(b.take_profit);
    return aTp - bTp;
  });

  const positionsCache = new Map<string, MetaApiOpenPosition[]>();
  let updated = 0;
  let skipped = 0;

  for (const trade of executedTrades) {
    const row = trade as {
      id: string;
      symbol: string;
      signal_type: string;
      entry_price: string | number | null;
      take_profit: string | number | null;
      stop_loss: string | number | null;
      position_id: string | number | null;
      error_message: string | null;
      mt5_accounts: { metaapi_account_id: string } | { metaapi_account_id: string }[];
      telegram_signals:
        | { entry_price: string | number | null; signal_type?: string; symbol?: string }
        | { entry_price: string | number | null; signal_type?: string; symbol?: string }[]
        | null;
    };

    const side = String(row.signal_type ?? "").toUpperCase() as StopSide;
    if (
      update.signalTypeFilter &&
      side !== update.signalTypeFilter
    ) {
      skipped++;
      continue;
    }

    const mt5 = Array.isArray(row.mt5_accounts)
      ? row.mt5_accounts[0]
      : row.mt5_accounts;
    const metaApiAccountId = mt5?.metaapi_account_id;

    if (!metaApiAccountId) {
      console.warn(`⏭️ BE/SL trade ${row.id}: compte MetaAPI manquant`);
      skipped++;
      continue;
    }

    const signalRow = Array.isArray(row.telegram_signals)
      ? row.telegram_signals[0]
      : row.telegram_signals;

    const positions = await loadAccountPositions(
      metaApiAccountId,
      metaToken,
      positionsCache,
    );
    let livePosition = matchLivePosition(positions, row);

    let positionId = parseStoredPositionId(row.position_id, row.error_message);
    if (!positionId && livePosition) {
      positionId = livePosition.id;
    }

    if (!positionId) {
      if (
        livePosition &&
        !parseStoredPositionId(row.position_id, row.error_message)
      ) {
        console.warn(
          `⏭️ BE/SL trade ${row.id}: position fermée (stale position_id)`,
        );
      } else {
        console.warn(
          `⏭️ BE/SL trade ${row.id}: position_id introuvable (${row.symbol})`,
        );
      }
      skipped++;
      continue;
    }

    if (!livePosition) {
      livePosition =
        positions.find((p) => p.id === positionId) ?? null;
    }
    if (!livePosition) {
      console.warn(`⏭️ BE/SL trade ${row.id}: position ${positionId} fermée`);
      skipped++;
      continue;
    }

    const modifySymbol = livePosition.symbol || row.symbol;

    let updatedStopLoss: number | null = null;
    if (update.isBeUpdate) {
      const entry = resolveOpenPriceForBe(
        row.entry_price,
        signalRow?.entry_price ?? null,
        livePosition,
      );
      if (entry == null) {
        console.warn(
          `⏭️ BE trade ${row.id}: prix d'entrée introuvable (DB + MetaAPI)`,
        );
        skipped++;
        continue;
      }

      const quote = await fetchMetaApiSymbolQuote(
        metaApiAccountId,
        modifySymbol,
        metaToken,
      );
      if (!quote) {
        console.warn(
          `⏭️ BE trade ${row.id}: quote indisponible pour ${modifySymbol}`,
        );
        skipped++;
        continue;
      }

      updatedStopLoss = computeBreakEvenStopLoss(
        side,
        entry,
        quote,
        modifySymbol,
      );
      if (updatedStopLoss == null) {
        console.warn(
          `⏭️ BE trade ${row.id}: position pas en profit suffisant (SELL ask / BUY bid)`,
        );
        skipped++;
        continue;
      }
    } else if (update.nextStopLoss !== null) {
      updatedStopLoss = update.nextStopLoss;
    }

    let updatedTakeProfit: number | null = null;
    if (sortedTakeProfits.length > 0) {
      const tpIndex = sortedTradesByTp.findIndex((t) => t.id === row.id);
      const mapped = sortedTakeProfits[tpIndex];
      updatedTakeProfit =
        mapped !== undefined
          ? mapped
          : row.take_profit != null
            ? parseFloat(String(row.take_profit))
            : livePosition?.takeProfit ?? null;
    }

    // BE : SL seulement côté logique, mais MetaAPI efface le TP si absent → on le renvoie tel quel
    const preserveTakeProfit = update.isBeUpdate
      ? resolveExistingTakeProfit(row.take_profit, livePosition)
      : null;
    const modifyTakeProfit = updatedTakeProfit ?? preserveTakeProfit;

    if (updatedStopLoss === null && modifyTakeProfit === null) {
      skipped++;
      continue;
    }

    const modifyResult = await postMetaApiModifyPosition(
      metaApiAccountId,
      positionId,
      metaToken,
      {
        ...(updatedStopLoss !== null ? { stopLoss: updatedStopLoss } : {}),
        ...(modifyTakeProfit !== null ? { takeProfit: modifyTakeProfit } : {}),
      },
    );

    if (!modifyResult.ok) {
      console.error(
        `❌ POSITION_MODIFY trade ${row.id} pos ${positionId}:`,
        modifyResult.error,
      );
      skipped++;
      continue;
    }

    const dbPatch: Record<string, unknown> = {};
    if (updatedStopLoss !== null) dbPatch.stop_loss = updatedStopLoss;
    if (updatedTakeProfit !== null) dbPatch.take_profit = updatedTakeProfit;
    if (
      livePosition?.openPrice != null &&
      (row.entry_price == null || row.entry_price === "")
    ) {
      dbPatch.entry_price = livePosition.openPrice;
    }
    if (row.position_id == null || row.position_id === "") {
      dbPatch.position_id = positionId;
    }

    await supabase.from("telegram_trades").update(dbPatch).eq("id", row.id);

    updated++;
  }

  return { updated, skipped };
}
