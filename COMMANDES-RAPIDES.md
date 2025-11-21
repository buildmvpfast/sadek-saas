# 🚀 Commandes Rapides - Copier/Coller

## 1. ✅ Vérifier le Token MetaAPI

### Récupérer le Token
1. Va sur https://app.metaapi.cloud/
2. Menu → **"API Access"**
3. Copie ton token

### Tester le Token
```bash
# Remplace TON_TOKEN par ton vrai token
curl -H "auth-token: TON_TOKEN" \
  https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts
```

**✅ Si tu vois `[]` ou une liste → Token valide**
**❌ Si tu vois `{"error": "Unauthorized"}` → Token invalide**

---

## 2. 📱 Configurer le Webhook Telegram

### Étape 1 : Récupérer ton URL Render
Dans Render Dashboard → Ton service → Copie l'URL (ex: `https://sadek-bot-saas.onrender.com`)

### Étape 2 : Configurer le Webhook
```bash
# Remplace TON-URL-RENDER par ta vraie URL Render
curl -X POST "https://api.telegram.org/bot7958247845:AAFPfntvvND10uCs7AX6UPC5Dz4a_Dc17bc/setWebhook" \
  -d "url=https://TON-URL-RENDER.onrender.com/api/telegram/webhook"
```

**Exemple :**
```bash
curl -X POST "https://api.telegram.org/bot7958247845:AAFPfntvvND10uCs7AX6UPC5Dz4a_Dc17bc/setWebhook" \
  -d "url=https://sadek-bot-saas.onrender.com/api/telegram/webhook"
```

### Étape 3 : Vérifier
```bash
curl "https://api.telegram.org/bot7958247845:AAFPfntvvND10uCs7AX6UPC5Dz4a_Dc17bc/getWebhookInfo"
```

**✅ Si tu vois `"url": "https://ton-app.onrender.com/api/telegram/webhook"` → C'est bon !**

---

## 3. 🗄️ Supabase - Canal Telegram

### Ajouter le Canal
1. Va sur **Supabase Dashboard** → **SQL Editor**
2. **New Query**
3. Colle cette requête (remplace les valeurs entre `<>`) :

```sql
INSERT INTO public.telegram_channels (name, username, description, is_active)
VALUES ('<Nom du Canal>', '<username_sans_@>', 'Signaux de trading', true)
ON CONFLICT (username) DO UPDATE 
SET name = EXCLUDED.name, is_active = true;
```

**Exemple :**
```sql
INSERT INTO public.telegram_channels (name, username, description, is_active)
VALUES ('Sadek Trading', 'sadektrading', 'Signaux de trading', true)
ON CONFLICT (username) DO UPDATE 
SET name = EXCLUDED.name, is_active = true;
```

### Vérifier
```sql
SELECT * FROM telegram_channels WHERE is_active = true;
```

---

## 4. 🗄️ Supabase - Mappings de Symboles

### Exécuter les Mappings
1. Va sur **Supabase Dashboard** → **SQL Editor**
2. **New Query**
3. Colle tout ce contenu :

```sql
-- Mapping des symboles pour les brokers ACTUELS uniquement
-- VTmarker, Raise FX, FXcess, Axi

-- GOLD (XAU/USD)
INSERT INTO symbol_mappings (broker_name, standard_symbol, broker_symbol) VALUES
  ('VTmarker', 'GOLD', 'XAUUSD'),
  ('Raise FX', 'GOLD', 'XAUUSD'),
  ('FXcess', 'GOLD', 'XAUUSD'),
  ('Axi', 'GOLD', 'XAUUSD')
ON CONFLICT (broker_name, standard_symbol) DO UPDATE 
SET broker_symbol = EXCLUDED.broker_symbol;

-- SOL30 (Solana)
INSERT INTO symbol_mappings (broker_name, standard_symbol, broker_symbol) VALUES
  ('VTmarker', 'SOL30', 'SOL30'),
  ('Raise FX', 'SOL30', 'SOL30'),
  ('FXcess', 'SOL30', 'SOL30'),
  ('Axi', 'SOL30', 'SOL30')
ON CONFLICT (broker_name, standard_symbol) DO UPDATE 
SET broker_symbol = EXCLUDED.broker_symbol;

-- BTC (Bitcoin)
INSERT INTO symbol_mappings (broker_name, standard_symbol, broker_symbol) VALUES
  ('VTmarker', 'BTC', 'BTCUSD'),
  ('Raise FX', 'BTC', 'BTCUSD'),
  ('FXcess', 'BTC', 'BTCUSD'),
  ('Axi', 'BTC', 'BTCUSD')
ON CONFLICT (broker_name, standard_symbol) DO UPDATE 
SET broker_symbol = EXCLUDED.broker_symbol;
```

4. Clique sur **"Run"**

### Vérifier
```sql
SELECT broker_name, standard_symbol, broker_symbol 
FROM symbol_mappings 
WHERE broker_name IN ('VTmarker', 'Raise FX', 'FXcess', 'Axi')
ORDER BY broker_name, standard_symbol;
```

**✅ Tu devrais voir 12 lignes (4 brokers × 3 symboles)**

---

## 📋 Résumé des Actions

1. **Token MetaAPI** : Récupérer depuis metaapi.cloud → Tester avec curl → Ajouter dans Render
2. **Webhook Telegram** : Configurer avec curl → Vérifier avec getWebhookInfo
3. **Canal Telegram** : Ajouter dans Supabase avec SQL
4. **Mappings** : Exécuter le script SQL dans Supabase

**C'est tout !** 🎉

