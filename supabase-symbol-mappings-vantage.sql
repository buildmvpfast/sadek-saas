-- Vantage Markets — mappings uniquement (n’efface aucun broker existant)
-- À exécuter dans le SQL Editor Supabase après la table symbol_mappings.
-- broker_name côté app / comptes MT5 : exactement "Vantage"

INSERT INTO symbol_mappings (broker_name, standard_symbol, broker_symbol) VALUES
  ('Vantage', 'GOLD', 'XAUUSD+'),
  ('Vantage', 'BTC', 'BTCUSD'),
  ('Vantage', 'EURUSD', 'EURUSD+'),
  ('Vantage', 'GBPUSD', 'GBPUSD+'),
  ('Vantage', 'USDJPY', 'USDJPY+'),
  ('Vantage', 'US30', 'DJ30'),
  ('Vantage', 'NAS100', 'NAS100'),
  ('Vantage', 'GER40', 'GER40'),
  ('Vantage', 'SOL30', 'SOL30')
ON CONFLICT (broker_name, standard_symbol) DO UPDATE
SET broker_symbol = EXCLUDED.broker_symbol;
