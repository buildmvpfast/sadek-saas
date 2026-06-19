-- Multi-TP Telegram (requis pour parse-signal)
ALTER TABLE public.telegram_signals
  ADD COLUMN IF NOT EXISTS all_tp JSONB;

COMMENT ON COLUMN public.telegram_signals.all_tp IS 'Liste des TP ex: [4841, 4868.7] — 1 trade MetaAPI par TP';
