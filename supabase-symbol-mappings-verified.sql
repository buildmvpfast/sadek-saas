-- Mapping COMPLET : 7 brokers × pack PDF (métaux, crypto, indices, forex majeures + croisées)
-- Coller dans Supabase SQL Editor (remplace les mappings existants pour ces brokers)
-- Puis audit live : METAAPI_TOKEN=... npx tsx scripts/audit-broker-symbols.ts

CREATE TABLE IF NOT EXISTS symbol_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  broker_name TEXT NOT NULL,
  standard_symbol TEXT NOT NULL,
  broker_symbol TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(broker_name, standard_symbol)
);

ALTER TABLE symbol_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can view symbol mappings" ON symbol_mappings;
CREATE POLICY "Everyone can view symbol mappings" ON symbol_mappings
  FOR SELECT USING (true);

-- ═══ VT Markets (ECN sur paires EUR*, indices .s, GOLD VIP) ═══
INSERT INTO symbol_mappings (broker_name, standard_symbol, broker_symbol) VALUES
  ('VT Markets', 'GOLD', 'XAUUSD-VIP'),
  ('VT Markets', 'BTC', 'BTCUSD'),
  ('VT Markets', 'ETH', 'ETHUSD'),
  ('VT Markets', 'SOL30', 'SOL30'),
  ('VT Markets', 'US30', 'DJ30.s'),
  ('VT Markets', 'NAS100', 'NAS100.s'),
  ('VT Markets', 'GER40', 'GER40.s'),
  ('VT Markets', 'UK100', 'UK100.s'),
  ('VT Markets', 'SPX500', 'SPX500.s'),
  ('VT Markets', 'EURUSD', 'EURUSD-ECN'),
  ('VT Markets', 'EURGBP', 'EURGBP-ECN'),
  ('VT Markets', 'EURJPY', 'EURJPY-ECN'),
  ('VT Markets', 'GBPJPY', 'GBPJPY-ECN'),
  ('VT Markets', 'GBPUSD', 'GBPUSD'),
  ('VT Markets', 'USDJPY', 'USDJPY'),
  ('VT Markets', 'USDCHF', 'USDCHF'),
  ('VT Markets', 'USDCAD', 'USDCAD'),
  ('VT Markets', 'AUDUSD', 'AUDUSD'),
  ('VT Markets', 'NZDUSD', 'NZDUSD'),
  ('VT Markets', 'EURCHF', 'EURCHF'),
  ('VT Markets', 'GBPCHF', 'GBPCHF'),
  ('VT Markets', 'CHFJPY', 'CHFJPY'),
  ('VT Markets', 'CADJPY', 'CADJPY'),
  ('VT Markets', 'AUDJPY', 'AUDJPY'),
  ('VT Markets', 'NZDJPY', 'NZDJPY'),
  ('VT Markets', 'AUDCAD', 'AUDCAD'),
  ('VT Markets', 'AUDCHF', 'AUDCHF'),
  ('VT Markets', 'AUDNZD', 'AUDNZD'),
  ('VT Markets', 'CADCHF', 'CADCHF'),
  ('VT Markets', 'EURAUD', 'EURAUD'),
  ('VT Markets', 'EURCAD', 'EURCAD'),
  ('VT Markets', 'EURNZD', 'EURNZD'),
  ('VT Markets', 'GBPAUD', 'GBPAUD'),
  ('VT Markets', 'GBPCAD', 'GBPCAD'),
  ('VT Markets', 'GBPNZD', 'GBPNZD'),
  ('VT Markets', 'NZDCAD', 'NZDCAD'),
  ('VT Markets', 'NZDCHF', 'NZDCHF')
ON CONFLICT (broker_name, standard_symbol) DO UPDATE SET broker_symbol = EXCLUDED.broker_symbol;

-- ═══ Vantage (+ sur forex, DJ30 indices) ═══
INSERT INTO symbol_mappings (broker_name, standard_symbol, broker_symbol) VALUES
  ('Vantage', 'GOLD', 'XAUUSD+'),
  ('Vantage', 'BTC', 'BTCUSD'),
  ('Vantage', 'ETH', 'ETHUSD'),
  ('Vantage', 'SOL30', 'SOL30'),
  ('Vantage', 'US30', 'DJ30'),
  ('Vantage', 'NAS100', 'NAS100'),
  ('Vantage', 'GER40', 'GER40'),
  ('Vantage', 'UK100', 'UK100'),
  ('Vantage', 'SPX500', 'SPX500'),
  ('Vantage', 'EURUSD', 'EURUSD+'),
  ('Vantage', 'GBPUSD', 'GBPUSD+'),
  ('Vantage', 'USDJPY', 'USDJPY+'),
  ('Vantage', 'USDCHF', 'USDCHF+'),
  ('Vantage', 'USDCAD', 'USDCAD+'),
  ('Vantage', 'AUDUSD', 'AUDUSD+'),
  ('Vantage', 'NZDUSD', 'NZDUSD+'),
  ('Vantage', 'EURGBP', 'EURGBP+'),
  ('Vantage', 'EURJPY', 'EURJPY+'),
  ('Vantage', 'GBPJPY', 'GBPJPY+'),
  ('Vantage', 'EURCHF', 'EURCHF+'),
  ('Vantage', 'GBPCHF', 'GBPCHF+'),
  ('Vantage', 'CHFJPY', 'CHFJPY+'),
  ('Vantage', 'CADJPY', 'CADJPY+'),
  ('Vantage', 'AUDJPY', 'AUDJPY+'),
  ('Vantage', 'NZDJPY', 'NZDJPY+'),
  ('Vantage', 'AUDCAD', 'AUDCAD+'),
  ('Vantage', 'AUDCHF', 'AUDCHF+'),
  ('Vantage', 'AUDNZD', 'AUDNZD+'),
  ('Vantage', 'CADCHF', 'CADCHF+'),
  ('Vantage', 'EURAUD', 'EURAUD+'),
  ('Vantage', 'EURCAD', 'EURCAD+'),
  ('Vantage', 'EURNZD', 'EURNZD+'),
  ('Vantage', 'GBPAUD', 'GBPAUD+'),
  ('Vantage', 'GBPCAD', 'GBPCAD+'),
  ('Vantage', 'GBPNZD', 'GBPNZD+'),
  ('Vantage', 'NZDCAD', 'NZDCAD+'),
  ('Vantage', 'NZDCHF', 'NZDCHF+')
ON CONFLICT (broker_name, standard_symbol) DO UPDATE SET broker_symbol = EXCLUDED.broker_symbol;

-- ═══ Axi / Raise FX / Raise Global / Raise Globale / FXcess (symboles standards) ═══
INSERT INTO symbol_mappings (broker_name, standard_symbol, broker_symbol)
SELECT b.broker_name, s.standard_symbol, s.broker_symbol
FROM (VALUES
  ('Axi'), ('Raise FX'), ('Raise Global'), ('Raise Globale'), ('FXcess')
) AS b(broker_name)
CROSS JOIN (VALUES
  ('GOLD', 'XAUUSD'), ('BTC', 'BTCUSD'), ('ETH', 'ETHUSD'), ('SOL30', 'SOL30'),
  ('US30', 'US30'), ('NAS100', 'NAS100'), ('GER40', 'GER40'), ('UK100', 'UK100'), ('SPX500', 'SPX500'),
  ('EURUSD', 'EURUSD'), ('GBPUSD', 'GBPUSD'), ('USDJPY', 'USDJPY'), ('USDCHF', 'USDCHF'),
  ('USDCAD', 'USDCAD'), ('AUDUSD', 'AUDUSD'), ('NZDUSD', 'NZDUSD'),
  ('EURGBP', 'EURGBP'), ('EURJPY', 'EURJPY'), ('GBPJPY', 'GBPJPY'),
  ('EURCHF', 'EURCHF'), ('GBPCHF', 'GBPCHF'), ('CHFJPY', 'CHFJPY'), ('CADJPY', 'CADJPY'),
  ('AUDJPY', 'AUDJPY'), ('NZDJPY', 'NZDJPY'), ('AUDCAD', 'AUDCAD'), ('AUDCHF', 'AUDCHF'),
  ('AUDNZD', 'AUDNZD'), ('CADCHF', 'CADCHF'), ('EURAUD', 'EURAUD'), ('EURCAD', 'EURCAD'),
  ('EURNZD', 'EURNZD'), ('GBPAUD', 'GBPAUD'), ('GBPCAD', 'GBPCAD'), ('GBPNZD', 'GBPNZD'),
  ('NZDCAD', 'NZDCAD'), ('NZDCHF', 'NZDCHF')
) AS s(standard_symbol, broker_symbol)
ON CONFLICT (broker_name, standard_symbol) DO UPDATE SET broker_symbol = EXCLUDED.broker_symbol;

-- Raise* : indices live MT5
INSERT INTO symbol_mappings (broker_name, standard_symbol, broker_symbol) VALUES
  ('Raise FX', 'GER40', 'DE40'),
  ('Raise FX', 'NAS100', 'NAS100'),
  ('Raise FX', 'US30', 'US30'),
  ('Raise Global', 'GER40', 'DE40'),
  ('Raise Global', 'NAS100', 'NAS100'),
  ('Raise Global', 'US30', 'US30'),
  ('Raise Globale', 'GER40', 'DE40'),
  ('Raise Globale', 'NAS100', 'NAS100'),
  ('Raise Globale', 'US30', 'US30')
ON CONFLICT (broker_name, standard_symbol) DO UPDATE SET broker_symbol = EXCLUDED.broker_symbol;

SELECT broker_name, COUNT(*) AS mappings
FROM symbol_mappings
WHERE broker_name IN (
  'VT Markets', 'Vantage', 'Axi', 'Raise FX', 'Raise Global', 'Raise Globale', 'FXcess'
)
GROUP BY broker_name
ORDER BY broker_name;
