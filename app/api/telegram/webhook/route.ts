import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log(
      "📥 Webhook Telegram reçu:",
      JSON.stringify(body).substring(0, 500)
    );

    // Telegram peut envoyer: message, channel_post, edited_message, edited_channel_post
    let message =
      body.message ||
      body.channel_post ||
      body.edited_message ||
      body.edited_channel_post;

    if (!message) {
      console.log(
        "⚠️ Pas de message dans le webhook. Body keys:",
        Object.keys(body)
      );
      return NextResponse.json({ ok: true });
    }

    const chat = message.chat;
    const text = message.text || message.caption; // caption pour les messages avec photos

    console.log(
      `📨 Message reçu - Chat type: ${chat?.type}, Username: ${
        chat?.username
      }, Title: ${chat?.title}, Text: ${text?.substring(0, 50)}`
    );

    // Vérifier que c'est un canal (pas un chat privé)
    if (!chat || chat.type !== "channel") {
      console.log(`⚠️ Ce n'est pas un canal (type: ${chat?.type}), ignoré`);
      return NextResponse.json({ ok: true });
    }

    // Extraire le nom d'utilisateur du canal
    const channelUsername = chat.username || chat.title;

    if (!channelUsername || !text) {
      console.log(
        `⚠️ Pas de username ou texte: username=${channelUsername}, text=${
          text ? "présent" : "absent"
        }`
      );
      return NextResponse.json({ ok: true });
    }

    console.log(
      `✅ Canal détecté: ${channelUsername}, Message: ${text.substring(0, 100)}`
    );

    // Vérifier si c'est un canal configuré AVEC un token actif
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Chercher le canal avec un token configuré et actif
    const { data: channel } = await supabase
      .from("telegram_channels")
      .select(
        `
        id, 
        username, 
        name,
        telegram_bot_tokens!inner(bot_token, is_active)
      `
      )
      .or(`username.eq.${channelUsername},name.ilike.%${channelUsername}%`)
      .eq("telegram_bot_tokens.is_active", true)
      .eq("is_active", true)
      .single();

    if (!channel) {
      console.log(
        `❌ Canal non configuré ou sans token actif: ${channelUsername}`
      );
      return NextResponse.json({ ok: true });
    }

    console.log(`✅ Canal trouvé: ${channel.name} (${channel.username})`);

    // Envoyer le message à l'API de parsing
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const response = await fetch(`${baseUrl}/api/telegram/parse-signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelUsername: channel.username,
          messageText: text,
          messageId: message.message_id,
        }),
      });

      const responseText = await response.text();
      console.log(
        `✅ Signal envoyé au parser pour ${channel.name}:`,
        responseText.substring(0, 200)
      );
    } catch (error) {
      console.error("❌ Erreur lors de l'envoi au parser:", error);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}
