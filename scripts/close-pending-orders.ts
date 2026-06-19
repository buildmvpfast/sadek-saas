/**
 * Annule les ordres pending (buy/sell limit/stop) sur un compte MetaAPI.
 *
 * Usage:
 *   METAAPI_TOKEN=... NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/close-pending-orders.ts --broker FXcess
 *
 *   npx tsx scripts/close-pending-orders.ts --account b2f7ffb6-1f64-47c0-b428-5a5c9ab3d954
 *
 *   npx tsx scripts/close-pending-orders.ts --broker FXcess --symbol XAUUSD
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import {
  fetchMetaApiOrdersJson,
  postMetaApiCancelOrder,
  postMetaApiClosePosition,
  fetchMetaApiPositionsJson,
} from "../lib/metaapi-trade-client";

dotenv.config({ path: ".env.local" });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || !process.argv[i + 1]) return undefined;
  return process.argv[i + 1];
}

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

async function main() {
  const token = process.env.METAAPI_TOKEN;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const brokerFilter = arg("broker");
  const accountArg = arg("account");
  const symbolFilter = arg("symbol");

  if (!token) {
    console.error("❌ METAAPI_TOKEN manquant (.env.local ou export)");
    process.exit(1);
  }

  let accountIds: string[] = [];

  if (accountArg) {
    accountIds = [accountArg];
  } else if (brokerFilter && supabaseUrl && serviceKey) {
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data } = await supabase
      .from("mt5_accounts")
      .select("metaapi_account_id, broker_name, login")
      .ilike("broker_name", `%${brokerFilter}%`)
      .not("metaapi_account_id", "is", null);
    accountIds = (data ?? [])
      .map((r) => r.metaapi_account_id as string)
      .filter(Boolean);
    console.log(
      `📋 ${accountIds.length} compte(s) ${brokerFilter}:`,
      (data ?? []).map((r) => `${r.login} (${r.metaapi_account_id})`).join(", "),
    );
  } else {
    console.error("❌ --account UUID ou --broker FXcess + Supabase env");
    process.exit(1);
  }

  if (!accountIds.length) {
    console.error("❌ Aucun compte MetaAPI trouvé");
    process.exit(1);
  }

  let cancelled = 0;
  let closed = 0;

  for (const accountId of accountIds) {
    console.log(`\n🔍 Compte ${accountId}`);

    const ordersRes = await fetchMetaApiOrdersJson(accountId, token);
    if (ordersRes.ok) {
      for (const raw of ordersRes.orders) {
        if (!raw || typeof raw !== "object") continue;
        const row = raw as Record<string, unknown>;
        const sym = orderSymbol(row);
        if (symbolFilter && !sym.toUpperCase().includes(symbolFilter.toUpperCase())) {
          continue;
        }
        const id = orderId(row);
        if (!id) continue;
        console.log(`  🗑️ Cancel order ${id} ${sym}`);
        const res = await postMetaApiCancelOrder(accountId, id, token);
        if (res.ok) cancelled++;
        else console.warn(`     ⚠️ ${res.error}`);
      }
    } else {
      console.warn(`  ⚠️ orders: ${ordersRes.error}`);
    }

    const posRes = await fetchMetaApiPositionsJson(accountId, token);
    if (posRes.ok) {
      for (const raw of posRes.positions) {
        if (!raw || typeof raw !== "object") continue;
        const row = raw as Record<string, unknown>;
        const sym = orderSymbol(row);
        if (symbolFilter && !sym.toUpperCase().includes(symbolFilter.toUpperCase())) {
          continue;
        }
        const id =
          row.id ?? row.positionId ?? row.ticket ?? row.numericPositionId;
        if (id == null) continue;
        console.log(`  🔴 Close position ${id} ${sym}`);
        const res = await postMetaApiClosePosition(
          accountId,
          String(id),
          token,
        );
        if (res.ok) closed++;
        else console.warn(`     ⚠️ ${res.error}`);
      }
    }
  }

  console.log(`\n✅ ${cancelled} ordre(s) annulé(s), ${closed} position(s) fermée(s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
