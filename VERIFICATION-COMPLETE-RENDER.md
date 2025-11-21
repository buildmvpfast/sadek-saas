# ✅ Vérification Complète - Système sur Render

## 📋 Architecture Actuelle

```
Render (Application Next.js)
├── Frontend (Pages, Dashboard, etc.)
├── API Routes
│   ├── /api/telegram/webhook → Reçoit les messages Telegram
│   ├── /api/telegram/parse-signal → Parse les signaux
│   ├── /api/telegram/execute-trades → Exécute les trades (appelé immédiatement après parsing)
│   ├── /api/metaapi/connect-account → Crée les comptes MetaAPI
│   ├── /api/metaapi/account-info → Récupère la balance
│   └── /api/webhook → Webhook Stripe
└── Variables d'environnement

Render (Background Worker)
└── Worker Telegram Trades (npm run telegram-trades)
    └── Vérifie les trades pending toutes les 5 secondes
```

## 🔍 Checklist de Vérification

### 1. Variables d'Environnement (Service Web Render)

Vérifier dans Render Dashboard → Ton service → Environment:

```bash
✅ NEXT_PUBLIC_SUPABASE_URL
✅ NEXT_PUBLIC_SUPABASE_ANON_KEY
✅ SUPABASE_SERVICE_ROLE_KEY
✅ STRIPE_SECRET_KEY
✅ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
✅ STRIPE_WEBHOOK_SECRET
✅ TELEGRAM_BOT_TOKEN=7958247845:AAFPfntvvND10uCs7AX6UPC5Dz4a_Dc17bc
✅ METAAPI_TOKEN
✅ NEXT_PUBLIC_APP_URL=https://ton-app.onrender.com
✅ OPENAI_API_KEY (optionnel mais recommandé)
```

### 2. Variables d'Environnement (Worker Telegram)

Vérifier dans Render Dashboard → Worker → Environment:

```bash
✅ NEXT_PUBLIC_SUPABASE_URL
✅ SUPABASE_SERVICE_ROLE_KEY
✅ METAAPI_TOKEN
```

**⚠️ Important:** Le worker n'a PAS besoin de `NEXT_PUBLIC_APP_URL`

### 3. Configuration Webhook Telegram

```bash
# Vérifier le webhook
curl "https://api.telegram.org/bot7958247845:AAFPfntvvND10uCs7AX6UPC5Dz4a_Dc17bc/getWebhookInfo"
```

**Doit retourner:**
```json
{
  "ok": true,
  "result": {
    "url": "https://ton-app.onrender.com/api/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

Si ce n'est pas bon, configurer:
```bash
curl -X POST "https://api.telegram.org/bot7958247845:AAFPfntvvND10uCs7AX6UPC5Dz4a_Dc17bc/setWebhook" \
  -d "url=https://ton-app.onrender.com/api/telegram/webhook"
```

### 4. Configuration Supabase

#### A. Canal Telegram configuré

```sql
SELECT * FROM telegram_channels WHERE is_active = true;
```

**Doit retourner au moins un canal.**

Si vide, ajouter:
```sql
INSERT INTO public.telegram_channels (name, username, description, is_active)
VALUES ('Mon Canal', 'moncanal', 'Signaux de trading', true);
```

#### B. Mappings de symboles configurés

```sql
SELECT broker_name, standard_symbol, broker_symbol 
FROM symbol_mappings 
WHERE broker_name IN ('VTmarker', 'Raise FX', 'FXcess', 'Axi')
ORDER BY broker_name, standard_symbol;
```

**Doit retourner:**
- GOLD → XAUUSD (pour chaque broker)
- SOL30 → SOL30 (pour chaque broker)
- BTC → BTCUSD (pour chaque broker)

Si vide, exécuter `supabase-symbol-mappings-actual-brokers.sql`

### 5. Test du Flow Complet

#### Test 1: User Connecte Son Compte

1. User va sur `/mt5-accounts`
2. Ajoute son compte MT5
3. ✅ Vérifier dans Render Logs: "Account created on MetaAPI"
4. ✅ Vérifier dans MetaAPI Dashboard: Le compte apparaît

#### Test 2: Message Telegram

1. Envoyer dans le canal Telegram:
```
BUY XAUUSD @ 2650.50 SL: 2640 TP: 2670
```

2. ✅ Vérifier dans Render Logs (Service Web):
   - "Signal traité pour..."
   - "Trade créé pour user..."

3. ✅ Vérifier dans Supabase:
```sql
-- Voir le signal parsé
SELECT * FROM telegram_signals ORDER BY parsed_at DESC LIMIT 1;

-- Voir les trades créés
SELECT * FROM telegram_trades ORDER BY created_at DESC LIMIT 5;
```

4. ✅ Vérifier dans Render Logs (Worker):
   - "Trade X exécuté: BUY XAUUSD 0.01 lots"
   - OU "Aucun trade en attente" (si déjà exécuté immédiatement)

#### Test 3: Exécution Immédiate

Le code appelle automatiquement `/api/telegram/execute-trades` après le parsing.

✅ Vérifier dans Render Logs (Service Web):
- "Executing trades immediately..."
- "Trade executed successfully"

#### Test 4: Worker de Secours

Le worker Render vérifie toutes les 5 secondes les trades pending.

✅ Vérifier dans Render Logs (Worker):
- "Recherche des trades en attente..."
- "X trade(s) à exécuter" (si des trades sont en attente)

### 6. Vérification des Routes API

#### Test de chaque route:

```bash
# 1. Webhook Telegram (doit retourner ok: true)
curl -X POST https://ton-app.onrender.com/api/telegram/webhook \
  -H "Content-Type: application/json" \
  -d '{"message":{"chat":{"type":"channel","username":"test"},"text":"test","message_id":1}}'

# 2. Parse Signal (doit parser correctement)
curl -X POST https://ton-app.onrender.com/api/telegram/parse-signal \
  -H "Content-Type: application/json" \
  -d '{"channelUsername":"test","messageText":"BUY XAUUSD @ 2650.50 SL: 2640 TP: 2670","messageId":1}'

# 3. Execute Trades (doit retourner executed: 0 si aucun trade pending)
curl -X POST https://ton-app.onrender.com/api/telegram/execute-trades

# 4. Account Info (doit retourner la balance)
curl "https://ton-app.onrender.com/api/metaapi/account-info?accountId=TON_ACCOUNT_ID"
```

### 7. Vérification MetaAPI

#### A. Token MetaAPI valide

```bash
curl -H "auth-token: TON_METAAPI_TOKEN" \
  https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts
```

**Doit retourner une liste (même vide), pas une erreur 401.**

#### B. Comptes déployés

Dans MetaAPI Dashboard → MT Accounts:
- ✅ Les comptes doivent être en statut "deployed" et "connected"

### 8. Vérification Parsing

#### Formats supportés (tous doivent fonctionner):

```
✅ BUY XAUUSD @ 2650.50 SL: 2640 TP: 2670
✅ 🟢 BUY GOLD 2650.50 SL 2640 TP 2670
✅ Signal: BUY EURUSD Entry: 1.0850 SL: 1.0800 TP: 1.0900
✅ XAUUSD BUY @2650.50 SL:2640 TP:2670
✅ BUY XAUUSD.I @ 2650.50 SL: 2640 TP: 2670
```

#### Normalisation des symboles:

- `XAUUSD` → `GOLD` ✅
- `XAUUSD.I` → `GOLD` ✅
- `GOLD` → `GOLD` ✅
- `SOL` → `SOL30` ✅
- `BTC` → `BTC` ✅

#### Mapping selon broker:

- VTmarker: `GOLD` → `XAUUSD` ✅
- Raise FX: `GOLD` → `XAUUSD` ✅
- FXcess: `GOLD` → `XAUUSD` ✅
- Axi: `GOLD` → `XAUUSD` ✅

### 9. Vérification Worker Render

#### A. Worker démarré

Dans Render Dashboard → Worker → Logs:
- ✅ "Service d'exécution des trades Telegram démarré"
- ✅ "Vérification toutes les 5 secondes..."

#### B. Worker actif

Les logs doivent montrer:
- Toutes les 5 secondes: "Recherche des trades en attente..."
- Si des trades: "X trade(s) à exécuter"
- Après exécution: "Trade X exécuté: ..."

### 10. Vérification Base de Données

#### Tables importantes:

```sql
-- Vérifier les comptes MT5
SELECT id, user_id, broker_name, metaapi_account_id, is_active 
FROM mt5_accounts 
WHERE is_active = true;

-- Vérifier les abonnements actifs
SELECT user_id, status, stripe_customer_id 
FROM subscriptions 
WHERE status = 'active';

-- Vérifier les canaux Telegram
SELECT id, name, username, is_active 
FROM telegram_channels 
WHERE is_active = true;

-- Vérifier les mappings
SELECT broker_name, standard_symbol, broker_symbol 
FROM symbol_mappings;
```

## 🚨 Problèmes Courants et Solutions

### Problème: Webhook Telegram non reçu

**Vérifier:**
1. ✅ Webhook configuré correctement
2. ✅ Bot est admin du canal
3. ✅ `NEXT_PUBLIC_APP_URL` est correct
4. ✅ Service Render est en ligne

**Solution:**
```bash
# Reconfigurer le webhook
curl -X POST "https://api.telegram.org/bot7958247845:AAFPfntvvND10uCs7AX6UPC5Dz4a_Dc17bc/setWebhook" \
  -d "url=https://ton-app.onrender.com/api/telegram/webhook"
```

### Problème: Signal non parsé

**Vérifier:**
1. ✅ Format du message correspond aux patterns
2. ✅ Logs Render pour voir l'erreur
3. ✅ `OPENAI_API_KEY` si utilisé (optionnel)

**Solution:**
- Tester avec un format standard: `BUY XAUUSD @ 2650.50 SL: 2640 TP: 2670`
- Vérifier les logs Render

### Problème: Trade non exécuté

**Vérifier:**
1. ✅ User a un abonnement actif
2. ✅ User a un compte MT5 actif avec `metaapi_account_id`
3. ✅ Symbole correct pour le broker
4. ✅ Worker Render est démarré
5. ✅ `METAAPI_TOKEN` est correct

**Solution:**
- Vérifier les logs du worker Render
- Vérifier dans Supabase que le trade est créé avec status `pending`
- Vérifier que le worker peut accéder à Supabase

### Problème: Symbole incorrect

**Vérifier:**
1. ✅ Mapping existe dans `symbol_mappings`
2. ✅ `broker_name` correspond exactement (casse, espaces)
3. ✅ `standard_symbol` est correct (GOLD, SOL30, BTC)

**Solution:**
```sql
-- Vérifier le mapping
SELECT * FROM symbol_mappings 
WHERE broker_name = 'TON_BROKER' 
AND standard_symbol = 'GOLD';

-- Si vide, ajouter:
INSERT INTO symbol_mappings (broker_name, standard_symbol, broker_symbol)
VALUES ('TON_BROKER', 'GOLD', 'XAUUSD')
ON CONFLICT (broker_name, standard_symbol) DO UPDATE 
SET broker_symbol = EXCLUDED.broker_symbol;
```

### Problème: Balance non affichée

**Vérifier:**
1. ✅ `metaapi_account_id` est rempli
2. ✅ Compte MetaAPI est déployé et connecté
3. ✅ `METAAPI_TOKEN` est correct

**Solution:**
- Vérifier dans MetaAPI Dashboard que le compte est connecté
- Vérifier les logs Render pour voir l'erreur exacte

## ✅ Checklist Finale

- [ ] Toutes les variables d'environnement configurées (Service Web)
- [ ] Variables d'environnement configurées (Worker)
- [ ] Webhook Telegram configuré et vérifié
- [ ] Canal Telegram ajouté dans Supabase
- [ ] Mappings de symboles configurés dans Supabase
- [ ] Service Web Render déployé et en ligne
- [ ] Worker Render déployé et en ligne
- [ ] Token MetaAPI valide
- [ ] Test: User connecte son compte → Compte créé sur MetaAPI
- [ ] Test: Message Telegram → Signal parsé
- [ ] Test: Trade créé pour l'utilisateur
- [ ] Test: Trade exécuté (immédiatement ou via worker)
- [ ] Test: Balance affichée en temps réel

## 🎉 Résultat Attendu

Une fois tout vérifié:
- ✅ User connecte son compte → Automatique
- ✅ Message Telegram → Parsé automatiquement
- ✅ Symbole mappé selon le broker → Automatique
- ✅ Trade créé → Automatique
- ✅ Trade exécuté → Immédiatement OU via worker (max 5 secondes)
- ✅ Balance en temps réel → Automatique (toutes les 5 secondes)

**Tout est automatique et fonctionnel !** 🚀

