
-- Migration to add US30 lot size to trading settings
ALTER TABLE public.trading_settings 
ADD COLUMN IF NOT EXISTS us30_lot_size DECIMAL(10, 2) DEFAULT 0.01;

-- Add US30 mapping for VT Markets ECN (symbole MT5 : DJ30.s)
INSERT INTO public.symbol_mappings (broker_name, standard_symbol, broker_symbol)
VALUES ('VT Markets', 'US30', 'DJ30.s')
ON CONFLICT (broker_name, standard_symbol) DO UPDATE
SET broker_symbol = EXCLUDED.broker_symbol;
