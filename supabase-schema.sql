-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users profile table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Brokers table
CREATE TABLE brokers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  server_address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MT5 Accounts table
CREATE TABLE mt5_accounts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  broker_id UUID REFERENCES brokers(id) NOT NULL,
  account_number BIGINT NOT NULL,
  password_encrypted TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  is_investor BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(account_number, broker_id)
);

-- Trading settings table
CREATE TABLE trading_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  position_sizing_type TEXT NOT NULL CHECK (position_sizing_type IN ('lot', 'percentage')),
  position_size_value DECIMAL(10, 2) NOT NULL,
  max_open_positions INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Subscriptions table
CREATE TABLE subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'inactive')),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Copy trading history
CREATE TABLE copy_trades (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_user_id UUID REFERENCES profiles(id) NOT NULL,
  follower_user_id UUID REFERENCES profiles(id) NOT NULL,
  admin_mt5_account_id UUID REFERENCES mt5_accounts(id) NOT NULL,
  follower_mt5_account_id UUID REFERENCES mt5_accounts(id) NOT NULL,
  symbol TEXT NOT NULL,
  order_type TEXT NOT NULL,
  volume DECIMAL(10, 2) NOT NULL,
  open_price DECIMAL(15, 5) NOT NULL,
  close_price DECIMAL(15, 5),
  stop_loss DECIMAL(15, 5),
  take_profit DECIMAL(15, 5),
  admin_ticket BIGINT NOT NULL,
  follower_ticket BIGINT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'opened', 'closed', 'failed')),
  error_message TEXT,
  opened_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default brokers
INSERT INTO brokers (name, server_address) VALUES
  ('IC Markets', 'ICMarkets-Demo'),
  ('XM Global', 'XMGlobal-Demo'),
  ('Admiral Markets', 'AdmiralMarkets-Demo'),
  ('FTMO', 'FTMO-Demo'),
  ('Pepperstone', 'Pepperstone-Demo');

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mt5_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE copy_trades ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Policies for mt5_accounts
CREATE POLICY "Users can view own mt5 accounts" ON mt5_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mt5 accounts" ON mt5_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mt5 accounts" ON mt5_accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own mt5 accounts" ON mt5_accounts
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for trading_settings
CREATE POLICY "Users can view own trading settings" ON trading_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trading settings" ON trading_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trading settings" ON trading_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Policies for subscriptions
CREATE POLICY "Users can view own subscription" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Policies for copy_trades
CREATE POLICY "Users can view own copy trades" ON copy_trades
  FOR SELECT USING (auth.uid() = follower_user_id OR auth.uid() = admin_user_id);

-- Function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  
  INSERT INTO public.subscriptions (user_id, status)
  VALUES (NEW.id, 'inactive');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

