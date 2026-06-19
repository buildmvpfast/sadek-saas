import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { executeOnePendingTrade, releaseStaleExecutingTrades } from "@/lib/trade-execution-core";
import { requireInternalSecret } from "@/lib/internal-auth";
import { isTransientMetaApiError } from "@/lib/metaapi-errors";

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
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    if (!process.env.METAAPI_TOKEN) {
      return NextResponse.json(
        { error: "METAAPI_TOKEN non configuré" },
        { status: 500 },
      );
    }

    console.log("🔍 Recherche des trades en attente...");
    const released = await releaseStaleExecutingTrades(supabase);
    if (released > 0) {
      console.warn(`♻️ ${released} trade(s) executing débloqué(s) → pending`);
    }

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
        position_id,
        partial_close_percent,
        mt5_accounts!inner(metaapi_account_id, broker_name, symbol_profile),
        telegram_signals (
          entry_price,
          order_type,
          symbol
        )
      `,
      )
      .in("status", ["pending", "pending_partial"])
      .limit(50);

    if (fetchError) {
      console.error("❌ Erreur récupération trades:", fetchError);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    if (!pendingTrades?.length) {
      return NextResponse.json({
        success: true,
        message: "Aucun trade en attente",
        executed: 0,
      });
    }

    console.log(`📊 ${pendingTrades.length} trade(s) en attente`);
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
          continue;
        }
        executed++;
        console.log(`✅ Trade ${trade.id} exécuté`);
      } else {
        if (isTransientMetaApiError(result.error)) {
          console.warn(
            `⏳ Trade ${trade.id}: erreur réseau MetaAPI, reste pending — ${result.error}`,
          );
          continue;
        }
        failed++;
        console.error(`❌ Trade ${trade.id}:`, result.error);
      }
    }

    return NextResponse.json({
      success: true,
      executed,
      failed,
      skipped,
      total: pendingTrades.length,
    });
  } catch (error: unknown) {
    console.error("Error executing trades:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
