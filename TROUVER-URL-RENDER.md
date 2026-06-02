# 🔍 Comment Trouver l'URL pour le Webhook Telegram

## 📍 Où Trouver l'URL

### ⚠️ IMPORTANT : App sur Vercel ou Render ?

**Si ton app Next.js est sur Vercel** (ce qui semble être ton cas) :
- ✅ Utilise l'URL **Vercel** pour le webhook
- ❌ Pas besoin de Render pour le webhook

**Si ton app Next.js est sur Render** :
- ✅ Utilise l'URL **Render** pour le webhook

---

## 🚀 Si ton App est sur VERCEL

### Étape 1 : Trouver l'URL Vercel

1. Va sur **https://vercel.com/dashboard**
2. Connecte-toi
3. Clique sur ton projet
4. En haut de la page, tu verras l'URL, par exemple :
   ```
   https://sadek-saas.vercel.app
   ```
   ou
   ```
   https://ton-projet.vercel.app
   ```
5. **Copie cette URL**

### Étape 2 : Configurer le Webhook avec l'URL Vercel

```bash
curl -X POST "https://api.telegram.org/bot<BOT_ID>:<REDACTED_TOKEN>/setWebhook" \
  -d "url=https://TON-URL-VERCEL.vercel.app/api/telegram/webhook"
```

**Exemple :**
```bash
curl -X POST "https://api.telegram.org/bot<BOT_ID>:<REDACTED_TOKEN>/setWebhook" \
  -d "url=https://sadek-saas.vercel.app/api/telegram/webhook"
```

---

## 🏗️ Si ton App est sur RENDER

### Étape 1 : Aller sur Render Dashboard

1. Va sur **https://dashboard.render.com**
2. Connecte-toi

### Étape 2 : Identifier le Service Web

Dans Render, trouve ton **Service Web** (pas le worker) :
- **Type** : "Web Service"
- **Start Command** : `npm start`

### Étape 3 : Trouver l'URL

1. Clique sur le **Service Web**
2. En haut de la page, tu verras l'URL, par exemple :
   ```
   https://sadek-bot-saas.onrender.com
   ```
3. **Copie cette URL**

---

## 🎯 Comment Savoir Quel Service Utiliser ?

### Service Web (celui qu'il faut)
- **Type** : "Web Service"
- **Start Command** : `npm start` ou `npm run build && npm start`
- **URL visible** : Oui, en haut de la page
- **C'est celui-là qu'il faut !** ✅

### Background Worker (pas celui-là)
- **Type** : "Background Worker"
- **Start Command** : `npm run telegram-trades`
- **URL visible** : Non (pas d'URL publique)
- **Pas celui-là** ❌

---

## 📝 Exemple Visuel

Dans Render Dashboard, tu verras quelque chose comme :

```
Services
├── sadek-bot-saas (Web Service) ← CELUI-LÀ !
│   └── URL: https://sadek-bot-saas.onrender.com
│
└── sadek-telegram-trades-worker (Background Worker) ← Pas celui-là
    └── (pas d'URL)
```

---

## ✅ Résumé : Quelle URL Utiliser ?

### Si App sur Vercel (ton cas probablement)
- **URL à utiliser** : `https://ton-projet.vercel.app`
- **Webhook** : `https://ton-projet.vercel.app/api/telegram/webhook`

### Si App sur Render
- **URL à utiliser** : `https://ton-projet.onrender.com`
- **Webhook** : `https://ton-projet.onrender.com/api/telegram/webhook`

**⚠️ Important :** Le worker Render n'a pas d'URL publique, donc ne l'utilise pas pour le webhook !

---

## ❓ Si tu ne Trouves Pas de Service Web

Si tu n'as que des workers et pas de service web, il faut créer le service web :

1. Render Dashboard → **"New +"** → **"Web Service"**
2. Connecte ton repo GitHub
3. Configuration :
   - **Build Command** : `npm install && npm run build`
   - **Start Command** : `npm start`
4. Ajoute les variables d'environnement (voir `RENDER-ENV-VARIABLES.md`)
5. Crée le service
6. Une fois créé, l'URL apparaîtra en haut

---

## ✅ Vérification

Une fois le webhook configuré, vérifie :

```bash
curl "https://api.telegram.org/bot<BOT_ID>:<REDACTED_TOKEN>/getWebhookInfo"
```

Tu devrais voir :
```json
{
  "ok": true,
  "result": {
    "url": "https://ton-url.onrender.com/api/telegram/webhook"
  }
}
```

✅ Si tu vois ça, c'est bon !

