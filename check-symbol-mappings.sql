-- Vérifier les mappings existants
SELECT 
  broker_name, 
  standard_symbol, 
  broker_symbol,
  created_at
FROM symbol_mappings 
ORDER BY broker_name, standard_symbol;

-- Vérifier les brokers dans mt5_accounts
SELECT DISTINCT broker_name, COUNT(*) as compte_count
FROM mt5_accounts 
WHERE broker_name IS NOT NULL
GROUP BY broker_name
ORDER BY broker_name;

-- Vérifier si la table symbol_mappings existe
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'symbol_mappings';

