-- Créer la table symbol_mappings si elle n'existe pas
CREATE TABLE IF NOT EXISTS symbol_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  broker_name TEXT NOT NULL,
  standard_symbol TEXT NOT NULL,
  broker_symbol TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(broker_name, standard_symbol)
);

-- Activer RLS
ALTER TABLE symbol_mappings ENABLE ROW LEVEL SECURITY;

-- Policy: Tout le monde peut lire les mappings
DROP POLICY IF EXISTS "Everyone can view symbol mappings" ON symbol_mappings;
CREATE POLICY "Everyone can view symbol mappings" ON symbol_mappings
  FOR SELECT USING (true);

-- Policy: Seul le service role peut modifier (via service_role_key)
DROP POLICY IF EXISTS "Only service role can modify symbol mappings" ON symbol_mappings;
CREATE POLICY "Only service role can modify symbol mappings" ON symbol_mappings
  FOR ALL USING (false);

-- GOLD (XAU/USD) - Mapping pour tous les brokers supportés
INSERT INTO symbol_mappings (broker_name, standard_symbol, broker_symbol) VALUES
  ('VT Markets', 'GOLD', 'XAUUSD'),
  ('Raise FX', 'GOLD', 'XAUUSD'),
  ('Raise Global', 'GOLD', 'XAUUSD'),
  ('Raise Globale', 'GOLD', 'XAUUSD'),
  ('FXcess', 'GOLD', 'XAUUSD'),
  ('Axi', 'GOLD', 'XAUUSD')
ON CONFLICT (broker_name, standard_symbol) DO UPDATE 
SET broker_symbol = EXCLUDED.broker_symbol;

-- SOL30 (Solana)
INSERT INTO symbol_mappings (broker_name, standard_symbol, broker_symbol) VALUES
  ('VT Markets', 'SOL30', 'SOL30'),
  ('Raise FX', 'SOL30', 'SOL30'),
  ('Raise Global', 'SOL30', 'SOL30'),
  ('Raise Globale', 'SOL30', 'SOL30'),
  ('FXcess', 'SOL30', 'SOL30'),
  ('Axi', 'SOL30', 'SOL30')
ON CONFLICT (broker_name, standard_symbol) DO UPDATE 
SET broker_symbol = EXCLUDED.broker_symbol;

-- BTC (Bitcoin)
INSERT INTO symbol_mappings (broker_name, standard_symbol, broker_symbol) VALUES
  ('VT Markets', 'BTC', 'BTCUSD'),
  ('Raise FX', 'BTC', 'BTCUSD'),
  ('Raise Global', 'BTC', 'BTCUSD'),
  ('Raise Globale', 'BTC', 'BTCUSD'),
  ('FXcess', 'BTC', 'BTCUSD'),
  ('Axi', 'BTC', 'BTCUSD')
ON CONFLICT (broker_name, standard_symbol) DO UPDATE 
SET broker_symbol = EXCLUDED.broker_symbol;

-- EURUSD (Forex - généralement identique partout)
INSERT INTO symbol_mappings (broker_name, standard_symbol, broker_symbol) VALUES
  ('VT Markets', 'EURUSD', 'EURUSD'),
  ('Raise FX', 'EURUSD', 'EURUSD'),
  ('Raise Global', 'EURUSD', 'EURUSD'),
  ('Raise Globale', 'EURUSD', 'EURUSD'),
  ('FXcess', 'EURUSD', 'EURUSD'),
  ('Axi', 'EURUSD', 'EURUSD')
ON CONFLICT (broker_name, standard_symbol) DO UPDATE 
SET broker_symbol = EXCLUDED.broker_symbol;

-- GBPUSD (Forex)
INSERT INTO symbol_mappings (broker_name, standard_symbol, broker_symbol) VALUES
  ('VT Markets', 'GBPUSD', 'GBPUSD'),
  ('Raise FX', 'GBPUSD', 'GBPUSD'),
  ('Raise Global', 'GBPUSD', 'GBPUSD'),
  ('Raise Globale', 'GBPUSD', 'GBPUSD'),
  ('FXcess', 'GBPUSD', 'GBPUSD'),
  ('Axi', 'GBPUSD', 'GBPUSD')
ON CONFLICT (broker_name, standard_symbol) DO UPDATE 
SET broker_symbol = EXCLUDED.broker_symbol;

-- Vérifier les mappings créés
SELECT 
  broker_name, 
  standard_symbol, 
  broker_symbol,
  created_at
FROM symbol_mappings 
WHERE broker_name IN ('VT Markets', 'Raise FX', 'Raise Global', 'Raise Globale', 'FXcess', 'Axi')
ORDER BY broker_name, standard_symbol;

-- Afficher le nombre de mappings par broker
SELECT 
  broker_name, 
  COUNT(*) as nombre_mappings
FROM symbol_mappings 
WHERE broker_name IN ('VT Markets', 'Raise FX', 'Raise Global', 'Raise Globale', 'FXcess', 'Axi')
GROUP BY broker_name
ORDER BY broker_name;

