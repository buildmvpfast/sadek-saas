import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function envOk(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

async function getTelegramWebhookInfo(
  botToken: string,
): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(
      `https://api.telegram.org/bot${botToken}/getWebhookInfo`,
      { cache: "no-store" },
    );
    const j = (await r.json()) as { ok: boolean; result?: Record<string, unknown> };
    return j.ok ? (j.result ?? null) : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const env = {
    TELEGRAM_WEBHOOK_SECRET: envOk("TELEGRAM_WEBHOOK_SECRET"),
    INTERNAL_API_SECRET: envOk("INTERNAL_API_SECRET"),
    METAAPI_TOKEN: envOk("METAAPI_TOKEN"),
    NEXT_PUBLIC_APP_URL: envOk("NEXT_PUBLIC_APP_URL"),
    SUPABASE_SERVICE_ROLE_KEY: envOk("SUPABASE_SERVICE_ROLE_KEY"),
    NEXT_PUBLIC_SUPABASE_URL: envOk("NEXT_PUBLIC_SUPABASE_URL"),
    OPENAI_API_KEY: envOk("OPENAI_API_KEY"),
    TELEGRAM_BOT_TOKEN: envOk("TELEGRAM_BOT_TOKEN"),
  };

  const blockers: string[] = [];
  if (!env.TELEGRAM_WEBHOOK_SECRET) {
    blockers.push("TELEGRAM_WEBHOOK_SECRET manquant sur Vercel");
  }
  if (!env.INTERNAL_API_SECRET) {
    blockers.push("INTERNAL_API_SECRET manquant — parse-signal / execute-trades bloqués");
  }
  if (!env.METAAPI_TOKEN) {
    blockers.push("METAAPI_TOKEN manquant — exécution impossible");
  }
  if (!env.NEXT_PUBLIC_APP_URL) {
    blockers.push("NEXT_PUBLIC_APP_URL manquant — webhook ne peut pas appeler parse-signal");
  }

  let db: Record<string, unknown> = { error: "Supabase non configuré" };
  let telegramWebhook: Record<string, unknown> | null = null;

  if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [
      channelsRes,
      signalsRes,
      tradesRes,
      subsRes,
      stripeRes,
      mt5Res,
      tokenRes,
    ] = await Promise.all([
      supabase
        .from("telegram_channels")
        .select("id, name, username, telegram_chat_id, is_active")
        .eq("is_active", true),
      supabase
        .from("telegram_signals")
        .select("id", { count: "exact", head: true })
        .gte("parsed_at", since),
      supabase
        .from("telegram_trades")
        .select("status")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("user_telegram_subscriptions")
        .select("user_id, channel_id")
        .eq("is_active", true),
      supabase
        .from("subscriptions")
        .select("user_id, status")
        .in("status", ["active", "trialing"]),
      supabase
        .from("mt5_accounts")
        .select("user_id, broker_name, is_active, metaapi_account_id")
        .eq("is_active", true),
      supabase
        .from("telegram_bot_tokens")
        .select("bot_token, is_active, channel_id")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
    ]);

    const tradeRows = tradesRes.data ?? [];
    const byStatus: Record<string, number> = {};
    for (const t of tradeRows) {
      const s = String((t as { status: string }).status);
      byStatus[s] = (byStatus[s] ?? 0) + 1;
    }

    const tgUserIds = new Set(
      (subsRes.data ?? []).map((s) => (s as { user_id: string }).user_id),
    );
    const stripeOk = new Set(
      (stripeRes.data ?? []).map((s) => (s as { user_id: string }).user_id),
    );
    const mt5Rows = (mt5Res.data ?? []) as Array<{
      user_id: string;
      broker_name: string;
      metaapi_account_id: string | null;
    }>;

    const eligibleUsers = Array.from(tgUserIds).filter((uid) => {
      if (!stripeOk.has(uid)) return false;
      const acc = mt5Rows.find((m) => m.user_id === uid);
      return Boolean(acc?.metaapi_account_id);
    });

    if ((channelsRes.data ?? []).length === 0) {
      blockers.push("Aucun telegram_channels actif en base");
    }
    if ((signalsRes.count ?? 0) === 0) {
      blockers.push(
        "0 signal en 24h — webhook probablement pas reçu (vérifie channel_post + secret_token)",
      );
    }
    if (tgUserIds.size === 0) {
      blockers.push("Aucun user_telegram_subscriptions actif");
    }
    if (eligibleUsers.length === 0) {
      blockers.push(
        "0 utilisateur éligible (abonnement canal + Stripe active/trialing + MT5 metaapi_account_id)",
      );
    }

    db = {
      channelsActive: channelsRes.data?.length ?? 0,
      channels: channelsRes.data,
      signalsLast24h: signalsRes.count ?? 0,
      telegramSubscribers: tgUserIds.size,
      stripeActiveOrTrialing: stripeOk.size,
      mt5ActiveAccounts: mt5Rows.length,
      mt5WithMetaApi: mt5Rows.filter((m) => m.metaapi_account_id).length,
      eligibleUsers: eligibleUsers.length,
      eligibleUserIds: eligibleUsers,
      tradesByStatus: byStatus,
      pendingTrades: byStatus.pending ?? 0,
    };

    const botToken =
      tokenRes.data?.bot_token ?? process.env.TELEGRAM_BOT_TOKEN ?? null;
    if (typeof botToken === "string" && botToken.length > 10) {
      telegramWebhook = await getTelegramWebhookInfo(botToken);
      const allowed = (telegramWebhook?.allowed_updates as string[]) ?? [];
      if (!allowed.includes("channel_post")) {
        blockers.push(
          "Webhook Telegram: allowed_updates sans channel_post — relance scripts/setup-telegram-webhook-full.js",
        );
      }
      const expectedUrl = `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")}/api/telegram/webhook`;
      if (telegramWebhook?.url && telegramWebhook.url !== expectedUrl) {
        blockers.push(
          `Webhook URL Telegram (${telegramWebhook.url}) ≠ ${expectedUrl}`,
        );
      }
      if (telegramWebhook?.last_error_message) {
        blockers.push(
          `Telegram last_error: ${String(telegramWebhook.last_error_message)}`,
        );
      }
    } else {
      blockers.push("Pas de telegram_bot_tokens actif ni TELEGRAM_BOT_TOKEN");
    }
  }

  const ok = blockers.length === 0;

  return NextResponse.json({
    ok,
    status: ok ? "ready" : "blocked",
    blockers,
    env,
    db,
    telegramWebhook: telegramWebhook
      ? {
          url: telegramWebhook.url,
          pending_update_count: telegramWebhook.pending_update_count,
          last_error_message: telegramWebhook.last_error_message,
          allowed_updates: telegramWebhook.allowed_updates,
          has_custom_certificate: telegramWebhook.has_custom_certificate,
        }
      : null,
    flow:
      "Canal Telegram → POST /api/telegram/webhook → parse-signal → telegram_trades → execute-trades + worker Render (5s)",
    fixWebhook:
      "node scripts/setup-telegram-webhook-full.js (après TELEGRAM_BOT_TOKEN + TELEGRAM_WEBHOOK_SECRET sur Vercel)",
  });
}
