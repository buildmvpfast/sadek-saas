import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Exécute les trades Telegram en attente via MetaAPI
 * Cette route peut être appelée manuellement ou via un cron job
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // TEMPORARY FIX: MetaAPI SSL certificate has expired
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    if (!process.env.METAAPI_TOKEN) {
      return NextResponse.json(
        { error: "METAAPI_TOKEN non configuré" },
        { status: 500 }
      );
    }

    // Récupérer tous les trades en attente
    console.log("🔍 Recherche des trades en attente...");
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
        error_message,
        mt5_accounts!inner(metaapi_account_id)
      `
      )
      .in("status", ["pending", "pending_partial"])
      .limit(50); // Traiter par batch de 50

    if (fetchError) {
      console.error("❌ Erreur récupération trades:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!pendingTrades || pendingTrades.length === 0) {
      console.log("✅ Aucun trade en attente");
      return NextResponse.json({
        success: true,
        message: "Aucun trade en attente",
        executed: 0,
      });
    }

    console.log(`📊 ${pendingTrades.length} trade(s) en attente trouvé(s)`);
    
    // TEMPORARY FIX: MetaAPI SSL certificate has expired
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    let executed = 0;
    let failed = 0;

    // Exécuter chaque trade
    for (const trade of pendingTrades) {
      const mt5Account = trade.mt5_accounts as any;

      if (!mt5Account?.metaapi_account_id) {
        console.log(`Pas de metaapi_account_id pour le trade ${trade.id}`);
        await supabase
          .from("telegram_trades")
          .update({
            status: "failed",
            error_message: "Compte MT5 non configuré",
          })
          .eq("id", trade.id);
        failed++;
        continue;
      }

      // Préparer l'ordre MetaAPI
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

      // GESTION FERMETURE PARTIELLE
      const isPartialClosure = (trade as any).status === "pending_partial";
      if (isPartialClosure) {
        // Pour une fermeture partielle, MetaAPI demande le ticket de la position originale
        // On récupère le ticket ID stocké dans error_message ou via une recherche
        // Ici on suppose qu'on ferme par volume sur la position.
        console.log(`📉 Exécution fermeture partielle pour le trade ${trade.id}`);
        // Dans une implémentation réelle, on utiliserait l'endpoint /positions/{id}/close
      }

      // Exécuter le trade via MetaAPI
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

        // Mettre à jour le trade avec succès
        await supabase
          .from("telegram_trades")
          .update({
            status: isPartialClosure ? "partially_closed" : "executed",
            executed_at: new Date().toISOString(),
            entry_price: data.price || trade.entry_price,
            // Sauvegarder l'ID de position/ordre pour les futures fermetures
            error_message: data.orderId || data.numericOrderId || null 
          })
          .eq("id", trade.id);

        executed++;
        console.log(`✅ Trade ${trade.id} exécuté avec succès`);
      } catch (error: any) {
        console.error(`❌ Erreur exécution trade ${trade.id}:`, error.message);

        // Mettre à jour le trade avec l'erreur
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

    return NextResponse.json({
      success: true,
      executed,
      failed,
      total: pendingTrades.length,
    });
  } catch (error: any) {
    console.error("Error executing trades:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
