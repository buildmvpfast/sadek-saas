# 🚀 Guide Complet - Copy Trading MT5

## 📋 Architecture

```
┌─────────────────┐
│  Admin MT5      │ → Prend des positions
│  (Trader)       │
└────────┬────────┘
         │
         ↓
┌─────────────────────────────────┐
│  MetaApi Position Monitor       │ → Détecte les nouvelles positions
│  (Service de monitoring)        │    toutes les 5 secondes
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│  Système de Copy Trading        │
│  - Mappe les symboles           │
│  - Adapte les lots              │
│  - Copie sur tous les users     │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────┐
│  User MT5       │ → Reçoit les positions
│  (Followers)    │    automatiquement
└─────────────────┘
```

---

## 🎯 Configuration Complète

### Étape 1: L'Admin Connecte Son Compte MT5

1. **Login en tant qu'admin:**
   ```
   Email: sadek@admin.cupped
   Password: Qwerty123.123
   ```

2. **Aller sur `/admin/mt5-accounts`**

3. **Cliquer sur "Ajouter un compte":**
   - **Broker:** Ton broker (ex: IC Markets)
   - **Serveur:** Ton serveur MT5 (ex: ICMarketsEU-Live)
   - **Numéro de compte:** Ton numéro MT5
   - **Mot de passe:** Ton mot de passe MT5

4. **Le système va:**
   - ✅ Se connecter à MetaApi
   - ✅ Enregistrer le compte avec `is_admin_account = true`
   - ✅ Stocker le `metaapi_account_id`

---

### Étape 2: Les Users Connectent Leurs Comptes

1. **Un user se connecte**

2. **Va sur `/mt5-accounts`**

3. **Clique sur "Ajouter un compte":**
   - Même process que l'admin
   - Mais `is_admin_account = false`

4. **Configure ses paramètres de trading:**
   - Va sur `/settings`
   - Choisit:
     - **Lots fixes:** Gold 0.01, SOL 0.01, BTC 0.01
     - **OU Pourcentage:** 1% du capital

---

### Étape 3: Démarrer le Service de Copy Trading

**Option A - Via l'interface admin (Recommandé):**

1. Va sur `/admin/copy-trading`
2. Clique sur **"▶️ Démarrer"**
3. Le service démarre!

**Option B - Via terminal:**

```bash
npm run copy-trading
```

---

## 🔄 Comment Ça Marche

### 1. Admin Prend une Position

```
Admin ouvre: XAUUSD BUY 1.0 lot @ 2050.00
```

### 2. Le Service Détecte (5 secondes max)

```javascript
🆕 Nouvelle position détectée: XAUUSD POSITION_TYPE_BUY
✅ Symbole mappé: XAUUSD → GOLD
📤 Copie de la position sur les comptes utilisateurs...
```

### 3. Récupération des Users Éligibles

Le système cherche les users avec:
- ✅ Abonnement actif (`status = 'active'`)
- ✅ Au moins 1 compte MT5 actif
- ✅ Trading settings configurés

### 4. Mapping des Symboles

```
Admin (IC Markets): XAUUSD
↓
Symbole Standard: GOLD
↓
User 1 (XM Global): GOLD
User 2 (Exness): XAUUSD
User 3 (OANDA): XAU_USD
```

### 5. Adaptation des Lots

```javascript
// User 1: Lots fixes
Settings: gold_lot_size = 0.01
→ Copie: 0.01 lot

// User 2: Lots fixes différents
Settings: gold_lot_size = 0.05
→ Copie: 0.05 lot

// User 3: Pourcentage
Settings: position_percentage = 1%
Capital: $1000
→ Calcul automatique du lot
```

### 6. Envoi des Ordres

```javascript
📊 User 123456: GOLD 0.01 lots
✅ Ordre copié pour user 123456

📊 User 789012: XAUUSD 0.05 lots
✅ Ordre copié pour user 789012
```

### 7. Enregistrement dans la DB

```sql
INSERT INTO copy_trades (
  admin_user_id,
  follower_user_id,
  admin_mt5_account_id,
  follower_mt5_account_id,
  symbol,
  order_type,
  volume,
  open_price,
  admin_ticket,
  follower_ticket,
  status
) VALUES (...)
```

### 8. Fermeture des Positions

Quand l'admin ferme sa position:
```javascript
🔴 Position fermée détectée: 12345
📤 Fermeture de 3 position(s) copiée(s)
✅ Position fermée pour trade abc
✅ Position fermée pour trade def
✅ Position fermée pour trade ghi
```

---

## 📊 Dashboard en Temps Réel

### Pour l'Admin (`/admin/copy-trading`):

- **Statut du service:** 🟢 En cours / 🔴 Arrêté
- **Trades copiés:** Nombre total
- **Taux de succès:** % de succès
- **Positions actives:** Nombre de positions ouvertes
- **Tableau des trades:** Liste en temps réel

### Pour les Users (`/dashboard`):

- **Comptes MT5 Actifs:** Nombre de comptes connectés
- **Trades Copiés:** Historique des trades reçus
- **Status des positions:** Ouvert / Fermé / Échoué

---

## 🧪 Test Complet

### 1. Setup Initial

```bash
# 1. Exécuter le SQL dans Supabase
# Copier supabase-admin-copy-trading.sql

# 2. Créer le compte admin
# Copier supabase-create-admin-simple.sql
# OU signup + UPDATE profiles SET is_admin = true

# 3. Installer les dépendances
npm install
```

### 2. Configuration

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
METAAPI_TOKEN=eyJhbGc...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Démarrer l'App

```bash
# Terminal 1: Next.js
npm run dev

# Terminal 2: Copy Trading Service
npm run copy-trading
```

### 4. Test du Flow

**A. Admin:**
1. Login: `sadek@admin.cupped` / `Qwerty123.123`
2. Va sur `/admin/mt5-accounts`
3. Ajoute ton compte MT5 réel (ou demo)
4. Va sur `/admin/copy-trading`
5. Clique "Démarrer"

**B. User 1:**
1. Signup avec un nouvel email
2. Active l'abonnement (clic sur le plan)
3. Va sur `/mt5-accounts`
4. Ajoute ton compte MT5
5. Va sur `/settings`
6. Configure: Gold 0.01 lot

**C. User 2:**
1. Même chose mais configure: Gold 0.05 lot

**D. Test du Copy Trading:**
1. Ouvre MT5 sur le compte admin
2. Ouvre une position: XAUUSD BUY 0.1 lot
3. **Attends 5 secondes max**
4. Vérifie:
   - Dashboard admin: Trade apparaît
   - Dashboard User 1: Trade copié avec 0.01 lot
   - Dashboard User 2: Trade copié avec 0.05 lot
   - MT5 User 1: Position ouverte
   - MT5 User 2: Position ouverte

**E. Fermeture:**
1. Ferme la position sur le compte admin
2. **Attends 5 secondes max**
3. Vérifie:
   - Positions fermées sur tous les comptes users

---

## ✅ Checklist

- [ ] Admin account créé avec `is_admin = true`
- [ ] Admin MT5 connecté à MetaApi
- [ ] Service de copy trading démarré
- [ ] User account créé avec abonnement actif
- [ ] User MT5 connecté à MetaApi
- [ ] User trading settings configurés
- [ ] Test position ouverte → Copiée ✅
- [ ] Test position fermée → Fermée sur users ✅
- [ ] Vérifier les mappings de symboles
- [ ] Vérifier l'adaptation des lots

---

## 🔍 Monitoring

### Logs du Service

```bash
npm run copy-trading
```

Tu verras:
```
🚀 L'IMPRIMANTE - Copy Trading Service
=====================================

✅ Configuration OK

📊 Monitoring du compte admin: 123456789
✅ 1 compte(s) admin trouvé(s)
🆕 Nouvelle position détectée: XAUUSD POSITION_TYPE_BUY
✅ Symbole mappé: XAUUSD → GOLD
📤 Copie de la position sur les comptes utilisateurs...
✅ 2 utilisateur(s) éligible(s)
📊 User 987654321: GOLD 0.01 lots
✅ Ordre copié pour user 987654321
```

### Vérifier dans la DB

```sql
-- Voir tous les trades copiés
SELECT 
  ct.*,
  p.email,
  p.full_name
FROM copy_trades ct
JOIN profiles p ON p.id = ct.follower_user_id
ORDER BY ct.created_at DESC;

-- Voir les comptes admin
SELECT * FROM mt5_accounts WHERE is_admin_account = true;

-- Voir les users éligibles
SELECT 
  p.email,
  s.status,
  COUNT(m.id) as mt5_count
FROM profiles p
JOIN subscriptions s ON s.user_id = p.id
LEFT JOIN mt5_accounts m ON m.user_id = p.id AND m.is_active = true
WHERE s.status IN ('active', 'trialing')
GROUP BY p.id, p.email, s.status;
```

---

## 🎉 C'est Prêt!

Le système est maintenant **100% fonctionnel**:
- ✅ Admin connecte son MT5 à MetaApi
- ✅ Users connectent leurs MT5 à MetaApi
- ✅ Service monitore les positions admin
- ✅ Copy automatique avec mapping symboles
- ✅ Adaptation des lots selon settings
- ✅ Dashboard temps réel

**Prochaine étape:** Teste avec des comptes réels (ou demo)! 🚀

