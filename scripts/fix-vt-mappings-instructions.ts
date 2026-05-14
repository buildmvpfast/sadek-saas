
// Affiche le SQL à coller dans Supabase pour VT Markets ECN (symboles MT5 réels).
// Source de vérité : add-vt-mappings-comprehensive.sql à la racine du repo.

async function fixMappings() {
  console.log(
    "Exécute add-vt-mappings-comprehensive.sql dans le SQL Editor Supabase, ou colle :",
  );
  console.log(`
INSERT INTO public.symbol_mappings (broker_name, standard_symbol, broker_symbol) VALUES
  ('VT Markets', 'EURUSD', 'EURUSD-ECN'),
  ('VT Markets', 'GBPUSD', 'GBPUSD'),
  ('VT Markets', 'EURGBP', 'EURGBP-ECN'),
  ('VT Markets', 'EURJPY', 'EURJPY-ECN'),
  ('VT Markets', 'GBPJPY', 'GBPJPY-ECN'),
  ('VT Markets', 'GOLD', 'XAUUSD'),
  ('VT Markets', 'BTC', 'BTCUSD'),
  ('VT Markets', 'SOL30', 'SOL30'),
  ('VT Markets', 'US30', 'DJ30.s'),
  ('VT Markets', 'NAS100', 'NAS100.s'),
  ('VT Markets', 'GER40', 'GER40.s')
ON CONFLICT (broker_name, standard_symbol) DO UPDATE
SET broker_symbol = EXCLUDED.broker_symbol;
  `);
}

fixMappings();
