-- Migration pour le système de copy trading admin avec mapping de symboles et lots par instrument

-- 1. Ajouter les colonnes manquantes à mt5_accounts
ALTER TABLE mt5_accounts 
ADD COLUMN IF NOT EXISTS broker_name TEXT,
ADD COLUMN IF NOT EXISTS server_name TEXT,
ADD COLUMN IF NOT EXISTS is_admin_account BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS metaapi_account_id TEXT;

-- Supprimer l'ancienne contrainte broker_id si elle existe
ALTER TABLE mt5_accounts DROP CONSTRAINT IF EXISTS mt5_accounts_broker_id_fkey;
ALTER TABLE mt5_accounts DROP COLUMN IF EXISTS broker_id;

-- 2. Modifier trading_settings pour avoir des lots par instrument
ALTER TABLE trading_settings 
DROP COLUMN IF EXISTS position_size_value,
ADD COLUMN IF NOT EXISTS gold_lot_size DECIMAL(10, 2) DEFAULT 0.01,
ADD COLUMN IF NOT EXISTS sol_lot_size DECIMAL(10, 2) DEFAULT 0.01,
ADD COLUMN IF NOT EXISTS btc_lot_size DECIMAL(10, 2) DEFAULT 0.01,
ADD COLUMN IF NOT EXISTS position_percentage DECIMAL(5, 2) DEFAULT 1.0;

-- Garder position_sizing_type pour savoir si on utilise les lots fixes ou le %

-- 3. Créer la table de mapping des symboles par broker
CREATE TABLE IF NOT EXISTS symbol_mappings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  broker_name TEXT NOT NULL,
  standard_symbol TEXT NOT NULL, -- 'GOLD', 'SOL30', 'BTCUSD'
  broker_symbol TEXT NOT NULL, -- Le symbole utilisé par ce broker
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(broker_name, standard_symbol)
);

-- 4. Insérer les mappings de symboles courants
-- GOLD (XAU/USD)
INSERT INTO symbol_mappings (broker_name, standard_symbol, broker_symbol) VALUES
  ('IC Markets', 'GOLD', 'XAUUSD'),
  ('XM Global', 'GOLD', 'GOLD'),
  ('Pepperstone', 'GOLD', 'XAUUSD'),
  ('Exness', 'GOLD', 'XAUUSD'),
  ('FTMO', 'GOLD', 'XAUUSD'),
  ('Admiral Markets', 'GOLD', 'GOLD'),
  ('FBS', 'GOLD', 'XAUUSDm'),
  ('RoboForex', 'GOLD', 'XAUUSD'),
  ('Alpari', 'GOLD', 'XAUUSD'),
  ('OctaFX', 'GOLD', 'XAUUSD'),
  ('HFM (HotForex)', 'GOLD', 'XAUUSD'),
  ('FXGT', 'GOLD', 'XAUUSD'),
  ('AvaTrade', 'GOLD', 'GOLD'),
  ('ThinkMarkets', 'GOLD', 'XAUUSD'),
  ('FP Markets', 'GOLD', 'XAUUSD'),
  ('Tickmill', 'GOLD', 'XAUUSD'),
  ('Forex.com', 'GOLD', 'XAU/USD'),
  ('OANDA', 'GOLD', 'XAU_USD'),
  ('IG Markets', 'GOLD', 'GOLD'),
  ('CMC Markets', 'GOLD', 'GOLD')
ON CONFLICT (broker_name, standard_symbol) DO NOTHING;

-- SOL30 (Solana Index)
INSERT INTO symbol_mappings (broker_name, standard_symbol, broker_symbol) VALUES
  ('IC Markets', 'SOL30', 'SOL30'),
  ('XM Global', 'SOL30', 'SOLUSDT'),
  ('Pepperstone', 'SOL30', 'SOL30'),
  ('Exness', 'SOL30', 'SOLUSDT'),
  ('FTMO', 'SOL30', 'SOL30'),
  ('Admiral Markets', 'SOL30', 'SOLUSDT'),
  ('FBS', 'SOL30', 'SOLUSDTm'),
  ('RoboForex', 'SOL30', 'SOLUSDT'),
  ('Alpari', 'SOL30', 'SOLUSDT'),
  ('OctaFX', 'SOL30', 'SOLUSDT'),
  ('HFM (HotForex)', 'SOL30', 'SOLUSDT'),
  ('FXGT', 'SOL30', 'SOLUSDT'),
  ('AvaTrade', 'SOL30', 'SOLUSDT'),
  ('ThinkMarkets', 'SOL30', 'SOLUSDT'),
  ('FP Markets', 'SOL30', 'SOLUSDT'),
  ('Tickmill', 'SOL30', 'SOLUSDT'),
  ('Forex.com', 'SOL30', 'SOL/USD'),
  ('OANDA', 'SOL30', 'SOL_USD'),
  ('IG Markets', 'SOL30', 'SOLANA'),
  ('CMC Markets', 'SOL30', 'SOLANA')
ON CONFLICT (broker_name, standard_symbol) DO NOTHING;

-- BTC (Bitcoin)
INSERT INTO symbol_mappings (broker_name, standard_symbol, broker_symbol) VALUES
  ('IC Markets', 'BTC', 'BTCUSD'),
  ('XM Global', 'BTC', 'BITCOIN'),
  ('Pepperstone', 'BTC', 'BTCUSD'),
  ('Exness', 'BTC', 'BTCUSD'),
  ('FTMO', 'BTC', 'BTCUSD'),
  ('Admiral Markets', 'BTC', 'BITCOIN'),
  ('FBS', 'BTC', 'BTCUSDm'),
  ('RoboForex', 'BTC', 'BTCUSD'),
  ('Alpari', 'BTC', 'BTCUSD'),
  ('OctaFX', 'BTC', 'BTCUSD'),
  ('HFM (HotForex)', 'BTC', 'BTCUSD'),
  ('FXGT', 'BTC', 'BTCUSD'),
  ('AvaTrade', 'BTC', 'BITCOIN'),
  ('ThinkMarkets', 'BTC', 'BTCUSD'),
  ('FP Markets', 'BTC', 'BTCUSD'),
  ('Tickmill', 'BTC', 'BTCUSD'),
  ('Forex.com', 'BTC', 'BTC/USD'),
  ('OANDA', 'BTC', 'BTC_USD'),
  ('IG Markets', 'BTC', 'BITCOIN'),
  ('CMC Markets', 'BTC', 'BITCOIN')
ON CONFLICT (broker_name, standard_symbol) DO NOTHING;

-- 5. Activer RLS sur symbol_mappings
ALTER TABLE symbol_mappings ENABLE ROW LEVEL SECURITY;

-- Politique pour que tout le monde puisse lire les mappings
CREATE POLICY "Everyone can view symbol mappings" ON symbol_mappings
  FOR SELECT USING (true);

-- Seuls les admins peuvent modifier (on fera ça via service role)
CREATE POLICY "Only service role can modify symbol mappings" ON symbol_mappings
  FOR ALL USING (false);

-- 6. Ajouter des policies pour que les admins puissent voir tous les comptes MT5
CREATE POLICY "Admins can view all mt5 accounts" ON mt5_accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- 7. Ajouter des policies pour que les admins puissent voir tous les copy_trades
CREATE POLICY "Admins can view all copy trades" ON copy_trades
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- 8. Ajouter une policy pour que les admins puissent insérer des copy_trades
CREATE POLICY "Admins can insert copy trades" ON copy_trades
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- 9. Supprimer la table brokers si elle existe encore (on utilise maintenant les noms directs)
DROP TABLE IF EXISTS brokers CASCADE;

-- 10. Ajouter un index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_mt5_accounts_is_admin ON mt5_accounts(is_admin_account) WHERE is_admin_account = true;
CREATE INDEX IF NOT EXISTS idx_mt5_accounts_active ON mt5_accounts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_copy_trades_status ON copy_trades(status);
CREATE INDEX IF NOT EXISTS idx_symbol_mappings_lookup ON symbol_mappings(broker_name, standard_symbol);

-- 11. Fonction helper pour obtenir le symbole broker depuis le symbole standard
CREATE OR REPLACE FUNCTION get_broker_symbol(
  p_broker_name TEXT,
  p_standard_symbol TEXT
) RETURNS TEXT AS $$
DECLARE
  v_broker_symbol TEXT;
BEGIN
  SELECT broker_symbol INTO v_broker_symbol
  FROM symbol_mappings
  WHERE broker_name = p_broker_name
    AND standard_symbol = p_standard_symbol;
  
  -- Si pas trouvé, retourner le symbole standard
  RETURN COALESCE(v_broker_symbol, p_standard_symbol);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Fonction pour détecter le symbole standard depuis un symbole broker
CREATE OR REPLACE FUNCTION get_standard_symbol(
  p_broker_name TEXT,
  p_broker_symbol TEXT
) RETURNS TEXT AS $$
DECLARE
  v_standard_symbol TEXT;
BEGIN
  SELECT standard_symbol INTO v_standard_symbol
  FROM symbol_mappings
  WHERE broker_name = p_broker_name
    AND broker_symbol = p_broker_symbol;
  
  -- Si pas trouvé, essayer de deviner
  IF v_standard_symbol IS NULL THEN
    IF p_broker_symbol ILIKE '%XAU%' OR p_broker_symbol ILIKE '%GOLD%' THEN
      RETURN 'GOLD';
    ELSIF p_broker_symbol ILIKE '%SOL%' THEN
      RETURN 'SOL30';
    ELSIF p_broker_symbol ILIKE '%BTC%' OR p_broker_symbol ILIKE '%BITCOIN%' THEN
      RETURN 'BTC';
    END IF;
  END IF;
  
  RETURN COALESCE(v_standard_symbol, p_broker_symbol);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

