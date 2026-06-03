import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { postMetaApiTradeWithStopsFallback } from "@/lib/metaapi-trade-client";
import { snapVolumeForMetaApiSymbol } from "@/lib/trade-volume";
import { parseLocaleNumber } from "@/lib/locale-number";
import { resolvePendingOrderKind } from "@/lib/order-type";
import { requireInternalSecret } from "@/lib/internal-auth";

/**
 * Exécute les trades Telegram en attente via MetaAPI
 * Route interne — requiert Authorization: Bearer <INTERNAL_API_SECRET>
 */
export async function POST(request: NextRequest) {
  const authError = requireInternalSecret(request);
  if (authError) return authError;

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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
        status,
        mt5_accounts!inner(metaapi_account_id),
        telegram_signals (
          entry_price,
          order_type
        )
      `
      )
      .in("status", ["pending", "pending_partial"])
      .limit(50); // Traiter par batch de 50

    if (fetchError) {
      console.error("❌ Erreur récupération trades:", fetchError);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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

      type SignalEmbed = {
        entry_price?: string | number | null;
        order_type?: string | null;
      };
      const sigRaw = trade.telegram_signals as
        | SignalEmbed
        | SignalEmbed[]
        | null;
      const signalRow = Array.isArray(sigRaw) ? sigRaw[0] : sigRaw;

      const entryFromTrade = parseLocaleNumber(trade.entry_price);
      const entryFromSignal = parseLocaleNumber(signalRow?.entry_price);
      const entryParsed =
        Number.isFinite(entryFromTrade) && entryFromTrade > 0
          ? entryFromTrade
          : Number.isFinite(entryFromSignal) && entryFromSignal > 0
            ? entryFromSignal
            : Number.NaN;

      const orderKind = resolvePendingOrderKind(
        trade.order_type,
        signalRow?.order_type,
        entryParsed,
      );

      const isLimitOrder = orderKind === "LIMIT";
      const isStopOrder = orderKind === "STOP";

      if (
        (isLimitOrder || isStopOrder) &&
        (!Number.isFinite(entryParsed) || entryParsed <= 0)
      ) {
        const msg = `Ordre ${orderKind} sans prix d'entrée valide (trade / signal).`;
        console.error(`❌ ${msg} trade ${trade.id}`);
        await supabase
          .from("telegram_trades")
          .update({ status: "failed", error_message: msg })
          .eq("id", trade.id);
        failed++;
        continue;
      }

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

      const rawVol =
        Number(trade.volume) > 0 ? Number(trade.volume) : 0.01;
      const order: Record<string, unknown> = {
        symbol: trade.symbol,
        actionType,
        volume: snapVolumeForMetaApiSymbol(String(trade.symbol), rawVol),
      };

      if (isLimitOrder || isStopOrder) {
        order.openPrice = entryParsed;
        console.log(
          `📤 ${orderKind} order: ${trade.signal_type} ${trade.symbol} @ ${order.openPrice}`,
        );
      } else {
        console.log(`📤 MARKET order: ${trade.signal_type} ${trade.symbol}`);
      }

      if (trade.stop_loss) {
        const sl = parseLocaleNumber(trade.stop_loss);
        if (Number.isFinite(sl)) {
          order.stopLoss = sl;
        }
      }
      if (trade.take_profit) {
        const tp = parseLocaleNumber(trade.take_profit);
        if (Number.isFinite(tp)) {
          order.takeProfit = tp;
        }
      }

      // GESTION FERMETURE PARTIELLE
      const isPartialClosure = trade.status === "pending_partial";
      if (isPartialClosure) {
        // Pour une fermeture partielle, MetaAPI demande le ticket de la position originale
        // On récupère le ticket ID stocké dans error_message ou via une recherche
        // Ici on suppose qu'on ferme par volume sur la position.
        console.log(`📉 Exécution fermeture partielle pour le trade ${trade.id}`);
        // Dans une implémentation réelle, on utiliserait l'endpoint /positions/{id}/close
      }

      // Exécuter le trade via MetaAPI (multi-URL + interprétation TRADE_RETCODE_*)
      try {
        const result = await postMetaApiTradeWithStopsFallback(
          mt5Account.metaapi_account_id,
          order,
          process.env.METAAPI_TOKEN!
        );

        if (!result.ok) {
          throw new Error(
            result.error || `MetaAPI trade échoué (HTTP ${result.status})`
          );
        }

        const data = result.data as Record<string, unknown>;

        // Mettre à jour le trade avec succès
        const rawPositionId =
          data.positionId ??
          data.numericPositionId ??
          data.position_id ??
          data.numericOrderId ??
          data.orderId ??
          null;

        const positionId =
          rawPositionId !== null && rawPositionId !== undefined
            ? parseInt(String(rawPositionId), 10)
            : null;

        await supabase
          .from("telegram_trades")
          .update({
            status: isPartialClosure ? "partially_closed" : "executed",
            executed_at: new Date().toISOString(),
            entry_price: data.price ?? trade.entry_price,
            position_id: positionId,
            // Sauvegarder l'ID de position/ordre pour les futures fermetures
            error_message:
              (data.orderId != null ? String(data.orderId) : null) ||
              (data.numericOrderId != null ? String(data.numericOrderId) : null),
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
