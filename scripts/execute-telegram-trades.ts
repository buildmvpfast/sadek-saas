/**
 * Worker Render — exécute pending + pending_partial via lib partagée.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { executeOnePendingTrade } from "../lib/trade-execution-core";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function executePendingTrades() {
  if (!process.env.METAAPI_TOKEN) {
    console.error("❌ METAAPI_TOKEN non configuré");
    return;
  }

  const { data: pendingTrades, error } = await supabase
    .from("telegram_trades")
    .select(
      `
      id, user_id, signal_id, mt5_account_id, symbol, signal_type, order_type,
      volume, entry_price, stop_loss, take_profit, error_message, status,
      position_id, partial_close_percent,
      mt5_accounts!inner(metaapi_account_id),
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
  for (const trade of pendingTrades) {
    const result = await executeOnePendingTrade(
      supabase,
      trade as Parameters<typeof executeOnePendingTrade>[1],
      process.env.METAAPI_TOKEN!,
    );
    if (result.ok) {
      executed++;
    } else {
      failed++;
      await supabase
        .from("telegram_trades")
        .update({ status: "failed", error_message: result.error })
        .eq("id", trade.id);
    }
  }
  console.log(`📈 ${executed} ok, ${failed} failed`);
}

async function start() {
  console.log("🚀 Worker telegram-trades");
  await executePendingTrades();
  setInterval(executePendingTrades, 5000);
}

start().catch(console.error);
