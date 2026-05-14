-- Ajustements broker (héritages .cash / mauvais suffixes) + VT Markets ECN (noms MT5 réels).

-- VT Markets ECN — aligné sur les symboles affichés dans MT5
UPDATE public.symbol_mappings
SET broker_symbol = 'DJ30.s'
WHERE broker_name = 'VT Markets' AND standard_symbol = 'US30';

UPDATE public.symbol_mappings
SET broker_symbol = 'NAS100.s'
WHERE broker_name = 'VT Markets' AND standard_symbol = 'NAS100';

UPDATE public.symbol_mappings
SET broker_symbol = 'GER40.s'
WHERE broker_name = 'VT Markets' AND standard_symbol = 'GER40';

UPDATE public.symbol_mappings
SET broker_symbol = 'GBPUSD'
WHERE broker_name = 'VT Markets' AND standard_symbol = 'GBPUSD';

UPDATE public.symbol_mappings
SET broker_symbol = 'EURJPY-ECN'
WHERE broker_name = 'VT Markets' AND standard_symbol = 'EURJPY';

UPDATE public.symbol_mappings
SET broker_symbol = 'BTCUSD'
WHERE broker_name = 'VT Markets' AND standard_symbol = 'BTC';

-- Anciens mappings « .cash » encore en base
UPDATE public.symbol_mappings
SET broker_symbol = 'DJ30.s'
WHERE broker_name = 'VT Markets'
  AND standard_symbol = 'US30'
  AND broker_symbol ILIKE '%cash%';

-- Autres brokers : retirer US30.cash si encore présent
UPDATE public.symbol_mappings
SET broker_symbol = 'DJ30'
WHERE standard_symbol = 'US30'
  AND broker_symbol ILIKE '%cash%'
  AND broker_name <> 'VT Markets';

-- GOLD : suffixes + souvent inconnus sur MT5
UPDATE public.symbol_mappings
SET broker_symbol = 'XAUUSD'
WHERE standard_symbol = 'GOLD'
  AND broker_symbol IN ('XAUUSD+', 'XAUUSD-ECN');
