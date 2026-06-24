import type { SupabaseClient } from "@supabase/supabase-js";
import { isMetaApiTradeSuccess } from "@/lib/metaapi-trade-client";
import { looksLikeNewOpeningSignal } from "@/lib/order-type";

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
      position_id,
      entry_price,
      take_profit,
      stop_loss,
      error_message,
      mt5_accounts!inner(metaapi_account_id)
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

  let updated = 0;
  let skipped = 0;

  for (const trade of executedTrades) {
    const row = trade as {
      id: string;
      entry_price: string | number | null;
      take_profit: string | number | null;
      stop_loss: string | number | null;
      position_id: string | number | null;
      error_message: string | null;
      mt5_accounts: { metaapi_account_id: string } | { metaapi_account_id: string }[];
    };

    const mt5 = Array.isArray(row.mt5_accounts)
      ? row.mt5_accounts[0]
      : row.mt5_accounts;
    const metaApiAccountId = mt5?.metaapi_account_id;

    const rawPositionId =
      row.position_id ??
      (row.error_message && !Number.isNaN(parseInt(row.error_message, 10))
        ? parseInt(row.error_message, 10)
        : null);

    if (!metaApiAccountId || rawPositionId == null) {
      skipped++;
      continue;
    }

    let updatedStopLoss: number | null = null;
    if (update.isBeUpdate) {
      if (row.entry_price != null) {
        updatedStopLoss = parseFloat(String(row.entry_price));
      }
    } else if (update.nextStopLoss !== null) {
      updatedStopLoss = update.nextStopLoss;
    }

    let updatedTakeProfit: number | null = null;
    if (sortedTakeProfits.length > 0) {
      const tpIndex = sortedTradesByTp.findIndex((t) => t.id === row.id);
      const mapped = sortedTakeProfits[tpIndex];
      updatedTakeProfit =
        mapped !== undefined ? mapped : row.take_profit != null
          ? parseFloat(String(row.take_profit))
          : null;
    }

    if (updatedStopLoss === null && updatedTakeProfit === null) {
      skipped++;
      continue;
    }

    const body: Record<string, unknown> = {
      actionType: "POSITION_MODIFY",
      positionId: String(rawPositionId),
      stopLossUnits: "ABSOLUTE_PRICE",
      takeProfitUnits: "ABSOLUTE_PRICE",
    };
    if (updatedStopLoss !== null) body.stopLoss = updatedStopLoss;
    if (updatedTakeProfit !== null) body.takeProfit = updatedTakeProfit;

    try {
      const modifyUrl = `https://mt-client-api-v1.london.agiliumtrade.ai/users/current/accounts/${metaApiAccountId}/trade`;
      const resp = await fetch(modifyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "auth-token": metaToken,
        },
        body: JSON.stringify(body),
      });

      const respData = await resp.json().catch(() => ({}));
      if (!resp.ok || !isMetaApiTradeSuccess(respData)) {
        console.error(
          `❌ POSITION_MODIFY failed for trade ${row.id}:`,
          resp.status,
          respData,
        );
        skipped++;
        continue;
      }
    } catch (e) {
      console.error(
        `❌ POSITION_MODIFY error for trade ${row.id}:`,
        e instanceof Error ? e.message : e,
      );
      skipped++;
      continue;
    }

    await supabase
      .from("telegram_trades")
      .update({
        stop_loss:
          updatedStopLoss !== null ? updatedStopLoss : row.stop_loss,
        take_profit:
          updatedTakeProfit !== null ? updatedTakeProfit : row.take_profit,
      })
      .eq("id", row.id);

    updated++;
  }

  return { updated, skipped };
}
