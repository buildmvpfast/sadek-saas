-- Add MetaApi position id to telegram_trades so we can modify SL/TP later (BE, TP/SL updates)
ALTER TABLE public.telegram_trades
  ADD COLUMN IF NOT EXISTS position_id BIGINT;

