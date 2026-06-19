/**
 * Simule un signal Telegram SANS poster dans le canal.
 *
 * Usage:
 *   npx tsx scripts/simulate-telegram-signal.ts
 *   npx tsx scripts/simulate-telegram-signal.ts --dry-run
 *   MESSAGE="Buy gold 4160 TP1 4180 TP2 4200 SL 4150" npx tsx scripts/simulate-telegram-signal.ts
 *
 * Prérequis (.env.local):
 *   INTERNAL_API_SECRET, NEXT_PUBLIC_APP_URL
 *   Optionnel: TELEGRAM_CHANNEL_ID (UUID Supabase) ou TELEGRAM_CHANNEL_USERNAME
 */
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const DEFAULT_MESSAGE = `🟢 Imprimante Trading • LONG GOLD (XAUUSD)

Entrée 🏦: 4160
TP1 💸: 4180
TP2 💸💸: 4200
SL ✂️: 4150

Risque : 1% max`;

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const viaWebhook = process.argv.includes("--webhook");

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const secret = process.env.INTERNAL_API_SECRET;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  const messageText = process.env.MESSAGE || DEFAULT_MESSAGE;
  const messageId = Math.floor(Date.now() / 1000);

  if (viaWebhook) {
    if (!webhookSecret) {
      console.error("❌ TELEGRAM_WEBHOOK_SECRET manquant dans .env.local");
      process.exit(1);
    }

    const chatId = Number(process.env.TELEGRAM_CHAT_ID || -1002313602819);
    const payload = {
      update_id: messageId,
      channel_post: {
        message_id: messageId,
        chat: {
          id: chatId,
          title: "L'imprimante VIP",
          type: "channel",
        },
        date: Math.floor(Date.now() / 1000),
        text: messageText,
      },
    };

    console.log("📡 Mode webhook (simule Telegram → webhook → parse-signal)");
    console.log(`   URL: ${baseUrl}/api/telegram/webhook`);
    console.log(`   message_id: ${messageId}`);

    if (dryRun) {
      console.log("\n--- payload ---\n", JSON.stringify(payload, null, 2));
      return;
    }

    const webhookRes = await fetch(`${baseUrl}/api/telegram/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": webhookSecret,
      },
      body: JSON.stringify(payload),
    });

    const body = await webhookRes.text();
    console.log(`\n✅ Webhook HTTP ${webhookRes.status}:`, body.slice(0, 300));
    if (!webhookRes.ok) process.exit(1);
    return;
  }

  if (!secret) {
    console.error("❌ INTERNAL_API_SECRET manquant dans .env.local");
    process.exit(1);
  }

  const channelId = process.env.TELEGRAM_CHANNEL_ID;
  const channelUsername =
    process.env.TELEGRAM_CHANNEL_USERNAME || "ImprimBot";

  const payload = {
    ...(channelId ? { channelId } : { channelUsername }),
    messageText,
    messageId,
  };

  console.log("🚀 Mode direct (parse-signal, sans Telegram)");
  console.log(`   URL: ${baseUrl}/api/telegram/parse-signal`);
  console.log(`   canal: ${channelId || channelUsername}`);
  console.log(`   message_id: ${messageId}`);
  console.log(`   texte: ${messageText.split("\n")[0]}…`);

  if (dryRun) {
    console.log("\n--- payload ---\n", JSON.stringify(payload, null, 2));
    console.log(
      "\ncurl:",
      `curl -X POST '${baseUrl}/api/telegram/parse-signal'`,
      `-H 'Content-Type: application/json'`,
      `-H 'Authorization: Bearer ${secret.slice(0, 6)}…'`,
      `-d '${JSON.stringify(payload)}'`,
    );
    return;
  }

  const res = await fetch(`${baseUrl}/api/telegram/parse-signal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await res.text();
  console.log(`\n✅ parse-signal HTTP ${res.status}:`, body);

  if (!res.ok) {
    process.exit(1);
  }

  console.log("\n--- suite ---");
  console.log("1. Vérifie telegram_signals + telegram_trades dans Supabase");
  console.log("2. execute-trades est déclenché auto par parse-signal");
  console.log(
    "3. Ou force: curl -X POST",
    `${baseUrl}/api/telegram/execute-trades`,
    `-H 'Authorization: Bearer $INTERNAL_API_SECRET'`,
  );
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
