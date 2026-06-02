# Guide de Déploiement sur Render

## 🚀 Déploiement de l'Application Next.js

### Étape 1: Préparer le Repository

1. **Pousser le code sur GitHub/GitLab/Bitbucket**
   ```bash
   git add .
   git commit -m "Ready for production"
   git push origin main
   ```

### Étape 2: Créer le Service Web sur Render

1. Aller sur [Render Dashboard](https://dashboard.render.com)
2. Cliquer sur **"New +"** → **"Web Service"**
3. Connecter ton repository GitHub/GitLab
4. Sélectionner le repository du projet

### Étape 3: Configuration du Service Web

**Nom du service:** `sadek-bot-saas` (ou ce que tu veux)

**Configuration:**
- **Environment:** `Node`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Plan:** Choisir un plan (Starter ou Standard recommandé)

### Étape 4: Variables d'Environnement

Ajouter toutes ces variables dans **Environment Variables**:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Stripe (LIVE)
STRIPE_SECRET_KEY=sk_live_<REDACTED>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_51SItfhGW0nj93dcTiMDkrrlH1YzEKkGBIiYxMlPCJH0gynRAmX0ROwFKEtHpQHnDEIVOr6yowYdvqUSBIAFLuICC00YnVByz
STRIPE_WEBHOOK_SECRET=whsec_... (à récupérer après configuration du webhook)

# Telegram
TELEGRAM_BOT_TOKEN=7958247845:AAFPfntvvND10uCs7AX6UPC5Dz4a_Dc17bc

# MetaAPI
METAAPI_TOKEN=ton_token_metaapi

# App URL (sera généré automatiquement par Render)
NEXT_PUBLIC_APP_URL=https://sadek-bot-saas.onrender.com
```

**Important:** Remplace `NEXT_PUBLIC_APP_URL` par l'URL réelle générée par Render après le premier déploiement.

### Étape 5: Déployer

1. Cliquer sur **"Create Web Service"**
2. Render va automatiquement:
   - Cloner le repo
   - Installer les dépendances
   - Builder l'application
   - Lancer le service

3. Attendre la fin du build (5-10 minutes)

4. **Copier l'URL générée** (ex: `https://sadek-bot-saas.onrender.com`)

5. **Mettre à jour `NEXT_PUBLIC_APP_URL`** dans les variables d'environnement avec cette URL

6. **Redéployer** pour que la nouvelle URL soit prise en compte

---

## 🔄 Déploiement du Service Telegram Trades (Worker)

### Étape 1: Créer un Background Worker

1. Dans Render Dashboard, cliquer sur **"New +"** → **"Background Worker"**
2. Connecter le même repository
3. Sélectionner le repository

### Étape 2: Configuration du Worker

**Nom:** `sadek-telegram-trades-worker`

**Configuration:**
- **Environment:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `npm run telegram-trades`
- **Plan:** Starter ou Standard

### Étape 3: Variables d'Environnement du Worker

Ajouter les mêmes variables que le service web (sauf `NEXT_PUBLIC_APP_URL` qui n'est pas nécessaire):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# MetaAPI
METAAPI_TOKEN=ton_token_metaapi
```

### Étape 4: Déployer le Worker

1. Cliquer sur **"Create Background Worker"**
2. Le worker va tourner en continu et exécuter les trades Telegram toutes les 5 secondes

---

## 🔄 Déploiement du Service Copy Trading (Optionnel)

Si tu veux aussi déployer le service de copy trading admin:

1. Créer un autre **Background Worker**
2. **Start Command:** `npm run copy-trading`
3. Mêmes variables d'environnement que le worker Telegram

---

## 🔗 Configuration Stripe Webhook

### Étape 1: Récupérer l'URL de Production

Une fois l'app déployée sur Render, récupère l'URL:
- Ex: `https://sadek-bot-saas.onrender.com`

### Étape 2: Configurer le Webhook dans Stripe

1. Aller sur [Stripe Dashboard](https://dashboard.stripe.com)
2. **Developers** → **Webhooks**
3. Cliquer sur **"Add endpoint"**
4. **Endpoint URL:** `https://sadek-bot-saas.onrender.com/api/webhook`
5. **Description:** "Sadek Bot SaaS Webhook"
6. **Events to send:** Sélectionner ces événements:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
7. Cliquer sur **"Add endpoint"**

### Étape 3: Récupérer le Webhook Secret

1. Une fois le webhook créé, cliquer dessus
2. Dans **"Signing secret"**, cliquer sur **"Reveal"**
3. **Copier le secret** (commence par `whsec_...`)
4. **Ajouter dans Render** comme variable d'environnement:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
5. **Redéployer** le service web

### Étape 4: Tester le Webhook

1. Dans Stripe Dashboard → Webhooks → Ton webhook
2. Cliquer sur **"Send test webhook"**
3. Sélectionner un événement (ex: `checkout.session.completed`)
4. Vérifier les logs Render pour voir si le webhook est reçu

---

## 🤖 Configuration Telegram Webhook

### Étape 1: Configurer le Webhook Telegram

Une fois l'app déployée, configurer le webhook Telegram:

```bash
curl -X POST "https://api.telegram.org/bot<BOT_ID>:<REDACTED_TOKEN>/setWebhook" \
  -d "url=https://sadek-bot-saas.onrender.com/api/telegram/webhook"
```

### Étape 2: Vérifier le Webhook

```bash
curl "https://api.telegram.org/bot<BOT_ID>:<REDACTED_TOKEN>/getWebhookInfo"
```

Tu devrais voir:
```json
{
  "ok": true,
  "result": {
    "url": "https://sadek-bot-saas.onrender.com/api/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

---

## 📊 Monitoring et Logs

### Voir les Logs sur Render

1. Dans le Dashboard Render
2. Cliquer sur ton service
3. Onglet **"Logs"**
4. Tu verras tous les logs en temps réel

### Logs Importants à Surveiller

- ✅ Déploiements réussis
- ❌ Erreurs de build
- 🔔 Webhooks Stripe reçus
- 📱 Messages Telegram reçus
- 💰 Trades exécutés
- ⚠️ Erreurs MetaAPI

---

## 🔧 Dépannage

### Problème: Build échoue

**Solutions:**
- Vérifier que toutes les dépendances sont dans `package.json`
- Vérifier les logs de build pour voir l'erreur exacte
- S'assurer que `npm run build` fonctionne en local

### Problème: Service ne démarre pas

**Solutions:**
- Vérifier que `npm start` fonctionne en local
- Vérifier les logs Render
- Vérifier que toutes les variables d'environnement sont définies

### Problème: Webhook Stripe ne fonctionne pas

**Solutions:**
- Vérifier que `STRIPE_WEBHOOK_SECRET` est correct
- Vérifier les logs Render pour voir les erreurs
- Tester avec Stripe CLI en local d'abord
- Vérifier que l'URL du webhook est correcte dans Stripe

### Problème: Telegram webhook ne fonctionne pas

**Solutions:**
- Vérifier que le bot est admin du canal
- Vérifier les logs Render
- Vérifier que `TELEGRAM_BOT_TOKEN` est correct
- Tester le webhook avec `curl`

### Problème: Trades Telegram ne s'exécutent pas

**Solutions:**
- Vérifier que le worker `telegram-trades` est démarré
- Vérifier les logs du worker
- Vérifier que `METAAPI_TOKEN` est correct
- Vérifier que les comptes MT5 ont un `metaapi_account_id`

---

## 🔐 Sécurité en Production

### Checklist Sécurité

- [x] Utiliser les clés Stripe **LIVE** (pas test)
- [x] Ne jamais commit les tokens dans Git
- [x] HTTPS activé automatiquement par Render
- [x] Variables d'environnement sécurisées dans Render
- [ ] Activer les backups Supabase
- [ ] Monitorer les erreurs (Sentry recommandé)
- [ ] Rate limiting sur les API (à ajouter)

---

## 📝 Checklist Finale

Avant de mettre en production:

- [ ] Code poussé sur GitHub
- [ ] Service web déployé sur Render
- [ ] Worker Telegram déployé
- [ ] Toutes les variables d'environnement configurées
- [ ] Webhook Stripe configuré et testé
- [ ] Webhook Telegram configuré
- [ ] `NEXT_PUBLIC_APP_URL` mis à jour avec l'URL Render
- [ ] Test d'un abonnement complet (création → paiement → activation)
- [ ] Test d'un signal Telegram (message → parsing → trade)
- [ ] Monitoring des logs activé

---

## 🎉 C'est Prêt!

Une fois tout configuré, ton application sera accessible sur:
- **URL Web:** `https://sadek-bot-saas.onrender.com`
- **Worker Telegram:** Tourne en arrière-plan 24/7
- **Webhooks:** Stripe et Telegram configurés

**Note:** Render peut mettre quelques secondes à démarrer après une période d'inactivité (sur le plan gratuit). Pour éviter ça, upgrade vers un plan payant ou utilise un service de monitoring qui ping ton app régulièrement.

