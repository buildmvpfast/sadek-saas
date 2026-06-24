import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchMetaApiOrdersJson,
  fetchMetaApiPositionsJson,
  findMatchingOpenPosition,
  parseMetaApiOpenPositions,
  postMetaApiCancelOrder,
  postMetaApiClosePosition,
} from "@/lib/metaapi-trade-client";
import { normalizeSymbol } from "@/lib/symbol-normalizer";

/** Annuler / couper / retirer — y compris "Annulez", "couper", "cut". */
export function isCancelOrCutCommand(messageText: string): boolean {
  return /\b(?:annulez?|cancel(?:ler|led|ez)?|coupe[rz]?|cut|retire[rz]?|efface[rz]?|supprime[rz]?|delete|cl[oô]ture[rz]?)\b/i.test(
    messageText,
  );
}

function parsePositionId(trade: {
  position_id?: string | number | null;
  error_message?: string | null;
}): string | null {
  if (trade.position_id != null && trade.position_id !== "") {
    return String(trade.position_id);
  }
  const msg = trade.error_message ?? "";
  if (/^\d+$/.test(msg.trim())) return msg.trim();
  return null;
}

function symbolFilterForSignal(standardSymbol: string): string {
  const n = normalizeSymbol(standardSymbol);
  if (n === "GOLD") return "XAU";
  return n.replace(/[^A-Z0-9]/gi, "").slice(0, 6) || n;
}

export async function resolveSignalIdForCancel(
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
    .limit(20);

  for (const sig of recentSignals ?? []) {
    const { count } = await supabase
      .from("telegram_trades")
      .select("id", { count: "exact", head: true })
      .eq("signal_id", sig.id)
      .in("status", [
        "pending",
        "pending_partial",
        "executing",
        "executed",
      ]);
    if ((count ?? 0) > 0) return sig.id;
  }

  return null;
}

export type CancelSignalResult = {
  signalId: string;
  dbCancelled: number;
  positionsClosed: number;
  ordersCancelled: number;
  errors: string[];
};

export async function cancelOrCloseSignalTrades(
  supabase: SupabaseClient,
  signalId: string,
  token: string,
): Promise<CancelSignalResult> {
  const result: CancelSignalResult = {
    signalId,
    dbCancelled: 0,
    positionsClosed: 0,
    ordersCancelled: 0,
    errors: [],
  };

  const { data: signal } = await supabase
    .from("telegram_signals")
    .select("id, symbol, signal_type")
    .eq("id", signalId)
    .maybeSingle();

  if (!signal?.id) {
    result.errors.push("Signal introuvable");
    return result;
  }

  const symFilter = symbolFilterForSignal(String(signal.symbol ?? ""));
  const side = String(signal.signal_type ?? "").toUpperCase() as "BUY" | "SELL";

  const { data: trades } = await supabase
    .from("telegram_trades")
    .select(
      `
      id,
      status,
      signal_type,
      symbol,
      position_id,
      error_message,
      take_profit,
      mt5_accounts!inner(metaapi_account_id, broker_name)
    `,
    )
    .eq("signal_id", signalId)
    .in("status", [
      "pending",
      "pending_partial",
      "executing",
      "executed",
    ]);

  const accountIds = new Set<string>();

  for (const row of trades ?? []) {
    const trade = row as {
      id: string;
      status: string;
      signal_type: string;
      symbol: string;
      position_id?: string | number | null;
      error_message?: string | null;
      take_profit?: string | number | null;
      mt5_accounts:
        | { metaapi_account_id: string; broker_name?: string | null }
        | { metaapi_account_id: string; broker_name?: string | null }[];
    };

    const mt5 = Array.isArray(trade.mt5_accounts)
      ? trade.mt5_accounts[0]
      : trade.mt5_accounts;
    const metaApiAccountId = mt5?.metaapi_account_id;
    if (metaApiAccountId) accountIds.add(metaApiAccountId);

    if (trade.status === "pending" || trade.status === "pending_partial") {
      const { error } = await supabase
        .from("telegram_trades")
        .update({
          status: "failed",
          error_message: "Annulé par commande Telegram",
          executed_at: null,
        })
        .eq("id", trade.id)
        .in("status", ["pending", "pending_partial"]);
      if (!error) result.dbCancelled++;
      continue;
    }

    if (trade.status === "executing") {
      let closed = false;
      if (metaApiAccountId) {
        const pid = parsePositionId(trade);
        if (pid) {
          const closeRes = await postMetaApiClosePosition(
            metaApiAccountId,
            pid,
            token,
          );
          if (closeRes.ok) {
            closed = true;
            result.positionsClosed++;
          } else {
            result.errors.push(`Close ${trade.id}: ${closeRes.error}`);
          }
        } else {
          const posRes = await fetchMetaApiPositionsJson(metaApiAccountId, token);
          if (posRes.ok) {
            const positions = parseMetaApiOpenPositions(posRes.positions);
            const match = findMatchingOpenPosition(
              positions,
              trade.symbol,
              trade.signal_type,
            );
            if (match?.id) {
              const closeRes = await postMetaApiClosePosition(
                metaApiAccountId,
                match.id,
                token,
              );
              if (closeRes.ok) {
                closed = true;
                result.positionsClosed++;
              }
            }
          }
        }
      }

      await supabase
        .from("telegram_trades")
        .update({
          status: closed ? "closed" : "failed",
          error_message: closed
            ? "Annulé — position fermée (Telegram)"
            : "Annulé par commande Telegram",
          executed_at: null,
        })
        .eq("id", trade.id)
        .eq("status", "executing");

      if (!closed) result.dbCancelled++;
      continue;
    }

    if (trade.status === "executed" && metaApiAccountId) {
      const pid = parsePositionId(trade);
      if (pid) {
        const closeRes = await postMetaApiClosePosition(
          metaApiAccountId,
          pid,
          token,
        );
        if (closeRes.ok) {
          result.positionsClosed++;
          await supabase
            .from("telegram_trades")
            .update({
              status: "closed",
              error_message: "Fermé par commande Telegram",
            })
            .eq("id", trade.id);
        } else {
          result.errors.push(
            `${mt5?.broker_name ?? metaApiAccountId} #${pid}: ${closeRes.error}`,
          );
        }
        continue;
      }

      const posRes = await fetchMetaApiPositionsJson(metaApiAccountId, token);
      if (!posRes.ok) continue;
      const positions = parseMetaApiOpenPositions(posRes.positions);
      const tradeTp = trade.take_profit
        ? parseFloat(String(trade.take_profit))
        : NaN;
      let match = null as ReturnType<typeof findMatchingOpenPosition>;
      for (const p of positions) {
        const hit = findMatchingOpenPosition([p], trade.symbol, trade.signal_type);
        if (!hit) continue;
        if (
          Number.isFinite(tradeTp) &&
          hit.takeProfit != null &&
          Number.isFinite(hit.takeProfit) &&
          Math.abs(hit.takeProfit - tradeTp) >= 5
        ) {
          continue;
        }
        match = hit;
        break;
      }
      if (!match?.id) continue;

      const closeRes = await postMetaApiClosePosition(
        metaApiAccountId,
        match.id,
        token,
      );
      if (closeRes.ok) {
        result.positionsClosed++;
        await supabase
          .from("telegram_trades")
          .update({
            status: "closed",
            position_id: match.id,
            error_message: "Fermé par commande Telegram",
          })
          .eq("id", trade.id);
      } else {
        result.errors.push(
          `${mt5?.broker_name ?? metaApiAccountId}: ${closeRes.error}`,
        );
      }
    }
  }

  for (const accountId of Array.from(accountIds)) {
    const ordersRes = await fetchMetaApiOrdersJson(accountId, token);
    if (!ordersRes.ok) continue;

    for (const raw of ordersRes.orders) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const sym = String(row.symbol ?? row.brokerSymbol ?? "");
      if (symFilter && !sym.toUpperCase().includes(symFilter.toUpperCase())) {
        continue;
      }
      const typeLabel = String(
        row.type ?? row.orderType ?? row.actionType ?? "",
      ).toUpperCase();
      if (side === "SELL" && !typeLabel.includes("SELL")) continue;
      if (side === "BUY" && !typeLabel.includes("BUY")) continue;

      const id =
        row.id ?? row.orderId ?? row.ticket ?? row.numericOrderId ?? null;
      if (id == null) continue;

      const res = await postMetaApiCancelOrder(accountId, String(id), token);
      if (res.ok) result.ordersCancelled++;
    }
  }

  return result;
}
