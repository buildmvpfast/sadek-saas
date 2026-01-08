-- Créer la table symbol_mappings si elle n'existe pas
CREATE TABLE IF NOT EXISTS symbol_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  broker_name TEXT NOT NULL,
  standard_symbol TEXT NOT NULL,
  broker_symbol TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(broker_name, standard_symbol)
);

-- Supprimer les anciens mappings si besoin (optionnel - décommenter si tu veux nettoyer)
-- DELETE FROM symbol_mappings;

-- GOLD (XAU/USD) - Pour tous les brokers supportés
INSERT INTO symbol_mappings (broker_name, standard_symbol, broker_symbol) VALUES
  ('VT Markets', 'GOLD', 'XAUUSD'),
  ('Raise FX', 'GOLD', 'XAUUSD'),
  ('FXcess', 'GOLD', 'XAUUSD'),
  ('Axi', 'GOLD', 'XAUUSD')
ON CONFLICT (broker_name, standard_symbol) DO UPDATE 
SET broker_symbol = EXCLUDED.broker_symbol;

-- SOL30 (Solana)
INSERT INTO symbol_mappings (broker_name, standard_symbol, broker_symbol) VALUES
  ('VT Markets', 'SOL30', 'SOL30'),
  ('Raise FX', 'SOL30', 'SOL30'),
  ('FXcess', 'SOL30', 'SOL30'),
  ('Axi', 'SOL30', 'SOL30')
ON CONFLICT (broker_name, standard_symbol) DO UPDATE 
SET broker_symbol = EXCLUDED.broker_symbol;

-- BTC (Bitcoin)
INSERT INTO symbol_mappings (broker_name, standard_symbol, broker_symbol) VALUES
  ('VT Markets', 'BTC', 'BTCUSD'),
  ('Raise FX', 'BTC', 'BTCUSD'),
  ('FXcess', 'BTC', 'BTCUSD'),
  ('Axi', 'BTC', 'BTCUSD')
ON CONFLICT (broker_name, standard_symbol) DO UPDATE 
SET broker_symbol = EXCLUDED.broker_symbol;

-- Vérifier les mappings créés
SELECT 
  broker_name, 
  standard_symbol, 
  broker_symbol 
FROM symbol_mappings 
WHERE broker_name IN ('VT Markets', 'Raise FX', 'FXcess', 'Axi')
ORDER BY broker_name, standard_symbol;

-- Afficher le nombre de mappings par broker
SELECT 
  broker_name, 
  COUNT(*) as nombre_mappings
FROM symbol_mappings 
WHERE broker_name IN ('VT Markets', 'Raise FX', 'FXcess', 'Axi')
GROUP BY broker_name
ORDER BY broker_name;

