-- Table pour stocker les tokens Telegram des canaux
-- Exécute ce script dans Supabase SQL Editor

-- Créer la table telegram_bot_tokens
CREATE TABLE IF NOT EXISTS public.telegram_bot_tokens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id uuid REFERENCES public.telegram_channels(id) ON DELETE CASCADE,
  bot_token text NOT NULL,
  bot_username text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(channel_id)
);

-- Activer RLS
ALTER TABLE public.telegram_bot_tokens ENABLE ROW LEVEL SECURITY;

-- Politiques RLS (seuls les admins peuvent voir/modifier les tokens)
CREATE POLICY "Admins can view telegram_bot_tokens" ON public.telegram_bot_tokens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert telegram_bot_tokens" ON public.telegram_bot_tokens
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update telegram_bot_tokens" ON public.telegram_bot_tokens
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete telegram_bot_tokens" ON public.telegram_bot_tokens
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Insérer le token pour L'IMPRIMANTE
INSERT INTO public.telegram_bot_tokens (channel_id, bot_token, bot_username, is_active)
SELECT 
  tc.id,
  '8496815756:AAEFOf60xHTGEWlXWtzgSIMwNJzwDhCra4M',
  'limprimante_bot',
  true
FROM public.telegram_channels tc
WHERE tc.username = 'limprimante'
ON CONFLICT (channel_id) DO UPDATE SET
  bot_token = EXCLUDED.bot_token,
  bot_username = EXCLUDED.bot_username,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Vérifier l'insertion
SELECT 
  tc.name as channel_name,
  tc.username,
  tbt.bot_username,
  tbt.is_active
FROM public.telegram_channels tc
LEFT JOIN public.telegram_bot_tokens tbt ON tc.id = tbt.channel_id
WHERE tc.username = 'limprimante';
