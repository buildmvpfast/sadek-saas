-- Vérifier et ajouter le token pour le canal imprimbot

-- 1. Vérifier le canal
SELECT id, name, username, is_active 
FROM telegram_channels 
WHERE username = 'imprimbot';

-- 2. Vérifier si un token existe déjà
SELECT 
  tc.name as channel_name,
  tc.username,
  tbt.bot_token,
  tbt.bot_username,
  tbt.is_active
FROM telegram_channels tc
LEFT JOIN telegram_bot_tokens tbt ON tc.id = tbt.channel_id
WHERE tc.username = 'imprimbot';

-- 3. Insérer ou mettre à jour le token pour imprimbot
-- REMPLACE LE TOKEN CI-DESSOUS PAR LE BON TOKEN DU BOT
INSERT INTO telegram_bot_tokens (channel_id, bot_token, bot_username, is_active)
SELECT 
  tc.id,
  '7958247845:AAFPfntvvND10uCs7AX6UPC5Dz4a_Dc17bc', -- ⚠️ REMPLACE PAR LE BON TOKEN
  'imprimbot_bot', -- ⚠️ REMPLACE PAR LE USERNAME DU BOT
  true
FROM telegram_channels tc
WHERE tc.username = 'imprimbot'
ON CONFLICT (channel_id) DO UPDATE SET
  bot_token = EXCLUDED.bot_token,
  bot_username = EXCLUDED.bot_username,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 4. Vérifier après insertion
SELECT 
  tc.name as channel_name,
  tc.username,
  tbt.bot_username,
  tbt.is_active,
  CASE 
    WHEN tbt.bot_token IS NOT NULL THEN 'Token présent ✅'
    ELSE 'Token manquant ❌'
  END as token_status
FROM telegram_channels tc
LEFT JOIN telegram_bot_tokens tbt ON tc.id = tbt.channel_id
WHERE tc.username = 'imprimbot';

