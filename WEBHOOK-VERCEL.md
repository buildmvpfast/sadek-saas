# 📱 Configurer le Webhook Telegram avec Vercel

## 🎯 Situation

- ✅ **App Next.js** : Sur **Vercel**
- ✅ **Worker Telegram** : Sur **Render** (optionnel, pour backup)
- 📱 **Webhook Telegram** : Doit pointer vers **Vercel** (pas Render)

---

## 🔍 Étape 1 : Trouver l'URL Vercel

1. Va sur **https://vercel.com/dashboard**
2. Connecte-toi
3. Clique sur ton projet (ex: `sadek-saas`)
4. En haut de la page, tu verras l'URL :
   ```
   https://sadek-saas.vercel.app
   ```
   ou
   ```
   https://ton-projet.vercel.app
   ```
5. **Copie cette URL**

---

## 🔧 Étape 2 : Configurer le Webhook

Ouvre ton terminal et exécute :

```bash
curl -X POST "https://api.telegram.org/bot7958247845:AAFPfntvvND10uCs7AX6UPC5Dz4a_Dc17bc/setWebhook" \
  -d "url=https://TON-URL-VERCEL.vercel.app/api/telegram/webhook"
```

**Remplace `TON-URL-VERCEL.vercel.app` par ta vraie URL Vercel.**

**Exemple si ton URL est `https://sadek-saas.vercel.app` :**

```bash
curl -X POST "https://api.telegram.org/bot7958247845:AAFPfntvvND10uCs7AX6UPC5Dz4a_Dc17bc/setWebhook" \
  -d "url=https://sadek-saas.vercel.app/api/telegram/webhook"
```

**Résultat attendu :**
```json
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
```

---

## ✅ Étape 3 : Vérifier

```bash
curl "https://api.telegram.org/bot7958247845:AAFPfntvvND10uCs7AX6UPC5Dz4a_Dc17bc/getWebhookInfo"
```

**Résultat attendu :**
```json
{
  "ok": true,
  "result": {
    "url": "https://ton-url.vercel.app/api/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

✅ Si tu vois ça, c'est bon !

---

## 📋 Architecture

```
Vercel (App Next.js)
├── Frontend
├── API Routes
│   ├── /api/telegram/webhook ← Webhook Telegram pointe ICI
│   ├── /api/telegram/parse-signal
│   └── /api/telegram/execute-trades
└── Variables d'environnement

Render (Background Worker)
└── Worker Telegram Trades
    └── Backup : Vérifie les trades toutes les 5 secondes
```

**Le webhook Telegram doit pointer vers Vercel, pas Render !**

---

## 🚨 Si ça ne Marche Pas

### Vérifier que l'URL Vercel est correcte

1. Va sur ton URL Vercel dans le navigateur
2. Tu devrais voir ton app
3. Teste : `https://ton-url.vercel.app/api/telegram/webhook`
   - Doit retourner quelque chose (même une erreur, mais pas 404)

### Vérifier les variables d'environnement Vercel

Dans Vercel Dashboard → Settings → Environment Variables :
- ✅ `TELEGRAM_BOT_TOKEN=7958247845:AAFPfntvvND10uCs7AX6UPC5Dz4a_Dc17bc`
- ✅ `NEXT_PUBLIC_APP_URL=https://ton-url.vercel.app`

### Vérifier les logs Vercel

1. Vercel Dashboard → Ton projet → **Logs**
2. Envoie un message dans le canal Telegram
3. Tu devrais voir des logs apparaître

---

## ✅ C'est Bon !

Une fois configuré :
- ✅ Messages Telegram → Webhook Vercel
- ✅ Parsing du signal → Vercel
- ✅ Création des trades → Vercel
- ✅ Exécution immédiate → Vercel
- ✅ Backup worker → Render (vérifie toutes les 5 secondes)

