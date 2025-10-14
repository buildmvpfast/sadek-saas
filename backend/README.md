# 🚀 L'IMPRIMANTE - Copy Trading Backend

Backend service pour le copy trading automatique MT5.

## 📋 Fonctionnalités

- ✅ Monitoring continu des positions admin (toutes les 5 secondes)
- ✅ Copy trading automatique sur tous les users
- ✅ Mapping des symboles par broker
- ✅ Adaptation des lots selon les settings utilisateur
- ✅ API REST pour contrôler le service
- ✅ Health checks
- ✅ Graceful shutdown

---

## 🔧 Installation Locale

### 1. Installer les dépendances

```bash
cd backend
npm install
```

### 2. Configurer les variables d'environnement

Copier `.env.example` vers `.env`:

```bash
cp .env.example .env
```

Remplir les valeurs:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
METAAPI_TOKEN=eyJhbGc...
PORT=4000
NODE_ENV=development
```

### 3. Démarrer en mode développement

```bash
npm run dev
```

Le serveur démarre sur `http://localhost:4000`

---

## 🚀 Déploiement sur Render

### Étape 1: Créer un Web Service

1. Va sur https://render.com
2. Connecte ton repo GitHub
3. Clique **"New +"** → **"Web Service"**
4. Sélectionne ton repo

### Étape 2: Configuration

**Root Directory:**
```
backend
```

**Build Command:**
```bash
npm install && npm run build
```

**Start Command:**
```bash
npm start
```

**Environment:**
- Node
- Branch: `main`

### Étape 3: Variables d'Environnement

Ajoute ces variables dans Render:

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
METAAPI_TOKEN=eyJhbGc...
PORT=4000
NODE_ENV=production
AUTO_START=true
```

**Important:** `AUTO_START=true` démarre automatiquement le monitoring!

### Étape 4: Déployer

Clique **"Create Web Service"**

Render va:
1. Cloner ton repo
2. Installer les dépendances
3. Build le TypeScript
4. Démarrer le serveur
5. Le service démarre automatiquement le monitoring

---

## 📡 API Endpoints

### Health Check

```bash
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "service": "L'IMPRIMANTE Copy Trading Backend",
  "version": "1.0.0",
  "uptime": 12345,
  "monitoring": true
}
```

### Démarrer le Monitoring

```bash
POST /api/start
```

**Response:**
```json
{
  "success": true,
  "message": "Copy trading service started successfully"
}
```

### Arrêter le Monitoring

```bash
POST /api/stop
```

**Response:**
```json
{
  "success": true,
  "message": "Copy trading service stopped"
}
```

### Statut du Service

```bash
GET /api/status
```

**Response:**
```json
{
  "success": true,
  "running": true,
  "uptime": 12345
}
```

---

## 🔄 Workflow de Développement

### Développement local:

```bash
# Terminal 1: Frontend (dans le dossier racine)
cd ..
npm run dev

# Terminal 2: Backend
cd backend
npm run dev
```

### Tester l'API:

```bash
# Health check
curl http://localhost:4000/health

# Démarrer le monitoring
curl -X POST http://localhost:4000/api/start

# Vérifier le statut
curl http://localhost:4000/api/status

# Arrêter le monitoring
curl -X POST http://localhost:4000/api/stop
```

---

## 🎯 Architecture

```
backend/
├── src/
│   ├── server.ts                      # Serveur Express principal
│   └── services/
│       └── MetaApiPositionMonitor.ts  # Service de monitoring
├── dist/                              # Compiled JS (après build)
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## 📊 Logs

Le backend affiche des logs détaillés:

```
🚀 L'IMPRIMANTE Copy Trading Backend
=====================================
✅ Server running on port 4000
📊 Health check: http://localhost:4000/health
🎛️ API: http://localhost:4000/api

🔄 Auto-starting monitoring...
📊 Monitoring du compte admin: 123456789
✅ 1 compte(s) admin trouvé(s)
🆕 Nouvelle position détectée: XAUUSD BUY
✅ Symbole mappé: XAUUSD → GOLD
📤 Copie de la position sur les comptes utilisateurs...
✅ 3 utilisateur(s) éligible(s)
📊 User 987654: GOLD 0.01 lots
✅ Ordre copié pour user 987654
```

---

## 🔒 Sécurité

- ✅ Variables d'environnement pour les secrets
- ✅ CORS configuré
- ✅ Graceful shutdown
- ✅ Error handling complet

---

## 🆘 Troubleshooting

### Le service ne démarre pas

```bash
# Vérifier les logs
npm run dev

# Vérifier les variables d'environnement
cat .env
```

### Le monitoring ne se lance pas

Vérifier:
1. `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont corrects
2. `METAAPI_TOKEN` est valide
3. Il existe au moins 1 compte admin avec `is_admin_account = true`

### Sur Render, ça ne marche pas

1. Vérifie les logs dans le dashboard Render
2. Vérifie que toutes les variables d'env sont définies
3. Vérifie que `AUTO_START=true` est défini

---

## 📞 Support

Pour toute question, vérifie:
- Les logs du serveur
- Les logs dans Render
- La base de données Supabase

---

## 🎉 C'est Prêt!

Une fois déployé sur Render, ton backend tournera **24/7** et copiera automatiquement tous les trades!

**URL de ton backend:** `https://ton-service.onrender.com`

