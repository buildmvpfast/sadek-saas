-- Script complet pour configurer le canal imprimbot avec son token

-- 1. Vérifier que le canal existe
SELECT id, name, username, is_active 
FROM telegram_channels 
WHERE username = 'imprimbot';

-- 2. Créer la table telegram_bot_tokens si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.telegram_bot_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES public.telegram_channels(id) ON DELETE CASCADE,
  bot_token text NOT NULL,
  bot_username text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(channel_id)
);

-- 3. Activer RLS si pas déjà fait
ALTER TABLE public.telegram_bot_tokens ENABLE ROW LEVEL SECURITY;

-- 4. Policy pour permettre au service role de lire (nécessaire pour le webhook)
DROP POLICY IF EXISTS "Service role can read tokens" ON public.telegram_bot_tokens;
CREATE POLICY "Service role can read tokens" ON public.telegram_bot_tokens
  FOR SELECT USING (true); -- Le service role bypass RLS de toute façon

-- 5. Insérer ou mettre à jour le token pour imprimbot
INSERT INTO telegram_bot_tokens (channel_id, bot_token, bot_username, is_active)
SELECT 
  tc.id,
  '7958247845:AAFPfntvvND10uCs7AX6UPC5Dz4a_Dc17bc',
  'imprimbot_bot',
  true
FROM telegram_channels tc
WHERE tc.username = 'imprimbot'
ON CONFLICT (channel_id) DO UPDATE SET
  bot_token = EXCLUDED.bot_token,
  bot_username = EXCLUDED.bot_username,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 6. Vérifier la configuration finale
SELECT 
  tc.id as channel_id,
  tc.name as channel_name,
  tc.username as channel_username,
  tc.is_active as channel_active,
  tbt.bot_username,
  tbt.is_active as token_active,
  CASE 
    WHEN tbt.bot_token IS NOT NULL THEN '✅ Token configuré'
    ELSE '❌ Token manquant'
  END as status
FROM telegram_channels tc
LEFT JOIN telegram_bot_tokens tbt ON tc.id = tbt.channel_id
WHERE tc.username = 'imprimbot';

