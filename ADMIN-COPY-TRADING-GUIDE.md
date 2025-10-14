# 🎯 Guide Complet - Copy Trading Admin

## 📋 Table des Matières

1. [Installation de la Base de Données](#installation)
2. [Configuration des Comptes Admin](#comptes-admin)
3. [Configuration Utilisateur](#configuration-utilisateur)
4. [Démarrage du Service](#demarrage)
5. [Monitoring et Statistiques](#monitoring)
6. [Mapping des Symboles](#mapping)
7. [Troubleshooting](#troubleshooting)

---

## 🗄️ Installation de la Base de Données {#installation}

### 1. Exécuter le script SQL

Copiez le contenu de `supabase-admin-copy-trading.sql` dans l'éditeur SQL de Supabase et exécutez-le.

Ce script va:
- ✅ Ajouter `is_admin_account` et `metaapi_account_id` à `mt5_accounts`
- ✅ Modifier `trading_settings` pour les lots par instrument (gold, sol, btc)
- ✅ Créer la table `symbol_mappings` avec 60+ mappings pré-configurés
- ✅ Supprimer l'ancienne table `brokers` (remplacée par les noms directs)
- ✅ Ajouter des policies RLS pour les admins
- ✅ Créer des fonctions helpers pour le mapping de symboles

### 2. Vérifier l'installation

```sql
-- Vérifier que la table symbol_mappings existe
SELECT COUNT(*) FROM symbol_mappings;
-- Devrait retourner ~60 lignes

-- Vérifier la structure de mt5_accounts
SELECT is_admin_account, broker_name, server_name, metaapi_account_id 
FROM mt5_accounts 
LIMIT 1;
```

---

## 👤 Configuration des Comptes Admin {#comptes-admin}

### 1. Accéder à la page Admin MT5

```
http://localhost:3000/admin/mt5-accounts
```

### 2. Ajouter un compte MT5 admin

1. Cliquez sur **"+ Ajouter un compte"**
2. Sélectionnez votre **broker** (ex: IC Markets, XM, Exness)
3. Sélectionnez votre **serveur** (chargé dynamiquement)
4. Entrez votre **numéro de compte MT5**
5. Entrez votre **mot de passe MT5**
6. Cliquez sur **"✓ Ajouter le compte admin"**

Le système va:
- ✅ Connecter le compte à MetaApi
- ✅ Enregistrer dans Supabase avec `is_admin_account = true`
- ✅ Activer le compte automatiquement

### 3. Vérifier la connexion

Le compte devrait apparaître avec:
- Badge **"🎯 ADMIN"**
- Status **"✓ Actif"**
- MetaApi ID visible

---

## ⚙️ Configuration Utilisateur {#configuration-utilisateur}

### 1. Les utilisateurs doivent configurer leurs paramètres

Page: `http://localhost:3000/settings`

### Options de configuration:

#### **Option A: Lots Fixes** (Recommandé pour débutants)
```
🪙 GOLD: 0.01 lots
⚡ SOL30: 0.01 lots
₿ BTC: 0.01 lots
```

**Exemple:**
- Admin ouvre XAUUSD 1.0 lot → User copie 0.01 lot
- Admin ouvre BTCUSD 0.5 lot → User copie 0.01 lot

#### **Option B: Pourcentage du Capital**
```
Pourcentage: 1% du capital
```

**Exemple:**
- Capital user: $1,000
- 1% = $10 par trade
- Le système calcule automatiquement le lot selon le prix

---

## 🚀 Démarrage du Service {#demarrage}

### Méthode 1: Via l'interface Admin (Recommandé)

1. Allez sur: `http://localhost:3000/admin/copy-trading`
2. Cliquez sur **"▶️ Démarrer"**
3. Le service se lance immédiatement

**Avantages:**
- ✅ Interface graphique
- ✅ Statistiques en temps réel
- ✅ Pas besoin de terminal

### Méthode 2: Via la ligne de commande

```bash
npm run copy-trading-v2
```

**Avantages:**
- ✅ Logs détaillés
- ✅ Contrôle total
- ✅ Debugging facile

---

## 📊 Monitoring et Statistiques {#monitoring}

### Dashboard Copy Trading

Page: `http://localhost:3000/admin/copy-trading`

**Métriques affichées:**
- 📈 **Trades Copiés:** Nombre total de positions copiées
- ✅ **Taux de Succès:** % de trades réussis
- 🔄 **Positions Actives:** Nombre de positions ouvertes

**Tableau des trades:**
- Utilisateur
- Symbole (GOLD, SOL30, BTC)
- Type (BUY/SELL)
- Volume (lots)
- Statut (opened/closed/failed)
- Date et heure

### Rafraîchissement automatique

Le dashboard se rafraîchit toutes les **10 secondes** automatiquement.

---

## 🔄 Mapping des Symboles {#mapping}

Le système mappe automatiquement les symboles entre les brokers.

### Exemples de Mapping:

| Symbole Standard | IC Markets | XM Global | Exness | FTMO |
|-----------------|------------|-----------|--------|------|
| **GOLD** | XAUUSD | GOLD | XAUUSD | XAUUSD |
| **SOL30** | SOL30 | SOLUSDT | SOLUSDT | SOL30 |
| **BTC** | BTCUSD | BITCOIN | BTCUSD | BTCUSD |

### Comment ça marche?

1. **Admin trade:** Ouvre XAUUSD sur IC Markets
2. **Système détecte:** Symbole = XAUUSD → Standard = GOLD
3. **Mapping utilisateur:**
   - User sur XM → Ouvre GOLD
   - User sur Exness → Ouvre XAUUSD
   - User sur FTMO → Ouvre XAUUSD

### Ajouter un nouveau mapping

```sql
INSERT INTO symbol_mappings (broker_name, standard_symbol, broker_symbol) 
VALUES ('Mon Broker', 'GOLD', 'XAUUSD.X');
```

---

## 🔧 Troubleshooting {#troubleshooting}

### Problème 1: "Aucun compte admin trouvé"

**Solution:**
1. Allez sur `/admin/mt5-accounts`
2. Ajoutez un compte avec le flag `is_admin_account = true`
3. Vérifiez que `is_active = true`

### Problème 2: "Les trades ne se copient pas"

**Vérifications:**
1. ✅ Service de copy trading est démarré?
2. ✅ Compte admin est actif?
3. ✅ Utilisateurs ont un abonnement actif?
4. ✅ Utilisateurs ont configuré leurs settings?
5. ✅ Utilisateurs ont au moins 1 compte MT5 actif?

**Debug:**
```bash
# Vérifier les comptes admin
SELECT * FROM mt5_accounts WHERE is_admin_account = true;

# Vérifier les utilisateurs éligibles
SELECT p.id, p.email, s.status, COUNT(m.id) as mt5_count
FROM profiles p
JOIN subscriptions s ON s.user_id = p.id
LEFT JOIN mt5_accounts m ON m.user_id = p.id AND m.is_active = true
WHERE s.status IN ('active', 'trialing')
GROUP BY p.id, p.email, s.status;
```

### Problème 3: "Symbol not found" ou "Trade failed"

**Causes possibles:**
1. Symbole pas mappé pour ce broker
2. Symbole pas disponible sur le compte utilisateur
3. Marché fermé

**Solution:**
```sql
-- Vérifier le mapping
SELECT * FROM symbol_mappings 
WHERE broker_name = 'IC Markets' AND standard_symbol = 'GOLD';

-- Ajouter un mapping si manquant
INSERT INTO symbol_mappings (broker_name, standard_symbol, broker_symbol)
VALUES ('IC Markets', 'GOLD', 'XAUUSD');
```

### Problème 4: "MetaApi connection failed"

**Solution:**
1. Vérifier que `METAAPI_TOKEN` est dans `.env.local`
2. Vérifier que le compte MetaApi est déployé
3. Attendre 1-2 minutes pour la synchronisation

```bash
# Tester la connexion MetaApi
curl -H "auth-token: VOTRE_TOKEN" \
  https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts
```

### Problème 5: "Positions closes not detected"

**Explication:** Le système vérifie toutes les 5 secondes. Une position fermée sera détectée dans les 5 secondes.

Si ce n'est pas le cas:
1. Vérifier les logs du service
2. Vérifier que `admin_ticket` est bien enregistré dans `copy_trades`

---

## 📝 Logs et Debugging

### Logs du service

Quand vous lancez via terminal:
```bash
npm run copy-trading-v2
```

Vous verrez:
```
🚀 L'IMPRIMANTE - Copy Trading Service
=====================================

✅ Configuration OK

📊 Monitoring du compte admin: 123456789
✅ 3 compte(s) admin trouvé(s)
🆕 Nouvelle position détectée: XAUUSD POSITION_TYPE_BUY
✅ Symbole mappé: XAUUSD → GOLD
📤 Copie de la position sur les comptes utilisateurs...
✅ 5 utilisateur(s) éligible(s)
📊 User 987654321: GOLD 0.01 lots
✅ Ordre copié pour user 987654321
```

### Check manuel dans la DB

```sql
-- Derniers trades copiés
SELECT 
  ct.*,
  p.full_name,
  m.broker_name
FROM copy_trades ct
JOIN profiles p ON p.id = ct.follower_user_id
JOIN mt5_accounts m ON m.id = ct.follower_mt5_account_id
ORDER BY ct.created_at DESC
LIMIT 10;
```

---

## 🎉 Félicitations!

Votre système de copy trading est maintenant opérationnel! 🚀

**Prochaines étapes:**
1. ✅ Testez avec un compte demo
2. ✅ Vérifiez les trades copiés
3. ✅ Surveillez les statistiques
4. ✅ Passez en production quand vous êtes prêt

**Support:**
- 📧 Check les logs pour diagnostics
- 📊 Utilisez le dashboard admin
- 🔍 Vérifiez les tables Supabase

Bon trading! 💰

