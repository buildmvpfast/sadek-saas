-- Script pour configurer le canal de test
-- Exécute ce script dans Supabase SQL Editor

-- 1. Créer ou mettre à jour le canal de test
INSERT INTO telegram_channels (name, username, description, is_active)
VALUES ('Test Channel', 'testchannel', 'Canal de test pour développement', true)
ON CONFLICT (username) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = true,
  updated_at = NOW();

-- 2. Ajouter le token pour le canal de test
INSERT INTO telegram_bot_tokens (channel_id, bot_token, bot_username, is_active)
SELECT 
  id,
  '8496815756:AAGnDGVRcoA7JmTOz5N3HLJKD_YgmsmnuXI',
  'test_bot',
  true
FROM telegram_channels
WHERE username = 'testchannel'
ON CONFLICT (channel_id) DO UPDATE SET
  bot_token = EXCLUDED.bot_token,
  bot_username = EXCLUDED.bot_username,
  is_active = true,
  updated_at = NOW();

-- 3. Vérifier la configuration
SELECT 
  tc.name,
  tc.username,
  tc.is_active as canal_actif,
  tbt.bot_username,
  tbt.is_active as token_actif
FROM telegram_channels tc
LEFT JOIN telegram_bot_tokens tbt ON tc.id = tbt.channel_id
WHERE tc.username = 'testchannel';

