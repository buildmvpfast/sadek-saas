# Variables d'Environnement pour Render

## 📋 Liste Complète des Variables

Copie-colle ces variables dans Render Dashboard → Environment Variables

### Supabase
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Stripe (LIVE)
```
STRIPE_SECRET_KEY=sk_live_<REDACTED>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_51SItfhGW0nj93dcTiMDkrrlH1YzEKkGBIiYxMlPCJH0gynRAmX0ROwFKEtHpQHnDEIVOr6yowYdvqUSBIAFLuICC00YnVByz
STRIPE_WEBHOOK_SECRET=whsec_... (à récupérer après configuration du webhook Stripe)
```

### Telegram
```
TELEGRAM_BOT_TOKEN=7958247845:AAFPfntvvND10uCs7AX6UPC5Dz4a_Dc17bc
```

### MetaAPI
```
METAAPI_TOKEN=ton_token_metaapi
```

### App URL
```
NEXT_PUBLIC_APP_URL=https://sadek-bot-saas.onrender.com
```
**⚠️ Important:** Remplace par l'URL réelle générée par Render après le premier déploiement, puis redéploie.

---

## 🔄 Variables pour le Worker Telegram

Pour le **Background Worker** qui exécute les trades Telegram, tu n'as besoin que de:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
METAAPI_TOKEN=ton_token_metaapi
```

---

## 🔄 Variables pour le Worker Copy Trading

Pour le **Background Worker** de copy trading (si tu le déploies):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
METAAPI_TOKEN=ton_token_metaapi
```

---

## 📝 Notes

- **Ne jamais commit** ces valeurs dans Git
- Utiliser les clés **LIVE** pour la production (pas test)
- `STRIPE_WEBHOOK_SECRET` sera disponible après avoir créé le webhook dans Stripe
- `NEXT_PUBLIC_APP_URL` doit être mis à jour après le premier déploiement

