/**
 * Vérifie validité token(s) Telegram + webhook + canal.
 * Usage: node scripts/verify-telegram-connection.js [TOKEN_OPTIONAL]
 */
require("dotenv").config({ path: ".env.local" });

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://sadek-saas.vercel.app";

const CANDIDATE_TOKENS = [
  process.env.TELEGRAM_BOT_TOKEN,
  // Tokens historiques repo — testés pour trouver le bon actif
  "8496815756:AAEFOf60xHTGEWlXWtzgSIMwNJzwDhCra4M",
  "8496815756:AAGnDGVRcoA7JmTOz5N3HLJKD_YgmsmnuXI",
  "7958247845:AAFPfntvvND10uCs7AX6UPC5Dz4a_Dc17bc",
].filter(Boolean);

function maskToken(t) {
  if (!t || t.length < 12) return "(invalid)";
  const [id, secret] = t.split(":");
  return `${id}:${secret.slice(0, 4)}…${secret.slice(-4)}`;
}

async function tgApi(token, method) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`);
  return r.json();
}

async function verifyToken(token) {
  const me = await tgApi(token, "getMe");
  if (!me.ok) {
    return { valid: false, error: me.description };
  }

  const info = await tgApi(token, "getWebhookInfo");
  const webhook = info.ok ? info.result : null;

  let channelMember = null;
  // Canal L'IMPRIMANTE VIP (chat_id from fix-telegram-flow.sql)
  const chatId = -1002313602819;
  const member = await tgApi(
    token,
    `getChatMember?chat_id=${chatId}&user_id=${me.result.id}`,
  );
  if (member.ok) {
    channelMember = member.result.status;
  } else {
    channelMember = `error: ${member.description}`;
  }

  const allowed = webhook?.allowed_updates ?? [];
  const receivesAllUpdates = allowed.length === 0;
  const hasChannelPost =
    receivesAllUpdates || allowed.includes("channel_post");
  const issues = [];
  if (!webhook?.url) issues.push("webhook URL non configurée");
  if (webhook?.url && !webhook.url.includes("/api/telegram/webhook")) {
    issues.push(`webhook URL inattendue: ${webhook.url}`);
  }
  if (webhook?.url && APP_URL && !webhook.url.startsWith(APP_URL.replace(/\/$/, ""))) {
    issues.push(`webhook ≠ APP_URL (${APP_URL})`);
  }
  if (!hasChannelPost) {
    issues.push("allowed_updates sans channel_post — signaux canal ignorés");
  }
  if (webhook?.last_error_message) {
    issues.push(`last_error: ${webhook.last_error_message}`);
  }
  if (
    typeof channelMember === "string" &&
    channelMember.startsWith("error:")
  ) {
    issues.push(`bot pas dans le canal: ${channelMember}`);
  } else if (
    channelMember &&
    !["administrator", "creator"].includes(channelMember)
  ) {
    issues.push(`bot dans canal mais status=${channelMember} (admin requis)`);
  }

  return {
    valid: true,
    bot: {
      id: me.result.id,
      username: me.result.username,
      name: me.result.first_name,
    },
    webhook: webhook
      ? {
          url: webhook.url,
          pending_update_count: webhook.pending_update_count,
          last_error_message: webhook.last_error_message,
          allowed_updates: allowed,
          has_secret_token: Boolean(webhook.has_custom_certificate),
        }
      : null,
    channelMember,
    issues,
  };
}

async function main() {
  const seen = new Set();
  const results = [];

  for (const token of CANDIDATE_TOKENS) {
    const key = token.split(":")[0];
    if (seen.has(key)) continue;
    seen.add(key);

    console.log(`\n── Token ${maskToken(token)} ──`);
    const r = await verifyToken(token);
    if (!r.valid) {
      console.log("❌ INVALIDE:", r.error);
      results.push({ token: maskToken(token), valid: false, error: r.error });
      continue;
    }
    console.log(`✅ Bot valide: @${r.bot.username} (${r.bot.name})`);
    console.log("   Webhook:", r.webhook?.url || "(aucun)");
    console.log("   allowed_updates:", (r.webhook?.allowed_updates || []).join(", ") || "(toutes)");
    console.log("   pending:", r.webhook?.pending_update_count ?? "?");
    console.log("   last_error:", r.webhook?.last_error_message || "(aucune)");
    console.log("   Canal L'IMPRIMANTE:", r.channelMember);
    if (r.issues.length) {
      console.log("   ⚠️ Problèmes:");
      r.issues.forEach((i) => console.log("      -", i));
    } else {
      console.log("   ✅ Connexion OK");
    }
    results.push({ token: maskToken(token), valid: true, bot: r.bot.username, issues: r.issues });
  }

  const valid = results.filter((r) => r.valid);
  console.log("\n══════════════════════════════════════");
  if (valid.length === 0) {
    console.log("❌ Aucun token valide trouvé — régénère via @BotFather");
    process.exit(1);
  }
  const best =
    valid.find((r) => r.issues?.length === 0) ||
    valid.sort((a, b) => (a.issues?.length ?? 99) - (b.issues?.length ?? 99))[0];
  console.log(`Bot actif sur le canal: cherche @ImprimBot`);
  console.log(`Token vérifié: ${best.token} (@${best.bot})`);
  if (best.issues?.length) {
    console.log("→ Lance: node scripts/setup-telegram-webhook-full.js");
    console.log("  avec TELEGRAM_BOT_TOKEN=<token valide> sur Vercel + Supabase");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
