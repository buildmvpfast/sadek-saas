# 🤖 Configuration Complète : Trading Automatique via Telegram

## ✅ Flow Complet Automatique

1. **User connecte son compte MT5** → Compte créé automatiquement sur MetaAPI
2. **Message envoyé dans le canal Telegram** → Webhook reçu
3. **Parsing du signal** → Extraction BUY/SELL, symbole, prix, SL, TP
4. **Mapping du symbole** → XAUUSD/GOLD → Symbole du broker (XAUUSD, GOLD, XAUUSD.I, etc.)
5. **Création des trades** → Un trade par utilisateur abonné
6. **Exécution automatique** → Trade passé sur MetaAPI

## 🔧 Configuration Requise

### 1. Variables d'Environnement

#### Obligatoires :
```bash
# Telegram
TELEGRAM_BOT_TOKEN=7958247845:AAFPfntvvND10uCs7AX6UPC5Dz4a_Dc17bc

# MetaAPI
METAAPI_TOKEN=ton_token_metaapi

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# App URL
NEXT_PUBLIC_APP_URL=https://ton-domaine.com
```

#### Optionnel (mais recommandé) :
```bash
# OpenAI pour parsing amélioré
OPENAI_API_KEY=sk-...
```

**Note** : Sans OpenAI, le parsing utilise des regex (fonctionne bien aussi). Avec OpenAI, c'est plus robuste pour les formats variés.

### 2. Configuration Telegram

#### Étape 1 : Configurer le Webhook

```bash
curl -X POST "https://api.telegram.org/bot7958247845:AAFPfntvvND10uCs7AX6UPC5Dz4a_Dc17bc/setWebhook" \
  -d "url=https://ton-domaine.com/api/telegram/webhook"
```

#### Étape 2 : Vérifier le Webhook

```bash
curl "https://api.telegram.org/bot7958247845:AAFPfntvvND10uCs7AX6UPC5Dz4a_Dc17bc/getWebhookInfo"
```

#### Étape 3 : Ajouter le Bot au Canal

1. Créer ou utiliser un canal Telegram
2. Paramètres du canal → Administrateurs
3. Ajouter le bot comme **Administrateur** (permission de lire les messages)

### 3. Configuration Supabase

#### Étape 1 : Ajouter le Canal

```sql
INSERT INTO public.telegram_channels (name, username, description, is_active)
VALUES ('Mon Canal Trading', 'moncanal', 'Signaux de trading', true);
```

#### Étape 2 : Configurer les Mappings de Symboles

Exécuter le script `supabase-symbol-mappings-actual-brokers.sql` dans Supabase SQL Editor.

Ce script crée les mappings pour :
- **GOLD** : XAUUSD, GOLD, XAUUSD.I → mappé selon le broker
- **SOL30** : SOL, SOL30, SOLUSDT → mappé selon le broker
- **BTC** : BTC, BTCUSD, BITCOIN → mappé selon le broker

#### Étape 3 : Vérifier les Mappings

```sql
SELECT broker_name, standard_symbol, broker_symbol 
FROM symbol_mappings 
WHERE broker_name IN ('VT Markets', 'Raise FX', 'FXcess', 'Axi')
ORDER BY broker_name, standard_symbol;
```

### 4. Configuration MetaAPI

Voir `METAAPI-TOKEN-SETUP.md` pour :
- Récupérer le token MetaAPI
- Configurer dans les variables d'environnement

## 🎯 Test du Flow Complet

### Test 1 : User Connecte Son Compte

1. User va sur `/mt5-accounts`
2. Ajoute son compte MT5 (broker, serveur, login, password)
3. ✅ Le compte est créé automatiquement sur MetaAPI
4. ✅ Le compte apparaît dans MetaAPI Dashboard

### Test 2 : Message Telegram

1. Envoyer un message dans le canal Telegram :
```
BUY XAUUSD @ 2650.50 SL: 2640 TP: 2670
```

2. Vérifier les logs :
   - Webhook reçu ✅
   - Signal parsé ✅
   - Trades créés pour chaque user abonné ✅

### Test 3 : Exécution des Trades

Les trades sont exécutés automatiquement via :
- **Option A** : Cron job (Vercel Cron ou autre)
- **Option B** : Appel manuel de `/api/telegram/execute-trades`

Pour tester manuellement :
```bash
curl -X POST https://ton-domaine.com/api/telegram/execute-trades
```

## 🔍 Vérification du Parsing

### Formats Supportés

Le parsing supporte ces formats (avec ou sans OpenAI) :

```
✅ BUY XAUUSD @ 2650.50 SL: 2640 TP: 2670
✅ 🟢 BUY GOLD 2650.50 SL 2640 TP 2670
✅ Signal: BUY EURUSD Entry: 1.0850 SL: 1.0800 TP: 1.0900
✅ XAUUSD BUY @2650.50 SL:2640 TP:2670
✅ BUY XAUUSD.I @ 2650.50 SL: 2640 TP: 2670
```

### Mapping des Symboles

Le système normalise automatiquement :
- `XAUUSD` → `GOLD`
- `XAUUSD.I` → `GOLD`
- `GOLD` → `GOLD`
- `SOL` → `SOL30`
- `SOLUSDT` → `SOL30`
- `BTC` → `BTC`
- `BTCUSD` → `BTC`

Puis mappe selon le broker :
- VT Markets : `GOLD` → `XAUUSD`
- Raise FX : `GOLD` → `XAUUSD`
- FXcess : `GOLD` → `XAUUSD`
- Axi : `GOLD` → `XAUUSD`

## 🚨 Dépannage

### Problème : Webhook non reçu

**Solution :**
1. Vérifier que le webhook est configuré : `getWebhookInfo`
2. Vérifier que le bot est admin du canal
3. Vérifier que `NEXT_PUBLIC_APP_URL` est correct

### Problème : Signal non parsé

**Solution :**
1. Vérifier les logs dans Vercel
2. Tester le parsing manuellement :
```bash
curl -X POST https://ton-domaine.com/api/telegram/parse-signal \
  -H "Content-Type: application/json" \
  -d '{"channelUsername": "moncanal", "messageText": "BUY XAUUSD @ 2650.50 SL: 2640 TP: 2670", "messageId": 123}'
```

### Problème : Trade non exécuté

**Solution :**
1. Vérifier que l'utilisateur a un abonnement actif
2. Vérifier que l'utilisateur a un compte MT5 actif
3. Vérifier que le symbole est correct pour le broker
4. Vérifier les logs MetaAPI

### Problème : Symbole incorrect

**Solution :**
1. Vérifier le mapping dans `symbol_mappings`
2. Vérifier que le `broker_name` correspond exactement
3. Ajouter un nouveau mapping si nécessaire :
```sql
INSERT INTO symbol_mappings (broker_name, standard_symbol, broker_symbol)
VALUES ('NOUVEAU_BROKER', 'GOLD', 'XAUUSD')
ON CONFLICT (broker_name, standard_symbol) DO UPDATE 
SET broker_symbol = EXCLUDED.broker_symbol;
```

## 📋 Checklist Finale

- [ ] Token Telegram configuré
- [ ] Webhook Telegram configuré
- [ ] Bot ajouté au canal comme admin
- [ ] Canal ajouté dans Supabase
- [ ] Mappings de symboles configurés
- [ ] Token MetaAPI configuré
- [ ] User a connecté son compte MT5
- [ ] User a un abonnement actif
- [ ] Test : Message envoyé dans le canal
- [ ] Test : Signal parsé correctement
- [ ] Test : Trade créé pour l'utilisateur
- [ ] Test : Trade exécuté sur MetaAPI

## 🎉 Résultat

Une fois tout configuré :
- ✅ User connecte son compte → Automatique
- ✅ Message Telegram → Parsé automatiquement
- ✅ Symbole mappé selon le broker → Automatique
- ✅ Trade créé → Automatique
- ✅ Trade exécuté → Automatique

**Tout est automatique !** 🚀

