/**
 * Configuration webhook Telegram (canal = channel_post obligatoire).
 * Usage: node scripts/setup-telegram-webhook-full.js
 * Env: TELEGRAM_BOT_TOKEN, NEXT_PUBLIC_APP_URL, TELEGRAM_WEBHOOK_SECRET
 */
require("dotenv").config({ path: ".env.local" });

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

const ALLOWED_UPDATES = [
  "message",
  "channel_post",
  "edited_message",
  "edited_channel_post",
];

if (!TELEGRAM_BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN manquant");
  process.exit(1);
}
if (!APP_URL) {
  console.error("❌ NEXT_PUBLIC_APP_URL manquant");
  process.exit(1);
}
if (!WEBHOOK_SECRET) {
  console.error("❌ TELEGRAM_WEBHOOK_SECRET manquant (openssl rand -hex 32)");
  process.exit(1);
}

const webhookUrl = `${APP_URL.replace(/\/$/, "")}/api/telegram/webhook`;
const api = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

async function main() {
  console.log("🔧 Webhook URL:", webhookUrl);
  console.log("📡 allowed_updates:", ALLOWED_UPDATES.join(", "));

  const setRes = await fetch(`${api}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: WEBHOOK_SECRET,
      allowed_updates: ALLOWED_UPDATES,
      drop_pending_updates: false,
    }),
  });
  const setData = await setRes.json();
  if (!setData.ok) {
    console.error("❌ setWebhook:", setData.description);
    process.exit(1);
  }
  console.log("✅ Webhook configuré:", setData.description);

  const infoRes = await fetch(`${api}/getWebhookInfo`);
  const info = await infoRes.json();
  if (info.ok) {
    const r = info.result;
    console.log("\n📋 getWebhookInfo:");
    console.log("   url:", r.url);
    console.log("   pending_update_count:", r.pending_update_count);
    console.log("   last_error_message:", r.last_error_message || "(aucune)");
    console.log("   allowed_updates:", (r.allowed_updates || []).join(", ") || "(toutes)");
    if (!r.allowed_updates?.includes("channel_post")) {
      console.warn(
        "⚠️  channel_post absent — les signaux du CANAL ne seront pas reçus!",
      );
    }
  }

  const meRes = await fetch(`${api}/getMe`);
  const me = await meRes.json();
  if (me.ok) {
    console.log("\n🤖 Bot:", me.result.username, `(id ${me.result.id})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
