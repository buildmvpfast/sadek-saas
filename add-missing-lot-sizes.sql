-- Colonnes trading_settings attendues par /settings (lots) + parse-signal + metaapi-position-monitor
-- Erreur typique si non exécuté : "could not find the 'audusd_lot_size' column ... in the schema cache"
-- À lancer une fois dans Supabase → SQL Editor (rôle avec droits DDL sur public.trading_settings)

ALTER TABLE public.trading_settings
  ADD COLUMN IF NOT EXISTS gold_lot_size DECIMAL(10, 2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS btc_lot_size DECIMAL(10, 2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS eth_lot_size DECIMAL(10, 2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS sol_lot_size DECIMAL(10, 2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS us30_lot_size DECIMAL(10, 2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS nas100_lot_size DECIMAL(10, 2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS ger40_lot_size DECIMAL(10, 2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS uk100_lot_size DECIMAL(10, 2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS spx500_lot_size DECIMAL(10, 2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS eurusd_lot_size DECIMAL(10, 2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS gbpusd_lot_size DECIMAL(10, 2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS usdjpy_lot_size DECIMAL(10, 2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS usdchf_lot_size DECIMAL(10, 2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS usdcad_lot_size DECIMAL(10, 2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS audusd_lot_size DECIMAL(10, 2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS nzdusd_lot_size DECIMAL(10, 2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS eurgbp_lot_size DECIMAL(10, 2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS eurjpy_lot_size DECIMAL(10, 2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS gbpjpy_lot_size DECIMAL(10, 2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS position_percentage DECIMAL(5, 2) DEFAULT 1.0;
