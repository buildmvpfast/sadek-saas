import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Abonne l'utilisateur à tous les canaux Telegram actifs (avec bot token actif).
 * Appelé après connexion MT5 pour que le copy trading démarre sans étape manuelle.
 */
export async function ensureUserSubscribedToActiveChannels(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data: channels, error } = await supabase
    .from("telegram_channels")
    .select(
      `
      id,
      username,
      telegram_bot_tokens!inner(is_active)
    `,
    )
    .eq("is_active", true)
    .eq("telegram_bot_tokens.is_active", true);

  if (error || !channels?.length) return 0;

  let subscribed = 0;

  for (const ch of channels) {
    const channelId = ch.id as string;
    const { data: existing } = await supabase
      .from("user_telegram_subscriptions")
      .select("id, is_active")
      .eq("user_id", userId)
      .eq("channel_id", channelId)
      .maybeSingle();

    if (existing?.id) {
      if (!existing.is_active) {
        await supabase
          .from("user_telegram_subscriptions")
          .update({ is_active: true })
          .eq("id", existing.id);
      }
      subscribed++;
      continue;
    }

    const { error: insErr } = await supabase
      .from("user_telegram_subscriptions")
      .insert({
        user_id: userId,
        channel_id: channelId,
        is_active: true,
      });

    if (!insErr) subscribed++;
  }

  return subscribed;
}
