import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchMetaApiPositionsJson,
  findMatchingOpenPosition,
  parseMetaApiOpenPositions,
  postMetaApiModifyPosition,
  type MetaApiOpenPosition,
} from "@/lib/metaapi-trade-client";
import { looksLikeNewOpeningSignal } from "@/lib/order-type";
import { parseLocaleNumber } from "@/lib/locale-number";

export function detectSlTpUpdateMessage(messageText: string): {
  isBeUpdate: boolean;
  nextStopLoss: number | null;
  takeProfits: number[];
  hasUpdate: boolean;
} {
  if (looksLikeNewOpeningSignal(messageText)) {
    return {
      isBeUpdate: false,
      nextStopLoss: null,
      takeProfits: [],
      hasUpdate: false,
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

  return { isBeUpdate, nextStopLoss, takeProfits, hasUpdate };
}

/** Signal cible : reply Telegram ou dernier signal avec positions ouvertes (24h). */
export async function resolveSignalIdForPositionUpdate(
  supabase: SupabaseClient,
  channelId: string,
  replyToMessageId?: number | null,
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
    .select("id, parsed_at")
    .eq("channel_id", channelId)
    .gte("parsed_at", since)
    .order("parsed_at", { ascending: false })
    .limit(15);

  for (const sig of recentSignals ?? []) {
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
        | { entry_price: string | number | null }
        | { entry_price: string | number | null }[]
        | null;
    };

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
    const livePosition = matchLivePosition(positions, row);

    let positionId = parseStoredPositionId(row.position_id, row.error_message);
    if (!positionId && livePosition) {
      positionId = livePosition.id;
    }

    if (!positionId) {
      console.warn(
        `⏭️ BE/SL trade ${row.id}: position_id introuvable (${row.symbol})`,
      );
      skipped++;
      continue;
    }

    let updatedStopLoss: number | null = null;
    if (update.isBeUpdate) {
      updatedStopLoss = resolveOpenPriceForBe(
        row.entry_price,
        signalRow?.entry_price ?? null,
        livePosition,
      );
      if (updatedStopLoss == null) {
        console.warn(
          `⏭️ BE trade ${row.id}: prix d'entrée introuvable (DB + MetaAPI)`,
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

    if (updatedStopLoss === null && updatedTakeProfit === null) {
      skipped++;
      continue;
    }

    const modifyResult = await postMetaApiModifyPosition(
      metaApiAccountId,
      positionId,
      metaToken,
      {
        ...(updatedStopLoss !== null ? { stopLoss: updatedStopLoss } : {}),
        ...(updatedTakeProfit !== null ? { takeProfit: updatedTakeProfit } : {}),
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
