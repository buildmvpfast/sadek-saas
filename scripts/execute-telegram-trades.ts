/**
 * Service qui exécute les trades Telegram en attente
 * Lance ce script en continu: ts-node scripts/execute-telegram-trades.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function executePendingTrades() {
  if (!process.env.METAAPI_TOKEN) {
    console.error("❌ METAAPI_TOKEN non configuré");
    return;
  }

  console.log("🔍 Recherche des trades en attente...");

  // D'abord, récupérer tous les trades en attente (sans join pour voir s'il y en a)
  const { data: allPendingTrades, error: countError } = await supabase
    .from("telegram_trades")
    .select("id, mt5_account_id, symbol, status")
    .eq("status", "pending")
    .limit(50);

  if (countError) {
    console.error("❌ Erreur récupération trades:", countError);
    return;
  }

  if (!allPendingTrades || allPendingTrades.length === 0) {
    console.log("✅ Aucun trade en attente");
    return;
  }

  console.log(`📊 ${allPendingTrades.length} trade(s) en attente trouvé(s)`);

  // Maintenant récupérer avec le join pour avoir les infos MetaAPI
  const { data: pendingTrades, error: fetchError } = await supabase
    .from("telegram_trades")
    .select(
      `
      id,
      user_id,
      signal_id,
      mt5_account_id,
      symbol,
      signal_type,
      volume,
      entry_price,
      stop_loss,
      take_profit,
      mt5_accounts!inner(metaapi_account_id)
    `
    )
    .eq("status", "pending")
    .limit(50);

  if (fetchError) {
    console.error("❌ Erreur récupération trades avec join:", fetchError);
    console.log("⚠️  Tentative sans join...");

    // Fallback: récupérer sans join et faire le join manuellement
    const { data: tradesWithoutJoin } = await supabase
      .from("telegram_trades")
      .select("*")
      .eq("status", "pending")
      .limit(50);

    if (!tradesWithoutJoin || tradesWithoutJoin.length === 0) {
      console.log("✅ Aucun trade en attente (après fallback)");
      return;
    }

    console.log(
      `⚠️  ${tradesWithoutJoin.length} trade(s) trouvé(s) mais problème avec le join`
    );
    console.log(
      "   → Vérifie que les comptes MT5 ont bien un metaapi_account_id"
    );
    return;
  }

  if (!pendingTrades || pendingTrades.length === 0) {
    console.log(
      "⚠️  Des trades sont en attente mais aucun n'a de compte MT5 avec metaapi_account_id"
    );
    return;
  }

  console.log(`✅ ${pendingTrades.length} trade(s) prêt(s) à être exécuté(s)`);

  let executed = 0;
  let failed = 0;

  for (const trade of pendingTrades) {
    const mt5Account = trade.mt5_accounts as any;

    if (!mt5Account?.metaapi_account_id) {
      console.log(`⚠️  Trade ${trade.id}: Pas de metaapi_account_id`);
      await supabase
        .from("telegram_trades")
        .update({ status: "failed", error_message: "Compte MT5 non configuré" })
        .eq("id", trade.id);
      failed++;
      continue;
    }

    const actionType =
      trade.signal_type === "BUY" ? "ORDER_TYPE_BUY" : "ORDER_TYPE_SELL";

    const order: any = {
      symbol: trade.symbol,
      actionType,
      volume: trade.volume || 0.01,
    };

    if (trade.stop_loss) {
      order.stopLoss = trade.stop_loss;
    }
    if (trade.take_profit) {
      order.takeProfit = trade.take_profit;
    }

    try {
      const response = await fetch(
        `https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${mt5Account.metaapi_account_id}/trade`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "auth-token": process.env.METAAPI_TOKEN!,
          },
          body: JSON.stringify(order),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Trade failed");
      }

      await supabase
        .from("telegram_trades")
        .update({
          status: "executed",
          executed_at: new Date().toISOString(),
          entry_price: data.price || trade.entry_price,
        })
        .eq("id", trade.id);

      executed++;
      console.log(
        `✅ Trade ${trade.id} exécuté: ${trade.signal_type} ${trade.symbol} ${trade.volume} lots`
      );
    } catch (error: any) {
      console.error(`❌ Erreur trade ${trade.id}:`, error.message);

      await supabase
        .from("telegram_trades")
        .update({
          status: "failed",
          error_message: error.message,
        })
        .eq("id", trade.id);

      failed++;
    }
  }

  console.log(`\n📈 Résultat: ${executed} exécuté(s), ${failed} échoué(s)`);
}

// Exécuter toutes les 5 secondes
async function start() {
  console.log("🚀 Service d'exécution des trades Telegram démarré");
  console.log("⏱️  Vérification toutes les 5 secondes...\n");

  await executePendingTrades();

  setInterval(async () => {
    await executePendingTrades();
  }, 5000);
}

start().catch(console.error);
