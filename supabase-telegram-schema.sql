-- Schema pour le système de copy trading Telegram
-- Exécute ce script dans Supabase SQL Editor

-- Table des canaux Telegram
CREATE TABLE IF NOT EXISTS public.telegram_channels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  username VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des abonnements utilisateur aux canaux
CREATE TABLE IF NOT EXISTS public.user_telegram_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES public.telegram_channels(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, channel_id)
);

-- Table des signaux reçus
CREATE TABLE IF NOT EXISTS public.telegram_signals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID REFERENCES public.telegram_channels(id) ON DELETE CASCADE,
  message_id BIGINT NOT NULL,
  signal_type VARCHAR(50) NOT NULL, -- 'BUY', 'SELL', 'CLOSE'
  symbol VARCHAR(50) NOT NULL,
  entry_price DECIMAL(15,5),
  stop_loss DECIMAL(15,5),
  take_profit DECIMAL(15,5),
  volume DECIMAL(10,2),
  message_text TEXT,
  parsed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(channel_id, message_id)
);

-- Table des trades exécutés
CREATE TABLE IF NOT EXISTS public.telegram_trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES public.telegram_signals(id) ON DELETE CASCADE,
  mt5_account_id UUID REFERENCES public.mt5_accounts(id) ON DELETE CASCADE,
  symbol VARCHAR(50) NOT NULL,
  signal_type VARCHAR(50) NOT NULL,
  volume DECIMAL(10,2) NOT NULL,
  entry_price DECIMAL(15,5),
  stop_loss DECIMAL(15,5),
  take_profit DECIMAL(15,5),
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'executed', 'failed'
  executed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.telegram_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_telegram_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_trades ENABLE ROW LEVEL SECURITY;

-- Politiques pour telegram_channels (lecture publique)
CREATE POLICY "Anyone can view active channels" ON public.telegram_channels
  FOR SELECT USING (is_active = true);

-- Politiques pour user_telegram_subscriptions
CREATE POLICY "Users can view own subscriptions" ON public.user_telegram_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own subscriptions" ON public.user_telegram_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- Politiques pour telegram_signals (lecture publique)
CREATE POLICY "Anyone can view signals" ON public.telegram_signals
  FOR SELECT USING (true);

-- Politiques pour telegram_trades
CREATE POLICY "Users can view own trades" ON public.telegram_trades
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own trades" ON public.telegram_trades
  FOR ALL USING (auth.uid() = user_id);

-- Insérer quelques canaux populaires
INSERT INTO public.telegram_channels (name, username, description) VALUES
('Sadek Trading', 'sadektrading', 'Signaux de trading de Sadek'),
('Forex Signals Pro', 'forexsignalspro', 'Signaux Forex professionnels'),
('Crypto Signals', 'cryptosignals', 'Signaux crypto monnaies');

-- Vérifier les tables créées
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'telegram_%';
le bo