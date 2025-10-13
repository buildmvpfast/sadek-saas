-- Brokers RÉELS populaires pour MT5
-- À exécuter après le schéma principal pour ajouter plus de brokers

-- Supprimer les brokers démo si besoin
-- DELETE FROM brokers;

-- Brokers populaires avec serveurs LIVE
INSERT INTO brokers (name, server_address) VALUES
  -- IC Markets
  ('IC Markets Raw', 'ICMarketsEU-Live'),
  ('IC Markets Raw (SC)', 'ICMarketsSC-Live'),
  ('IC Markets Demo', 'ICMarkets-Demo'),
  
  -- XM
  ('XM Global', 'XMGlobal-Real'),
  ('XM Demo', 'XMGlobal-Demo'),
  
  -- Pepperstone
  ('Pepperstone Live', 'Pepperstone-Live'),
  ('Pepperstone Demo', 'Pepperstone-Demo'),
  
  -- FTMO
  ('FTMO Live', 'FTMO-Server'),
  ('FTMO Demo', 'FTMO-Demo'),
  
  -- Admiral Markets
  ('Admiral Markets', 'AdmiralMarkets-Live'),
  ('Admiral Markets Demo', 'AdmiralMarkets-Demo'),
  
  -- FBS
  ('FBS Live', 'FBS-Real'),
  ('FBS Demo', 'FBS-Demo'),
  
  -- Exness
  ('Exness Live', 'Exness-MT5Live'),
  ('Exness Demo', 'Exness-MT5Demo'),
  
  -- HFM (HotForex)
  ('HFM Live', 'HotForex-Live'),
  ('HFM Demo', 'HotForex-Demo'),
  
  -- FXGT
  ('FXGT Live', 'FXGT-Live'),
  ('FXGT Demo', 'FXGT-Demo'),
  
  -- Alpari
  ('Alpari Live', 'Alpari-MT5-Live'),
  ('Alpari Demo', 'Alpari-MT5-Demo'),
  
  -- RoboForex
  ('RoboForex Live', 'RoboForex-ECN'),
  ('RoboForex Demo', 'RoboForex-Demo'),
  
  -- OctaFX
  ('OctaFX Live', 'OctaFX-Real'),
  ('OctaFX Demo', 'OctaFX-Demo'),
  
  -- AvaTrade
  ('AvaTrade Live', 'AvaTrade-MT5Live'),
  ('AvaTrade Demo', 'AvaTrade-MT5Demo'),
  
  -- Plus500
  ('Plus500 Live', 'Plus500-Live'),
  
  -- ThinkMarkets
  ('ThinkMarkets Live', 'ThinkMarkets-Live'),
  ('ThinkMarkets Demo', 'ThinkMarkets-Demo'),
  
  -- FP Markets
  ('FP Markets Live', 'FPMarkets-Live'),
  ('FP Markets Demo', 'FPMarkets-Demo'),
  
  -- Tickmill
  ('Tickmill Live', 'Tickmill-Live'),
  ('Tickmill Demo', 'Tickmill-Demo'),
  
  -- Forex.com
  ('Forex.com Live', 'FOREX.com-Live'),
  ('Forex.com Demo', 'FOREX.com-Demo'),
  
  -- OANDA
  ('OANDA Live', 'OANDA-v20-Live'),
  ('OANDA Demo', 'OANDA-v20-Practice'),
  
  -- CMC Markets
  ('CMC Markets Live', 'CMCMarkets-Live'),
  
  -- IG Markets
  ('IG Markets Live', 'IG-Live'),
  
  -- Autre/Personnalisé (pour serveurs custom)
  ('Autre (serveur personnalisé)', 'CUSTOM');

-- Note: Les noms de serveur exacts peuvent varier
-- Les utilisateurs peuvent toujours entrer un serveur custom si leur broker n'est pas listé

