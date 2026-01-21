-- 1. AJOUT DES COLONNES MANQUANTES
ALTER TABLE public.telegram_channels ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;
ALTER TABLE public.telegram_channels DROP CONSTRAINT IF EXISTS telegram_channels_telegram_chat_id_key;
ALTER TABLE public.telegram_channels ADD CONSTRAINT telegram_channels_telegram_chat_id_key UNIQUE (telegram_chat_id);

ALTER TABLE public.telegram_signals ADD COLUMN IF NOT EXISTS order_type VARCHAR(50) DEFAULT 'MARKET';
ALTER TABLE public.telegram_trades ADD COLUMN IF NOT EXISTS order_type VARCHAR(50) DEFAULT 'MARKET';

-- 2. CONFIGURATION DU CANAL "L’IMPRIMANTE VIP"
UPDATE public.telegram_channels
SET telegram_chat_id = -1002313602819,
    is_active = true
WHERE name ILIKE '%L’imprimante VIP%';

-- 3. VÉRIFICATION DES ABONNEMENTS (TRÈS IMPORTANT)
-- Cela affiche si des utilisateurs sont réellement abonnés à ce canal
SELECT 
    tc.name as channel_name,
    COUNT(uts.id) as nb_utilisateurs_lies
FROM telegram_channels tc
LEFT JOIN user_telegram_subscriptions uts ON tc.id = uts.channel_id
WHERE tc.telegram_chat_id = -1002313602819
GROUP BY tc.name;

-- 4. VÉRIFICATION DES COMPTES MT5
SELECT 
    u.email,
    m.broker_name,
    m.is_active,
    m.metaapi_account_id IS NOT NULL as has_metaapi
FROM mt5_accounts m
JOIN auth.users u ON u.id = m.user_id
WHERE m.is_active = true;

-- 5. VÉRIFICATION DES SIGNAUX RÉCENTS (pour voir s'ils ont été enregistrés)
SELECT id, symbol, signal_type, entry_price, parsed_at 
FROM telegram_signals 
ORDER BY parsed_at DESC 
LIMIT 5;
