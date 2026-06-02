-- =============================================================================
-- SECURITY RLS FIXES
-- Run this in Supabase SQL Editor
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. FIX SUBSCRIPTIONS — users must NOT be able to write their own subscription
--    (prevents status bypass: UPDATE { status: 'active' } from browser)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON public.subscriptions;
-- Only keep SELECT for users; all writes go through service role (Stripe webhook)
-- Verify SELECT policy exists:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'subscriptions' AND cmd = 'SELECT'
  ) THEN
    CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. FIX PROFILES — prevent users from self-assigning is_admin = true
--    Using column-level privilege revocation (most reliable approach)
-- -----------------------------------------------------------------------------
REVOKE UPDATE (is_admin) ON public.profiles FROM authenticated;

-- Belt-and-suspenders: trigger that blocks is_admin changes from non-service roles
CREATE OR REPLACE FUNCTION public.prevent_is_admin_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_admin IS DISTINCT FROM NEW.is_admin THEN
    -- Only service_role can change is_admin
    IF current_setting('role') != 'service_role' THEN
      RAISE EXCEPTION 'Modifying is_admin is not allowed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_is_admin_change ON public.profiles;
CREATE TRIGGER check_is_admin_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_is_admin_change();

-- -----------------------------------------------------------------------------
-- 3. FIX TELEGRAM_BOT_TOKENS — remove the USING (true) policy that lets any
--    authenticated user read all bot tokens
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role can read tokens" ON public.telegram_bot_tokens;

-- Replace with a policy that only allows service_role access
-- (service_role bypasses RLS by default, so this table needs NO user policies)
-- If you need admins to read tokens via client, use a secure server action instead.

-- Verify RLS is enabled:
ALTER TABLE public.telegram_bot_tokens ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 4. FIX TELEGRAM_SIGNALS — remove USING (true) public read if it exists
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view signals" ON public.telegram_signals;
DROP POLICY IF EXISTS "Public read signals" ON public.telegram_signals;
-- Only subscribed users should see signals for channels they're subscribed to
-- (adjust this policy to match your actual business rules)

-- -----------------------------------------------------------------------------
-- 5. VERIFY — list all policies for review
-- -----------------------------------------------------------------------------
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('subscriptions', 'profiles', 'telegram_bot_tokens', 'telegram_signals')
ORDER BY tablename, cmd;
