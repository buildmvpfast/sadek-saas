-- Ajouter la colonne order_type aux tables telegram_signals et telegram_trades
-- Si elle n'existe pas déjà

-- Pour telegram_signals
ALTER TABLE public.telegram_signals 
ADD COLUMN IF NOT EXISTS order_type VARCHAR(50) DEFAULT 'MARKET';

-- Pour telegram_trades
ALTER TABLE public.telegram_trades 
ADD COLUMN IF NOT EXISTS order_type VARCHAR(50) DEFAULT 'MARKET';

-- Vérifier
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('telegram_signals', 'telegram_trades')
AND column_name = 'order_type';

