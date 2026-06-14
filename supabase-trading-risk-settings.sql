-- Risque, ECN/STP, fermetures partielles — à exécuter une fois dans Supabase SQL Editor

ALTER TABLE public.trading_settings
  ADD COLUMN IF NOT EXISTS max_lot_size DECIMAL(10, 2) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS lot_multiplier DECIMAL(10, 4) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS equity_risk_percent DECIMAL(10, 4) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS max_daily_loss DECIMAL(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_weekly_loss DECIMAL(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_spread_points DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_slippage_points DECIMAL(10, 2) DEFAULT 30,
  ADD COLUMN IF NOT EXISTS trading_paused BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trading_paused_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS allowed_symbols TEXT,
  ADD COLUMN IF NOT EXISTS blocked_symbols TEXT,
  ADD COLUMN IF NOT EXISTS daily_equity_snapshot DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS daily_equity_snapshot_date DATE,
  ADD COLUMN IF NOT EXISTS weekly_equity_snapshot DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS weekly_equity_snapshot_week DATE;

ALTER TABLE public.mt5_accounts
  ADD COLUMN IF NOT EXISTS symbol_profile TEXT DEFAULT 'auto'
    CHECK (symbol_profile IN ('auto', 'ecn', 'stp'));

ALTER TABLE public.telegram_trades
  ADD COLUMN IF NOT EXISTS partial_close_percent DECIMAL(5, 2);

COMMENT ON COLUMN public.trading_settings.max_daily_loss IS '0 = désactivé. Perte max vs equity snapshot jour (devise compte).';
COMMENT ON COLUMN public.trading_settings.allowed_symbols IS 'CSV symboles standard ex: GOLD,EURUSD. Vide = tous autorisés.';
COMMENT ON COLUMN public.mt5_accounts.symbol_profile IS 'auto tente ECN puis STP via symboles MetaAPI du compte.';
