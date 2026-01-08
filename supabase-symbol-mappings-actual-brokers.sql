-- Mapping des symboles pour les brokers ACTUELS uniquement
-- VT Markets, Raise FX, Raise Globale, FXcess, Axi

-- Supprimer les anciens mappings si besoin (optionnel)
-- DELETE FROM symbol_mappings WHERE broker_name NOT IN ('VT Markets', 'Raise FX', 'Raise Globale', 'FXcess', 'Axi');

-- GOLD (XAU/USD)
INSERT INTO symbol_mappings (broker_name, standard_symbol, broker_symbol) VALUES
  ('VT Markets', 'GOLD', 'XAUUSD'),
  ('Raise FX', 'GOLD', 'XAUUSD'),
  ('Raise Globale', 'GOLD', 'XAUUSD'),
  ('FXcess', 'GOLD', 'XAUUSD'),
  ('Axi', 'GOLD', 'XAUUSD')
ON CONFLICT (broker_name, standard_symbol) DO UPDATE 
SET broker_symbol = EXCLUDED.broker_symbol;

-- SOL30 (Solana)
INSERT INTO symbol_mappings (broker_name, standard_symbol, broker_symbol) VALUES
  ('VT Markets', 'SOL30', 'SOL30'),
  ('Raise FX', 'SOL30', 'SOL30'),
  ('Raise Globale', 'SOL30', 'SOL30'),
  ('FXcess', 'SOL30', 'SOL30'),
  ('Axi', 'SOL30', 'SOL30')
ON CONFLICT (broker_name, standard_symbol) DO UPDATE 
SET broker_symbol = EXCLUDED.broker_symbol;

-- BTC (Bitcoin)
INSERT INTO symbol_mappings (broker_name, standard_symbol, broker_symbol) VALUES
  ('VT Markets', 'BTC', 'BTCUSD'),
  ('Raise FX', 'BTC', 'BTCUSD'),
  ('Raise Globale', 'BTC', 'BTCUSD'),
  ('FXcess', 'BTC', 'BTCUSD'),
  ('Axi', 'BTC', 'BTCUSD')
ON CONFLICT (broker_name, standard_symbol) DO UPDATE 
SET broker_symbol = EXCLUDED.broker_symbol;

-- Vérifier les mappings créés
SELECT broker_name, standard_symbol, broker_symbol 
FROM symbol_mappings 
WHERE broker_name IN ('VT Markets', 'Raise FX', 'Raise Globale', 'FXcess', 'Axi')
ORDER BY broker_name, standard_symbol;

