import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireInternalOrWebhookSecret } from "@/lib/internal-auth";
import {
  cancelPendingOrdersForAccounts,
  loadMetaApiAccountsFromSupabase,
} from "@/lib/cancel-pending-orders";

/**
 * Annule tous les ordres pending (buy/sell limit/stop) sur les comptes MetaAPI.
 * POST { "broker": "VT Markets" } | { "accountId": "uuid" } | {} = tous les comptes
 */
export async function POST(request: NextRequest) {
  const authError = requireInternalOrWebhookSecret(request);
  if (authError) return authError;

  if (!process.env.METAAPI_TOKEN) {
    return NextResponse.json(
      { error: "METAAPI_TOKEN non configuré" },
      { status: 500 },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      broker?: string;
      accountId?: string;
      symbol?: string;
      clearDbPending?: boolean;
    };

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const accounts = await loadMetaApiAccountsFromSupabase(supabase, {
      broker: body.broker,
      accountId: body.accountId,
    });

    if (!accounts.length) {
      return NextResponse.json(
        { error: "Aucun compte MetaAPI trouvé" },
        { status: 404 },
      );
    }

    console.log(
      `🗑️ Cancel pending orders — ${accounts.length} compte(s)`,
      accounts.map((a) => `${a.brokerName} ${a.login}`).join(", "),
    );

    const result = await cancelPendingOrdersForAccounts(
      accounts.map((a) => ({ id: a.id, brokerName: a.brokerName })),
      process.env.METAAPI_TOKEN,
      body.symbol,
    );

    let dbCleared = 0;
    if (body.clearDbPending !== false) {
      const { data: cleared } = await supabase
        .from("telegram_trades")
        .update({
          status: "cancelled",
          error_message: "Ordres pending nettoyés manuellement",
          executed_at: null,
        })
        .in("status", ["pending", "executing", "failed"])
        .select("id");
      dbCleared = cleared?.length ?? 0;
    }

    console.log(
      `✅ ${result.cancelled} ordre(s) MetaAPI annulé(s), ${dbCleared} trade(s) DB cleared`,
    );

    return NextResponse.json({
      success: true,
      ...result,
      dbCleared,
    });
  } catch (error: unknown) {
    console.error("cancel-pending-orders:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
