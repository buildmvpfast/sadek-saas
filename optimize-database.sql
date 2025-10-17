-- Script d'optimisation de la base de données Supabase
-- Exécute ce script dans Supabase SQL Editor

-- 1. Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(id);
CREATE INDEX IF NOT EXISTS idx_mt5_accounts_user_id ON public.mt5_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_mt5_accounts_is_active ON public.mt5_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_mt5_accounts_is_admin ON public.mt5_accounts(is_admin_account);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_trading_settings_user_id ON public.trading_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_copy_trades_user_id ON public.copy_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_copy_trades_created_at ON public.copy_trades(created_at);
CREATE INDEX IF NOT EXISTS idx_telegram_subscriptions_user_id ON public.user_telegram_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_subscriptions_channel_id ON public.user_telegram_subscriptions(channel_id);
CREATE INDEX IF NOT EXISTS idx_telegram_signals_channel_id ON public.telegram_signals(channel_id);
CREATE INDEX IF NOT EXISTS idx_telegram_signals_created_at ON public.telegram_signals(created_at);
CREATE INDEX IF NOT EXISTS idx_telegram_trades_user_id ON public.telegram_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_trades_signal_id ON public.telegram_trades(signal_id);

-- 2. Index composites pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_mt5_accounts_user_active ON public.mt5_accounts(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON public.subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_copy_trades_user_created ON public.copy_trades(user_id, created_at DESC);

-- 3. Optimiser les statistiques des tables
ANALYZE public.profiles;
ANALYZE public.mt5_accounts;
ANALYZE public.subscriptions;
ANALYZE public.trading_settings;
ANALYZE public.copy_trades;
ANALYZE public.telegram_channels;
ANALYZE public.user_telegram_subscriptions;
ANALYZE public.telegram_signals;
ANALYZE public.telegram_trades;

-- 4. Vérifier les index créés
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
    AND tablename IN ('profiles', 'mt5_accounts', 'subscriptions', 'trading_settings', 'copy_trades', 'telegram_channels', 'user_telegram_subscriptions', 'telegram_signals', 'telegram_trades')
ORDER BY tablename, indexname;
