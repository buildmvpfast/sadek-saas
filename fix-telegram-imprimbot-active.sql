-- Bot actif vérifié le 2025-06 : @ImprimBot (admin canal L'IMPRIMANTE)
-- Token : celui de fix-imprimbot-complete.sql (7958247845…)
-- NE PAS utiliser impriMT5bot ni le token AAGn (révoqué)

UPDATE public.telegram_channels
SET
  telegram_chat_id = -1002313602819,
  is_active = true
WHERE name ILIKE '%imprimante%'
   OR username ILIKE '%imprimante%';

INSERT INTO public.telegram_bot_tokens (channel_id, bot_token, bot_username, is_active)
SELECT
  tc.id,
  '7958247845:AAFPfntvvND10uCs7AX6UPC5Dz4a_Dc17bc',
  'ImprimBot',
  true
FROM public.telegram_channels tc
WHERE tc.is_active = true
  AND (tc.name ILIKE '%imprimante%' OR tc.username ILIKE '%imprimante%')
ON CONFLICT (channel_id) DO UPDATE SET
  bot_token = EXCLUDED.bot_token,
  bot_username = EXCLUDED.bot_username,
  is_active = true,
  updated_at = NOW();

SELECT
  tc.name,
  tc.username,
  tc.telegram_chat_id,
  tc.is_active AS canal_actif,
  tbt.bot_username,
  tbt.is_active AS token_actif,
  CASE
    WHEN tbt.bot_username = 'ImprimBot' THEN '✅ Bon bot'
    ELSE '❌ Mauvais bot — doit être ImprimBot'
  END AS verification
FROM public.telegram_channels tc
LEFT JOIN public.telegram_bot_tokens tbt ON tc.id = tbt.channel_id
WHERE tc.is_active = true;
