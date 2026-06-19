-- ============================================================
-- DIAGNOSTIC COPY TRADING TELEGRAM — Supabase SQL Editor
-- Chaîne: Canal → telegram_signals → telegram_trades → MetaAPI
-- ============================================================

-- 0. Colonnes requises (all_tp manquant = signaux non enregistrés)
SELECT
  '0️⃣ COLONNES' AS check_type,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'telegram_signals'
      AND column_name = 'all_tp'
  ) AS has_all_tp,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'telegram_trades'
      AND column_name = 'order_type'
  ) AS has_trade_order_type;

-- 1. Canal + bot token actifs
SELECT
  '1️⃣ CANAL' AS check_type,
  tc.id,
  tc.name,
  tc.username,
  tc.telegram_chat_id,
  tc.is_active AS canal_actif,
  tbt.is_active AS token_actif
FROM telegram_channels tc
LEFT JOIN telegram_bot_tokens tbt ON tc.id = tbt.channel_id
WHERE tc.is_active = true;

-- 2. Signaux reçus (24h) — si 0 → webhook / parse-signal cassé
SELECT
  '2️⃣ SIGNAUX 24H' AS check_type,
  id,
  symbol,
  signal_type,
  order_type,
  entry_price,
  stop_loss,
  take_profit,
  all_tp,
  parsed_at
FROM telegram_signals
WHERE parsed_at > NOW() - INTERVAL '24 hours'
ORDER BY parsed_at DESC
LIMIT 15;

-- 3. Dernier signal → trades créés ?
SELECT
  '3️⃣ SIGNAL → TRADES' AS check_type,
  ts.id AS signal_id,
  ts.symbol,
  ts.parsed_at,
  ts.all_tp,
  tt.id AS trade_id,
  tt.status,
  tt.volume,
  tt.take_profit,
  tt.error_message,
  tt.created_at
FROM telegram_signals ts
LEFT JOIN telegram_trades tt ON tt.signal_id = ts.id
ORDER BY ts.parsed_at DESC
LIMIT 30;

-- 4. Abonnés canal Telegram
SELECT
  '4️⃣ ABONNÉS CANAL' AS check_type,
  tc.name AS canal,
  u.email,
  uts.is_active
FROM user_telegram_subscriptions uts
JOIN telegram_channels tc ON tc.id = uts.channel_id
JOIN auth.users u ON u.id = uts.user_id
WHERE uts.is_active = true;

-- 5. Éligibilité complète (Stripe + canal + MT5 MetaAPI)
SELECT
  '5️⃣ ÉLIGIBLES' AS check_type,
  u.email,
  s.status AS stripe,
  m.broker_name,
  m.metaapi_account_id IS NOT NULL AS has_metaapi,
  m.is_active AS mt5_actif,
  ts.trading_paused,
  ts.max_open_positions
FROM auth.users u
JOIN user_telegram_subscriptions uts ON uts.user_id = u.id AND uts.is_active = true
JOIN subscriptions s ON s.user_id = u.id AND s.status IN ('active', 'trialing')
LEFT JOIN mt5_accounts m ON m.user_id = u.id AND m.is_active = true
LEFT JOIN trading_settings ts ON ts.user_id = u.id;

-- 6. Compteur par statut trade (CRITIQUE)
SELECT
  '6️⃣ STATUTS TRADES' AS check_type,
  status,
  COUNT(*) AS nombre
FROM telegram_trades
GROUP BY status
ORDER BY status;

-- 7. Trades bloqués en `executing` (empêche nouvelles exécutions)
SELECT
  '7️⃣ EXECUTING BLOQUÉS' AS check_type,
  id,
  symbol,
  status,
  executed_at AS claim_time,
  error_message,
  created_at
FROM telegram_trades
WHERE status = 'executing'
ORDER BY created_at DESC;

-- 8. Pending à exécuter
SELECT
  '8️⃣ PENDING' AS check_type,
  tt.id,
  tt.symbol,
  tt.signal_type,
  tt.volume,
  tt.order_type,
  tt.created_at,
  m.broker_name,
  m.metaapi_account_id
FROM telegram_trades tt
LEFT JOIN mt5_accounts m ON m.id = tt.mt5_account_id
WHERE tt.status IN ('pending', 'pending_partial')
ORDER BY tt.created_at DESC
LIMIT 20;

-- 9. Derniers échecs (cause MetaAPI / symbole / risque)
SELECT
  '9️⃣ FAILED' AS check_type,
  tt.id,
  tt.symbol,
  tt.error_message,
  tt.created_at,
  u.email
FROM telegram_trades tt
JOIN auth.users u ON u.id = tt.user_id
WHERE tt.status = 'failed'
ORDER BY tt.created_at DESC
LIMIT 15;

-- 🔟 Résumé
SELECT
  '📊 RÉSUMÉ' AS check_type,
  (SELECT COUNT(*) FROM telegram_signals WHERE parsed_at > NOW() - INTERVAL '24 hours') AS signaux_24h,
  (SELECT COUNT(*) FROM telegram_trades WHERE status = 'pending') AS pending,
  (SELECT COUNT(*) FROM telegram_trades WHERE status = 'executing') AS executing,
  (SELECT COUNT(*) FROM telegram_trades WHERE status = 'executed' AND executed_at > NOW() - INTERVAL '24 hours') AS executed_24h,
  (SELECT COUNT(*) FROM telegram_trades WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours') AS failed_24h;

-- ============================================================
-- FIX RAPIDE (si trades bloqués en executing)
-- ============================================================
-- UPDATE telegram_trades
-- SET status = 'pending', executed_at = NULL
-- WHERE status = 'executing';

-- ============================================================
-- FIX colonne all_tp (si has_all_tp = false en étape 0)
-- Exécuter supabase-telegram-all-tp.sql
-- ============================================================
