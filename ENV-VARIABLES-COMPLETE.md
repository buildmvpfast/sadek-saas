# 📋 Variables d'Environnement Complètes

## 🔵 VERCEL (Frontend + API Routes)

### Supabase
```
NEXT_PUBLIC_SUPABASE_URL=https://ton-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ton_anon_key
SUPABASE_SERVICE_ROLE_KEY=ton_service_role_key
```

### Stripe
```
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### MetaAPI
```
METAAPI_TOKEN=eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9...
```

### Telegram
```
TELEGRAM_BOT_TOKEN=8496815756:AAGnDGVRcoA7JmTOz5N3HLJKD_YgmsmnuXI
```

### OpenAI (pour parsing intelligent)
```
OPENAI_API_KEY=sk-...
```

### App URL
```
NEXT_PUBLIC_APP_URL=https://sadek-saas.vercel.app
```

---

## 🟢 RENDER (Backend Worker - Telegram Trades)

### Supabase
```
NEXT_PUBLIC_SUPABASE_URL=https://ton-projet.supabase.co
SUPABASE_SERVICE_ROLE_KEY=ton_service_role_key
```

### MetaAPI
```
METAAPI_TOKEN=eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9...
```

**⚠️ IMPORTANT:** Le worker Render n'a PAS besoin de:
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (utilise service role)
- `NEXT_PUBLIC_APP_URL` (ne fait pas d'appels HTTP)
- `STRIPE_*` (pas de Stripe dans le worker)
- `TELEGRAM_BOT_TOKEN` (pas de webhook dans le worker)
- `OPENAI_API_KEY` (pas de parsing dans le worker)

---

## 🔧 Configuration du Canal de Test

### 1. Dans Supabase SQL Editor, exécute:
```sql
-- Voir le fichier: setup-test-channel.sql
```

### 2. Configurer le webhook Telegram pour le canal de test:
```bash
curl -X POST "https://api.telegram.org/bot<BOT_ID>:<REDACTED_TOKEN>/setWebhook?url=https://sadek-saas.vercel.app/api/telegram/webhook"
```

### 3. Vérifier le webhook:
```bash
curl "https://api.telegram.org/bot<BOT_ID>:<REDACTED_TOKEN>/getWebhookInfo"
```

---

## 📝 Où Changer le Token pour les Tests

### Option 1: Ajouter un nouveau canal de test (recommandé)
- Exécute `setup-test-channel.sql` dans Supabase
- Le canal "testchannel" sera créé avec le token de test
- Envoie les messages dans ce canal pour tester

### Option 2: Modifier le token existant
```sql
-- Dans Supabase SQL Editor
UPDATE telegram_bot_tokens
SET bot_token = '8496815756:AAGnDGVRcoA7JmTOz5N3HLJKD_YgmsmnuXI',
    is_active = true,
    updated_at = NOW()
WHERE channel_id = (SELECT id FROM telegram_channels WHERE username = 'imprimbot');
```

### Option 3: Variable d'environnement (pour tests locaux)
- Dans `.env.local`: `TELEGRAM_BOT_TOKEN=8496815756:AAGnDGVRcoA7JmTOz5N3HLJKD_YgmsmnuXI`
- Dans Vercel: Change la variable `TELEGRAM_BOT_TOKEN`

---

## ✅ Checklist de Vérification

### Vercel
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `METAAPI_TOKEN`
- [ ] `TELEGRAM_BOT_TOKEN`
- [ ] `OPENAI_API_KEY` (optionnel mais recommandé)
- [ ] `NEXT_PUBLIC_APP_URL`

### Render Worker
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `METAAPI_TOKEN`

---

## 🧪 Test Rapide

1. **Configurer le canal de test:**
   ```sql
   -- Exécute setup-test-channel.sql dans Supabase
   ```

2. **Configurer le webhook:**
   ```bash
   curl -X POST "https://api.telegram.org/bot<BOT_ID>:<REDACTED_TOKEN>/setWebhook?url=https://sadek-saas.vercel.app/api/telegram/webhook"
   ```

3. **Envoyer un message de test:**
   - Dans le canal Telegram du bot de test
   - Message: `BUY XAUUSD @2650.50 SL:2640 TP:2670`

4. **Vérifier les logs Vercel** pour voir si le signal est parsé

