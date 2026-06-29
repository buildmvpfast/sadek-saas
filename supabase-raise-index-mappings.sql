-- Raise* : indices live MT5 (pas les suffixes forex + / .r / .s)
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
