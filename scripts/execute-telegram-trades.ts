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
  // Bypassing SSL certificate error for MetaAPI (expired certificate)

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
      order_type,
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

    // Déterminer le type d'ordre selon order_type ou entry_price
    const orderType =
      (trade as any).order_type || (!trade.entry_price ? "MARKET" : "LIMIT");
    const isMarketOrder = orderType === "MARKET";
    const isLimitOrder = orderType === "LIMIT";
    const isStopOrder = orderType === "STOP";

    // Déterminer actionType selon le type d'ordre
    let actionType: string;
    if (isStopOrder) {
      actionType =
        trade.signal_type === "BUY"
          ? "ORDER_TYPE_BUY_STOP"
          : "ORDER_TYPE_SELL_STOP";
    } else if (isLimitOrder) {
      actionType =
        trade.signal_type === "BUY"
          ? "ORDER_TYPE_BUY_LIMIT"
          : "ORDER_TYPE_SELL_LIMIT";
    } else {
      actionType =
        trade.signal_type === "BUY" ? "ORDER_TYPE_BUY" : "ORDER_TYPE_SELL";
    }

    const order: any = {
      symbol: trade.symbol,
      actionType,
      volume: trade.volume || 0.01,
    };

    // Si c'est un limit ou stop order, ajouter le prix
    if ((isLimitOrder || isStopOrder) && trade.entry_price) {
      order.openPrice = parseFloat(trade.entry_price.toString());
      console.log(
        `📤 ${orderType} order: ${trade.signal_type} ${trade.symbol} @ ${order.openPrice}`
      );
    } else {
      // Market order (par défaut) - pas besoin de price
      console.log(`📤 MARKET order: ${trade.signal_type} ${trade.symbol}`);
    }

    if (trade.stop_loss) {
      order.stopLoss = parseFloat(trade.stop_loss.toString());
    }
    if (trade.take_profit) {
      order.takeProfit = parseFloat(trade.take_profit.toString());
    }

    try {
      // Liste des URLs possibles à tester (double domaine nécessaire pour cet environnement)
      const possibleUrls = [
        `https://mt-client-api-v1.london.agiliumtrade.ai/users/current/accounts/${mt5Account.metaapi_account_id}/trade`,
        `https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${mt5Account.metaapi_account_id}/trade`,
        `https://mt-client-api-v1.london.agiliumtrade.agiliumtrade.ai/users/current/accounts/${mt5Account.metaapi_account_id}/trade`,
        `https://metaapi-api.london.agiliumtrade.agiliumtrade.ai/users/current/accounts/${mt5Account.metaapi_account_id}/trade`
      ];

      let response = null;
      let lastError = null;
      let successUrl = null;

      for (const url of possibleUrls) {
        try {
          console.log(`📡 Tentative d'exécution sur: ${url}`);
          const body = JSON.stringify(order);
          console.log(`📦 Body being sent: ${body}`);
          response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "auth-token": process.env.METAAPI_TOKEN!,
            },
            body,
          });

          // Si on a un 404 HTML, on continue avec l'URL suivante
          const contentType = response.headers.get("content-type");
          if (response.status === 404 && contentType?.includes("text/html")) {
            console.warn(`⚠️ 404 HTML reçu sur ${url}, essai suivant...`);
            continue;
          }

          // Si on arrive ici, on a une réponse JSON (succès ou erreur API)
          successUrl = url;
          break;
        } catch (e: any) {
          console.error(`❌ Échec fetch sur ${url}:`, e.message);
          lastError = e;
        }
      }

      if (!response || !successUrl) {
        throw lastError || new Error("Impossible de joindre aucun endpoint MetaAPI (SSL ou URL incorrecte)");
      }

      const data = await response.json();

      if (!response.ok) {
        console.error(`❌ MetaAPI Error (${response.status}):`, data);
        throw new Error(data.message || `Trade failed with status ${response.status}`);
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
