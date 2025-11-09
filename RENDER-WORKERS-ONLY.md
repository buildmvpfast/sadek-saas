# Déploiement des Workers sur Render (App sur Vercel)

## 📋 Situation

- ✅ **Application Next.js:** Déjà sur Vercel
- 🔄 **Workers à déployer sur Render:**
  1. Worker Telegram Trades (exécute les trades Telegram)
  2. Worker Copy Trading (optionnel - si tu utilises le copy trading admin)

---

## 🚀 Étape 1: Créer le Worker Telegram Trades

### 1.1 Aller sur Render Dashboard

1. Aller sur [https://dashboard.render.com](https://dashboard.render.com)
2. Se connecter ou créer un compte
3. Cliquer sur **"New +"** en haut à droite
4. Sélectionner **"Background Worker"**

### 1.2 Connecter le Repository

1. **Connect to:** GitHub (ou GitLab/Bitbucket si tu utilises ça)
2. Si c'est la première fois, autoriser Render à accéder à ton compte
3. **Sélectionner le repository:** `sadek bot saas` (ou le nom de ton repo)
4. Cliquer sur **"Connect"**

### 1.3 Configurer le Worker

**Nom du service:**
```
sadek-telegram-trades-worker
```

**Configuration:**
- **Environment:** `Node`
- **Region:** Choisir la région la plus proche (ex: Frankfurt, Ireland)
- **Branch:** `main` (ou la branche que tu utilises)
- **Root Directory:** Laisser vide (ou `.` si nécessaire)
- **Build Command:** `npm install`
- **Start Command:** `npm run telegram-trades`
- **Plan:** 
  - **Starter** (gratuit mais peut s'endormir après 15 min d'inactivité)
  - **Standard** (recommandé pour la production - $7/mois)

### 1.4 Ajouter les Variables d'Environnement

Cliquer sur **"Advanced"** → **"Add Environment Variable"** et ajouter:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
METAAPI_TOKEN=ton_token_metaapi
```

**⚠️ Important:** 
- Utilise `SUPABASE_SERVICE_ROLE_KEY` (pas `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- Ne pas mettre `NEXT_PUBLIC_APP_URL` (pas nécessaire pour le worker)

### 1.5 Créer le Worker

1. Cliquer sur **"Create Background Worker"**
2. Render va automatiquement:
   - Cloner le repo
   - Installer les dépendances
   - Lancer le worker

3. Attendre que le statut passe à **"Live"** (vert)

### 1.6 Vérifier que ça Fonctionne

1. Cliquer sur le service dans le dashboard
2. Aller dans l'onglet **"Logs"**
3. Tu devrais voir:
   ```
   🚀 Service d'exécution des trades Telegram démarré
   ⏱️  Vérification toutes les 5 secondes...
   🔍 Recherche des trades en attente...
   ✅ Aucun trade en attente
   ```

---

## 🔄 Étape 2: Créer le Worker Copy Trading (Optionnel)

**⚠️ Seulement si tu utilises le copy trading admin (pas Telegram)**

### 2.1 Créer un Nouveau Worker

1. **"New +"** → **"Background Worker"**
2. Connecter le même repository

### 2.2 Configurer

**Nom:**
```
sadek-copy-trading-worker
```

**Configuration:**
- **Environment:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `npm run copy-trading`
- **Plan:** Standard recommandé

### 2.3 Variables d'Environnement

Mêmes variables que le worker Telegram:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
METAAPI_TOKEN=ton_token_metaapi
```

---

## 🔗 Étape 3: Configurer les Webhooks (Vercel)

### 3.1 Stripe Webhook

Puisque ton app est sur Vercel, le webhook Stripe doit pointer vers Vercel:

1. Aller sur [Stripe Dashboard](https://dashboard.stripe.com)
2. **Developers** → **Webhooks**
3. Cliquer sur **"Add endpoint"**
4. **Endpoint URL:** `https://ton-app.vercel.app/api/webhook`
   - Remplace `ton-app.vercel.app` par ton vrai domaine Vercel
5. **Description:** "Sadek Bot SaaS - Webhook Production"
6. **Events to send:**
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
7. Cliquer sur **"Add endpoint"**
8. **Récupérer le secret** (commence par `whsec_...`)
9. **Ajouter dans Vercel** comme variable d'environnement:
   - Aller sur [Vercel Dashboard](https://vercel.com/dashboard)
   - Sélectionner ton projet
   - **Settings** → **Environment Variables**
   - Ajouter: `STRIPE_WEBHOOK_SECRET=whsec_...`
   - **Redeploy** l'application

### 3.2 Telegram Webhook

Le webhook Telegram doit aussi pointer vers Vercel:

```bash
curl -X POST "https://api.telegram.org/bot7958247845:AAFPfntvvND10uCs7AX6UPC5Dz4a_Dc17bc/setWebhook" \
  -d "url=https://ton-app.vercel.app/api/telegram/webhook"
```

**Vérifier:**
```bash
curl "https://api.telegram.org/bot7958247845:AAFPfntvvND10uCs7AX6UPC5Dz4a_Dc17bc/getWebhookInfo"
```

---

## ✅ Étape 4: Vérification Finale

### Checklist

- [ ] Worker Telegram créé sur Render et statut "Live"
- [ ] Logs du worker montrent "Service démarré"
- [ ] Variables d'environnement configurées dans Render
- [ ] Webhook Stripe configuré vers Vercel
- [ ] `STRIPE_WEBHOOK_SECRET` ajouté dans Vercel
- [ ] Webhook Telegram configuré vers Vercel
- [ ] Test d'un signal Telegram (message → parsing → trade créé)
- [ ] Vérifier que le worker exécute le trade (logs Render)

---

## 🐛 Dépannage

### Problème: Worker ne démarre pas

**Solutions:**
- Vérifier les logs Render pour voir l'erreur
- Vérifier que `npm run telegram-trades` fonctionne en local
- Vérifier que toutes les variables d'environnement sont définies

### Problème: "Cannot find module"

**Solutions:**
- Vérifier que `package.json` contient toutes les dépendances
- Vérifier que le `Build Command` est `npm install`
- Redéployer le worker

### Problème: Trades Telegram ne s'exécutent pas

**Solutions:**
- Vérifier les logs du worker Render
- Vérifier que `METAAPI_TOKEN` est correct
- Vérifier que les comptes MT5 ont un `metaapi_account_id`
- Vérifier que les utilisateurs ont un abonnement actif

### Problème: Worker s'endort (plan gratuit)

**Solutions:**
- Upgrade vers le plan Standard ($7/mois)
- Ou utiliser un service de monitoring qui ping le worker régulièrement
- Ou utiliser un cron job externe qui appelle l'API `/api/telegram/execute-trades`

---

## 💰 Coûts Render

- **Starter (Gratuit):**
  - 750 heures/mois
  - S'endort après 15 min d'inactivité
  - Redémarre au prochain appel (peut prendre 30-60 secondes)

- **Standard ($7/mois):**
  - Tourne 24/7 sans interruption
  - Pas de limite d'heures
  - Recommandé pour la production

---

## 📊 Monitoring

### Voir les Logs en Temps Réel

1. Dans Render Dashboard
2. Cliquer sur ton worker
3. Onglet **"Logs"**
4. Tu verras tous les logs en temps réel

### Logs Importants

- ✅ `Service démarré` - Worker lancé
- 🔍 `Recherche des trades en attente` - Vérification en cours
- ✅ `Trade X exécuté` - Trade réussi
- ❌ `Erreur trade X` - Trade échoué

---

## 🎯 Résumé

**Architecture finale:**

```
Vercel (App Next.js)
├── Frontend
├── API Routes (/api/webhook, /api/telegram/webhook, etc.)
└── Variables d'environnement (Stripe, Supabase, Telegram, etc.)

Render (Workers)
├── Worker Telegram Trades (npm run telegram-trades)
│   └── Exécute les trades Telegram toutes les 5 secondes
└── Worker Copy Trading (optionnel)
    └── Exécute le copy trading admin
```

**Flux Telegram:**
1. Message Telegram → Webhook Vercel (`/api/telegram/webhook`)
2. Parsing → Création trade `pending` dans DB
3. Worker Render → Détecte trade `pending`
4. Worker Render → Exécute via MetaAPI
5. Worker Render → Met à jour statut `executed`

---

## 🚀 C'est Prêt!

Une fois tout configuré:
- ✅ Les messages Telegram seront parsés par Vercel
- ✅ Les trades seront exécutés automatiquement par le worker Render
- ✅ Tout fonctionne 24/7 (avec plan Standard)

