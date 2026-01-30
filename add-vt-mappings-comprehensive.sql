-- Script mis à jour pour VT Markets ECN avec les indices en .cash
-- Exécute ce script dans le SQL Editor de Supabase

INSERT INTO public.symbol_mappings (broker_name, standard_symbol, broker_symbol) VALUES
  -- Forex
  ('VT Markets', 'EURUSD', 'EURUSD-ECN'),
  ('VT Markets', 'GBPUSD', 'GBPUSD-ECN'),
  ('VT Markets', 'EURGBP', 'EURGBP-ECN'),
  ('VT Markets', 'EURJPY', 'EURJPY-ECN'),
  ('VT Markets', 'GBPJPY', 'GBPJPY-ECN'),
  
  -- Or
  ('VT Markets', 'GOLD', 'XAUUSD-ECN'),
  
  -- Indices (.cash obligatoire sur VT Markets)
  ('VT Markets', 'US30', 'US30.cash-ECN'),
  ('VT Markets', 'NAS100', 'NAS100.cash-ECN'),
  ('VT Markets', 'GER40', 'GER40.cash-ECN')
ON CONFLICT (broker_name, standard_symbol) DO UPDATE 
SET broker_symbol = EXCLUDED.broker_symbol;

-- Vérification
SELECT * FROM public.symbol_mappings 
WHERE broker_name = 'VT Markets' 
AND standard_symbol IN ('EURUSD', 'GBPUSD', 'EURGBP', 'EURJPY', 'GBPJPY', 'GOLD', 'US30', 'NAS100', 'GER40');
