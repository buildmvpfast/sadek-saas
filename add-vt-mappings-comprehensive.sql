-- VT Markets ECN — symboles tels que dans MT5 (compte ECN).
-- Exécute dans le SQL Editor Supabase (upsert).

INSERT INTO public.symbol_mappings (broker_name, standard_symbol, broker_symbol) VALUES
  ('VT Markets', 'EURUSD', 'EURUSD-ECN'),
  ('VT Markets', 'GBPUSD', 'GBPUSD'),
  ('VT Markets', 'EURGBP', 'EURGBP-ECN'),
  ('VT Markets', 'EURJPY', 'EURJPY-ECN'),
  ('VT Markets', 'GBPJPY', 'GBPJPY-ECN'),
  ('VT Markets', 'GOLD', 'XAUUSD'),
  ('VT Markets', 'BTC', 'BTCUSD'),
  ('VT Markets', 'SOL30', 'SOL30'),
  ('VT Markets', 'US30', 'DJ30.s'),
  ('VT Markets', 'NAS100', 'NAS100.s'),
  ('VT Markets', 'GER40', 'GER40.s')
ON CONFLICT (broker_name, standard_symbol) DO UPDATE
SET broker_symbol = EXCLUDED.broker_symbol;

SELECT broker_name, standard_symbol, broker_symbol
FROM public.symbol_mappings
WHERE broker_name = 'VT Markets'
ORDER BY standard_symbol;
