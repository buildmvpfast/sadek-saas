-- Add missing lot_size columns for all instruments
ALTER TABLE trading_settings
  ADD COLUMN IF NOT EXISTS nas100_lot_size DECIMAL(10,2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS ger40_lot_size DECIMAL(10,2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS eurusd_lot_size DECIMAL(10,2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS gbpusd_lot_size DECIMAL(10,2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS eurgbp_lot_size DECIMAL(10,2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS eurjpy_lot_size DECIMAL(10,2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS gbpjpy_lot_size DECIMAL(10,2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS usdjpy_lot_size DECIMAL(10,2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS usdchf_lot_size DECIMAL(10,2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS usdcad_lot_size DECIMAL(10,2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS audusd_lot_size DECIMAL(10,2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS nzdusd_lot_size DECIMAL(10,2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS eth_lot_size DECIMAL(10,2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS uk100_lot_size DECIMAL(10,2) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS spx500_lot_size DECIMAL(10,2) DEFAULT 0.01;

-- Update existing rows to set defaults
UPDATE trading_settings SET
  nas100_lot_size = COALESCE(nas100_lot_size, 0.01),
  ger40_lot_size = COALESCE(ger40_lot_size, 0.01),
  eurusd_lot_size = COALESCE(eurusd_lot_size, 0.01),
  gbpusd_lot_size = COALESCE(gbpusd_lot_size, 0.01),
  eurgbp_lot_size = COALESCE(eurgbp_lot_size, 0.01),
  eurjpy_lot_size = COALESCE(eurjpy_lot_size, 0.01),
  gbpjpy_lot_size = COALESCE(gbpjpy_lot_size, 0.01),
  usdjpy_lot_size = COALESCE(usdjpy_lot_size, 0.01),
  usdchf_lot_size = COALESCE(usdchf_lot_size, 0.01),
  usdcad_lot_size = COALESCE(usdcad_lot_size, 0.01),
  audusd_lot_size = COALESCE(audusd_lot_size, 0.01),
  nzdusd_lot_size = COALESCE(nzdusd_lot_size, 0.01),
  eth_lot_size = COALESCE(eth_lot_size, 0.01),
  uk100_lot_size = COALESCE(uk100_lot_size, 0.01),
  spx500_lot_size = COALESCE(spx500_lot_size, 0.01);
