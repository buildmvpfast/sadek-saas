# 🚀 Guide de Déploiement Complet - L'IMPRIMANTE

## Architecture

```
┌─────────────────────────────┐
│  Vercel                     │  → Frontend Next.js + API Routes
│  https://ton-app.vercel.app │     (Pages, Auth, Dashboard)
└─────────────────────────────┘

┌─────────────────────────────┐
│  Render                     │  → Backend Copy Trading 24/7
│  https://backend.onrender   │     (Monitoring positions admin)
└─────────────────────────────┘

┌─────────────────────────────┐
│  Supabase                   │  → Database
│  https://xxxxx.supabase.co  │     (Users, MT5, Trades)
└─────────────────────────────┘

┌─────────────────────────────┐
│  MetaApi                    │  → MT5 API
│  https://metaapi.cloud      │     (Connexion MT5)
└─────────────────────────────┘
```

---

## 📦 Étape 1: Déployer le Frontend (Vercel)

### A. Préparer le Repo

```bash
git add .
git commit -m "feat: complete copy trading system"
git push origin main
```

### B. Créer le Projet Vercel

1. Va sur https://vercel.com
2. Clique **"Add New Project"**
3. Import ton repo GitHub
4. **Root Directory:** `.` (racine)
5. **Framework Preset:** Next.js
6. Clique **"Deploy"**

### C. Ajouter les Variables d'Environnement

Dans Vercel → Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
METAAPI_TOKEN=eyJhbGc...
NEXT_PUBLIC_APP_URL=https://ton-app.vercel.app
```

### D. Redéployer

Clique **"Redeploy"** après avoir ajouté les variables.

**✅ Frontend déployé:** `https://ton-app.vercel.app`

---

## 🔧 Étape 2: Déployer le Backend (Render)

### A. Créer un Web Service

1. Va sur https://render.com
2. Clique **"New +"** → **"Web Service"**
3. Connecte ton repo GitHub
4. Sélectionne ton repo

### B. Configuration

**Name:** `limprimante-backend`

**Root Directory:**
```
backend
```

**Environment:** `Node`

**Region:** `Frankfurt (EU Central)` (ou proche de toi)

**Branch:** `main`

**Build Command:**
```bash
npm install && npm run build
```

**Start Command:**
```bash
npm start
```

**Instance Type:** `Starter` (gratuit pour commencer)

### C. Ajouter les Variables d'Environnement

Dans Render → Environment:

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
METAAPI_TOKEN=eyJhbGc...
PORT=4000
NODE_ENV=production
AUTO_START=true
```

**Important:** `AUTO_START=true` démarre automatiquement le monitoring!

### D. Créer le Service

Clique **"Create Web Service"**

Render va build et déployer. Ça prend 2-3 minutes.

**✅ Backend déployé:** `https://limprimante-backend.onrender.com`

### E. Vérifier que Ça Marche

```bash
# Health check
curl https://limprimante-backend.onrender.com/health

# Vérifier le statut
curl https://limprimante-backend.onrender.com/api/status
```

Tu devrais voir:
```json
{
  "status": "ok",
  "monitoring": true
}
```

---

## 📊 Étape 3: Configurer Supabase

### A. Ajouter l'URL Vercel aux Redirect URLs

1. Va sur https://supabase.com/dashboard
2. Sélectionne ton projet
3. **Authentication** → **URL Configuration**
4. Ajoute:

```
Site URL:
https://ton-app.vercel.app

Redirect URLs:
https://ton-app.vercel.app/**
https://ton-app.vercel.app/auth/callback
http://localhost:3000/** (pour dev local)
```

### B. Exécuter les Scripts SQL

Dans **SQL Editor**:

1. **Copie et exécute** `supabase-admin-copy-trading.sql`
2. **Copie et exécute** `supabase-create-admin-simple.sql` (pour créer le compte admin)

---

## ✅ Étape 4: Vérification Finale

### A. Frontend

1. Va sur `https://ton-app.vercel.app`
2. Teste la page d'accueil
3. Teste signup/login
4. Vérifie le dashboard

### B. Backend

1. Va sur `https://limprimante-backend.onrender.com/health`
2. Vérifie que `"monitoring": true`
3. Regarde les logs dans Render Dashboard

### C. Copy Trading

1. Login en tant qu'admin: `sadek@admin.cupped` / `Qwerty123.123`
2. Va sur `/admin/mt5-accounts`
3. Ajoute ton compte MT5
4. Le backend va automatiquement détecter les positions!

---

## 🎯 Architecture Finale

```
Frontend (Vercel)
↓
├── Pages Next.js
├── API Routes
└── Appels au Backend

Backend (Render)
↓
├── Monitoring 24/7
├── Détection positions
├── Copy trading
└── Logs en temps réel

Database (Supabase)
↓
├── Users & Profiles
├── MT5 Accounts
├── Trading Settings
└── Copy Trades History
```

---

## 🔄 Workflow de Mise à Jour

Quand tu push du code:

```bash
git add .
git commit -m "update: amélioration"
git push origin main
```

**Automatiquement:**
- ✅ Vercel redéploie le frontend
- ✅ Render redéploie le backend
- ✅ Tout est mis à jour!

---

## 📊 Monitoring

### Logs Frontend (Vercel)

Vercel Dashboard → Ton projet → **Logs**

### Logs Backend (Render)

Render Dashboard → Ton service → **Logs**

Tu verras:
```
🚀 L'IMPRIMANTE Copy Trading Backend
✅ Server running on port 4000
🔄 Auto-starting monitoring...
📊 Monitoring du compte admin: 123456789
🆕 Nouvelle position détectée: XAUUSD BUY
✅ Ordre copié pour user 987654
```

---

## 💰 Coûts

### Gratuit pour Commencer:

- **Vercel:** Gratuit (Hobby plan)
- **Render:** Gratuit (750h/mois)
- **Supabase:** Gratuit (500MB database)
- **MetaApi:** Gratuit (1 compte)

### En Production:

- **Vercel Pro:** $20/mois (si besoin)
- **Render Starter:** $7/mois (pour 24/7 garanti)
- **Supabase Pro:** $25/mois (si >500MB)
- **MetaApi:** $89/mois (illimité)

**Total minimum:** $0/mois pour tester! 🎉

---

## 🆘 Troubleshooting

### Frontend ne charge pas

1. Vérifie les variables d'env dans Vercel
2. Check les logs Vercel
3. Vérifie que Supabase URLs sont corrects

### Backend ne monitore pas

1. Vérifie les logs Render
2. Vérifie `AUTO_START=true`
3. Vérifie qu'il y a un compte admin dans Supabase
4. Vérifie le token MetaApi

### Copy trading ne fonctionne pas

1. Vérifie que le backend tourne (health check)
2. Vérifie qu'il y a un compte admin avec `is_admin_account = true`
3. Vérifie que les users ont un abonnement actif
4. Vérifie que les users ont configuré leurs settings

---

## 🎉 C'est Prêt!

Ton système de copy trading tourne maintenant **24/7** dans le cloud! 🚀

**URLs importantes:**
- Frontend: `https://ton-app.vercel.app`
- Backend: `https://backend.onrender.com`
- Supabase: `https://xxxxx.supabase.co`

Bon trading! 💰

