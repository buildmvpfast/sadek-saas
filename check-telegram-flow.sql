-- Script de vérification complète du flow Telegram
-- Exécute ce script dans Supabase SQL Editor

-- 1. Vérifier le canal configuré
SELECT 
  '1️⃣ CANAL TELEGRAM' as check_type,
  tc.name,
  tc.username,
  tc.is_active as canal_actif,
  tbt.is_active as token_actif
FROM telegram_channels tc
LEFT JOIN telegram_bot_tokens tbt ON tc.id = tbt.channel_id
WHERE tc.is_active = true;

-- 2. Vérifier les signaux reçus (10 derniers)
SELECT 
  '2️⃣ SIGNAUX REÇUS' as check_type,
  id,
  signal_type,
  symbol,
  entry_price,
  stop_loss,
  take_profit,
  parsed_at
FROM telegram_signals
ORDER BY parsed_at DESC
LIMIT 10;

-- 3. Vérifier les abonnements utilisateurs
SELECT 
  '3️⃣ ABONNEMENTS UTILISATEURS' as check_type,
  COUNT(DISTINCT uts.user_id) as nb_utilisateurs_abonnes,
  COUNT(*) as nb_abonnements
FROM user_telegram_subscriptions uts
WHERE uts.is_active = true;

-- 4. Vérifier les utilisateurs avec abonnement Stripe actif ET abonné au canal
SELECT 
  '4️⃣ UTILISATEURS ÉLIGIBLES' as check_type,
  COUNT(DISTINCT s.user_id) as nb_users_avec_abonnement_actif
FROM subscriptions s
WHERE s.status = 'active'
AND EXISTS (
  SELECT 1 
  FROM user_telegram_subscriptions uts 
  WHERE uts.user_id = s.user_id 
  AND uts.is_active = true
);

-- 5. Vérifier les comptes MT5 actifs pour les utilisateurs éligibles
SELECT 
  '5️⃣ COMPTES MT5 ACTIFS' as check_type,
  COUNT(*) as nb_comptes_actifs,
  COUNT(CASE WHEN metaapi_account_id IS NOT NULL THEN 1 END) as nb_avec_metaapi_id
FROM mt5_accounts m
WHERE m.is_active = true
AND EXISTS (
  SELECT 1 
  FROM subscriptions s 
  WHERE s.user_id = m.user_id 
  AND s.status = 'active'
)
AND EXISTS (
  SELECT 1 
  FROM user_telegram_subscriptions uts 
  WHERE uts.user_id = m.user_id 
  AND uts.is_active = true
);

-- 6. Vérifier les trades créés
SELECT 
  '6️⃣ TRADES CRÉÉS' as check_type,
  status,
  COUNT(*) as nombre
FROM telegram_trades
GROUP BY status
ORDER BY status;

-- 7. Détail des trades en attente
SELECT 
  '7️⃣ TRADES EN ATTENTE (DÉTAIL)' as check_type,
  tt.id,
  tt.symbol,
  tt.signal_type,
  tt.volume,
  tt.status,
  tt.created_at,
  m.broker_name,
  m.metaapi_account_id IS NOT NULL as a_metaapi_id
FROM telegram_trades tt
LEFT JOIN mt5_accounts m ON m.id = tt.mt5_account_id
WHERE tt.status = 'pending'
ORDER BY tt.created_at DESC
LIMIT 20;

-- 8. Résumé complet
SELECT 
  '📊 RÉSUMÉ' as check_type,
  (SELECT COUNT(*) FROM telegram_channels WHERE is_active = true) as canaux_actifs,
  (SELECT COUNT(*) FROM telegram_signals) as signaux_totaux,
  (SELECT COUNT(*) FROM telegram_signals WHERE parsed_at > NOW() - INTERVAL '24 hours') as signaux_24h,
  (SELECT COUNT(DISTINCT user_id) FROM user_telegram_subscriptions WHERE is_active = true) as users_abonnes,
  (SELECT COUNT(*) FROM telegram_trades WHERE status = 'pending') as trades_pending,
  (SELECT COUNT(*) FROM telegram_trades WHERE status = 'executed') as trades_executed,
  (SELECT COUNT(*) FROM telegram_trades WHERE status = 'failed') as trades_failed;

