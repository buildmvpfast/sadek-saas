import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchMetaApiOrdersJson,
  postMetaApiCancelOrder,
} from "@/lib/metaapi-trade-client";

function orderId(row: Record<string, unknown>): string | null {
  const id =
    row.id ??
    row.orderId ??
    row.ticket ??
    row.numericOrderId ??
    row.order_id;
  return id != null ? String(id) : null;
}

function orderSymbol(row: Record<string, unknown>): string {
  return String(row.symbol ?? row.brokerSymbol ?? "");
}

function orderTypeLabel(row: Record<string, unknown>): string {
  return String(
    row.type ?? row.orderType ?? row.actionType ?? row.order_type ?? "pending",
  );
}

export type CancelPendingOrdersResult = {
  accounts: number;
  cancelled: number;
  details: Array<{
    accountId: string;
    brokerName?: string | null;
    orderId: string;
    symbol: string;
    type: string;
    ok: boolean;
    error?: string;
  }>;
};

export async function cancelPendingOrdersForAccounts(
  accountIds: Array<{ id: string; brokerName?: string | null }>,
  token: string,
  symbolFilter?: string,
): Promise<CancelPendingOrdersResult> {
  const details: CancelPendingOrdersResult["details"] = [];
  let cancelled = 0;

  for (const { id: accountId, brokerName } of accountIds) {
    const ordersRes = await fetchMetaApiOrdersJson(accountId, token);
    if (!ordersRes.ok) {
      details.push({
        accountId,
        brokerName,
        orderId: "-",
        symbol: "",
        type: "",
        ok: false,
        error: ordersRes.error,
      });
      continue;
    }

    for (const raw of ordersRes.orders) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const sym = orderSymbol(row);
      if (
        symbolFilter &&
        !sym.toUpperCase().includes(symbolFilter.toUpperCase())
      ) {
        continue;
      }
      const id = orderId(row);
      if (!id) continue;

      const res = await postMetaApiCancelOrder(accountId, id, token);
      const entry = {
        accountId,
        brokerName,
        orderId: id,
        symbol: sym,
        type: orderTypeLabel(row),
        ok: res.ok,
        error: res.error,
      };
      details.push(entry);
      if (res.ok) cancelled++;
    }
  }

  return { accounts: accountIds.length, cancelled, details };
}

export async function cancelPendingOrdersForChannelUsers(
  supabase: SupabaseClient,
  channelId: string,
  token: string,
  options?: { side?: "BUY" | "SELL"; symbolIncludes?: string },
): Promise<CancelPendingOrdersResult> {
  const { data: subs } = await supabase
    .from("user_telegram_subscriptions")
    .select("user_id")
    .eq("channel_id", channelId)
    .eq("is_active", true);

  const userIds = (subs ?? []).map((s) => s.user_id).filter(Boolean);
  if (!userIds.length) {
    return { accounts: 0, cancelled: 0, details: [] };
  }

  const { data: rows } = await supabase
    .from("mt5_accounts")
    .select("metaapi_account_id, broker_name")
    .in("user_id", userIds)
    .eq("is_active", true)
    .not("metaapi_account_id", "is", null);

  const accounts = (rows ?? [])
    .map((r) => ({
      id: r.metaapi_account_id as string,
      brokerName: (r.broker_name as string | null) ?? null,
    }))
    .filter((a) => a.id);

  const details: CancelPendingOrdersResult["details"] = [];
  let cancelled = 0;

  for (const { id: accountId, brokerName } of accounts) {
    const ordersRes = await fetchMetaApiOrdersJson(accountId, token);
    if (!ordersRes.ok) {
      details.push({
        accountId,
        brokerName,
        orderId: "-",
        symbol: "",
        type: "",
        ok: false,
        error: ordersRes.error,
      });
      continue;
    }

    for (const raw of ordersRes.orders) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const sym = orderSymbol(row);
      if (
        options?.symbolIncludes &&
        !sym.toUpperCase().includes(options.symbolIncludes.toUpperCase())
      ) {
        continue;
      }
      const typeLabel = orderTypeLabel(row).toUpperCase();
      if (options?.side === "SELL" && !typeLabel.includes("SELL")) continue;
      if (options?.side === "BUY" && !typeLabel.includes("BUY")) continue;

      const id = orderId(row);
      if (!id) continue;

      const res = await postMetaApiCancelOrder(accountId, id, token);
      details.push({
        accountId,
        brokerName,
        orderId: id,
        symbol: sym,
        type: orderTypeLabel(row),
        ok: res.ok,
        error: res.error,
      });
      if (res.ok) cancelled++;
    }
  }

  return { accounts: accounts.length, cancelled, details };
}

export async function loadMetaApiAccountsFromSupabase(
  supabase: SupabaseClient,
  options?: { broker?: string; accountId?: string },
): Promise<Array<{ id: string; brokerName: string | null; login: string | null }>> {
  let query = supabase
    .from("mt5_accounts")
    .select("metaapi_account_id, broker_name, login")
    .not("metaapi_account_id", "is", null);

  if (options?.accountId) {
    query = query.eq("metaapi_account_id", options.accountId);
  } else if (options?.broker) {
    query = query.ilike("broker_name", `%${options.broker}%`);
  }

  const { data } = await query;
  return (data ?? [])
    .map((r) => ({
      id: r.metaapi_account_id as string,
      brokerName: (r.broker_name as string | null) ?? null,
      login: (r.login as string | null) ?? null,
    }))
    .filter((r) => r.id);
}
