import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Validates that a request comes from an internal caller (cron, server-to-server).
 * Callers must pass `Authorization: Bearer <INTERNAL_API_SECRET>`.
 */
export function requireInternalSecret(
  req: NextRequest,
): NextResponse | null {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    console.error("INTERNAL_API_SECRET is not configured");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 },
    );
  }
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** INTERNAL_API_SECRET ou TELEGRAM_WEBHOOK_SECRET (header Telegram). */
export function requireInternalOrWebhookSecret(
  req: NextRequest,
): NextResponse | null {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const tgHeader = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (webhookSecret && tgHeader === webhookSecret) {
    return null;
  }
  return requireInternalSecret(req);
}
