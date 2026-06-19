/**
 * Worker Render — exécute pending + pending_partial via lib partagée.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { executeOnePendingTrade, releaseStaleExecutingTrades } from "../lib/trade-execution-core";
import { isTransientMetaApiError } from "../lib/metaapi-errors";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function releaseStaleExecutingTradesLocal(): Promise<void> {
  const n = await releaseStaleExecutingTrades(supabase);
  if (n > 0) console.warn(`♻️ ${n} trade(s) executing bloqués → pending`);
}

async function executePendingTrades() {
  if (!process.env.METAAPI_TOKEN) {
    console.error("❌ METAAPI_TOKEN non configuré");
    return;
  }

  await releaseStaleExecutingTradesLocal();

  const { data: pendingTrades, error } = await supabase
    .from("telegram_trades")
    .select(
      `
      id, user_id, signal_id, mt5_account_id, symbol, signal_type, order_type,
      volume, entry_price, stop_loss, take_profit, error_message, status,
      position_id, partial_close_percent,
      mt5_accounts!inner(metaapi_account_id, broker_name, symbol_profile),
      telegram_signals (entry_price, order_type, symbol)
    `,
    )
    .in("status", ["pending", "pending_partial"])
    .limit(50);

  if (error) {
    console.error("❌ fetch:", error);
    return;
  }
  if (!pendingTrades?.length) {
    console.log("✅ Aucun trade en attente");
    return;
  }

  let executed = 0;
  let failed = 0;
  let skipped = 0;
  for (const trade of pendingTrades) {
    const result = await executeOnePendingTrade(
      supabase,
      trade as Parameters<typeof executeOnePendingTrade>[1],
      process.env.METAAPI_TOKEN!,
    );
    if (result.ok) {
      if (result.skipped) {
        skipped++;
      } else {
        executed++;
      }
    } else if (isTransientMetaApiError(result.error)) {
      console.warn(`⏳ ${trade.id}: réseau MetaAPI, retry — ${result.error}`);
    } else {
      failed++;
    }
  }
  console.log(`📈 ${executed} ok, ${failed} failed, ${skipped} skipped`);
}

async function start() {
  console.log("🚀 Worker telegram-trades");
  await executePendingTrades();
  setInterval(executePendingTrades, 5000);
}

start().catch(console.error);
