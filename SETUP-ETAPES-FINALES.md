# 🔧 Configuration Finale - Étapes Détaillées

## 1. ✅ Vérifier que le Token MetaAPI est Valide

### Étape 1 : Récupérer ton Token MetaAPI

1. Va sur **https://app.metaapi.cloud/**
2. Connecte-toi (ou crée un compte si besoin)
3. Dans le menu, clique sur **"API Access"**
4. Tu verras ton **"API Token"** ou **"Access Token"**
5. **Copie ce token** (il commence généralement par `eyJhbGci...`)

### Étape 2 : Tester le Token

Ouvre ton terminal et exécute :

```bash
curl -H "auth-token: TON_TOKEN_ICI" \
  https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts
```

**Remplace `TON_TOKEN_ICI` par ton vrai token.**

**Résultat attendu :**
- ✅ Si le token est **valide** : Tu reçois une liste JSON (même vide `[]`)
- ❌ Si le token est **invalide** : Tu reçois `{"error": "Unauthorized"}` ou `401`

### Étape 3 : Ajouter le Token dans Render

1. Va sur **Render Dashboard** → Ton service web
2. **Settings** → **Environment**
3. Cherche `METAAPI_TOKEN`
4. Si elle existe, **modifie** avec ton token
5. Si elle n'existe pas, **ajoute** :
   - **Key** : `METAAPI_TOKEN`
   - **Value** : `ton_token_complet_ici`
6. **Save Changes**
7. **Redéploie** le service (Render le fait automatiquement)

---

## 2. 📱 Configurer le Webhook Telegram

### Étape 1 : Récupérer ton URL Render

1. Va sur **Render Dashboard** → Ton service web
2. Tu verras l'URL en haut (ex: `https://sadek-bot-saas.onrender.com`)
3. **Copie cette URL**

### Étape 2 : Configurer le Webhook

Ouvre ton terminal et exécute :

```bash
curl -X POST "https://api.telegram.org/bot<BOT_ID>:<REDACTED_TOKEN>/setWebhook" \
  -d "url=https://TON-URL-RENDER.onrender.com/api/telegram/webhook"
```

**Remplace `TON-URL-RENDER.onrender.com` par ta vraie URL Render.**

**Exemple :**
```bash
curl -X POST "https://api.telegram.org/bot<BOT_ID>:<REDACTED_TOKEN>/setWebhook" \
  -d "url=https://sadek-bot-saas.onrender.com/api/telegram/webhook"
```

**Résultat attendu :**
```json
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
```

### Étape 3 : Vérifier que ça Marche

```bash
curl "https://api.telegram.org/bot<BOT_ID>:<REDACTED_TOKEN>/getWebhookInfo"
```

**Résultat attendu :**
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

✅ Si tu vois ça, c'est bon !

### Étape 4 : Ajouter le Bot au Canal Telegram

1. Ouvre **Telegram**
2. Va dans ton **canal** (ou crée-en un)
3. **Paramètres du canal** → **Administrateurs**
4. **Ajouter un administrateur**
5. Cherche ton bot (ex: `@ton_bot`)
6. Ajoute-le avec la permission **"Lire les messages"** (minimum)

---

## 3. 🗄️ Configuration Supabase

### A. Ajouter le Canal Telegram

#### Étape 1 : Ouvrir Supabase

1. Va sur **https://supabase.com/dashboard**
2. Sélectionne ton projet
3. Clique sur **"SQL Editor"** dans le menu de gauche

#### Étape 2 : Exécuter cette Requête

**Remplace les valeurs entre `<>` :**

```sql
INSERT INTO public.telegram_channels (name, username, description, is_active)
VALUES ('<Nom du Canal>', '<username_du_canal>', 'Signaux de trading', true)
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

**⚠️ Important :**
- `username` = le nom du canal **sans le @** (ex: `sadektrading` pas `@sadektrading`)
- Si le canal n'a pas de username, utilise le `name` à la place

#### Étape 3 : Vérifier

```sql
SELECT * FROM telegram_channels WHERE is_active = true;
```

Tu devrais voir ton canal dans la liste.

---

### B. Exécuter les Mappings de Symboles

#### Étape 1 : Ouvrir le Fichier SQL

Dans ton projet, ouvre le fichier : **`supabase-symbol-mappings-actual-brokers.sql`**

#### Étape 2 : Copier le Contenu

Copie tout le contenu du fichier.

#### Étape 3 : Exécuter dans Supabase

1. Va sur **Supabase Dashboard** → **SQL Editor**
2. **New Query**
3. **Colle** le contenu du fichier SQL
4. Clique sur **"Run"** (ou `Ctrl+Enter`)

#### Étape 4 : Vérifier

```sql
SELECT broker_name, standard_symbol, broker_symbol 
FROM symbol_mappings 
WHERE broker_name IN ('VT Markets', 'Raise FX', 'FXcess', 'Axi')
ORDER BY broker_name, standard_symbol;
```

**Résultat attendu :**
```
broker_name | standard_symbol | broker_symbol
------------|-----------------|---------------
Axi         | BTC             | BTCUSD
Axi         | GOLD            | XAUUSD
Axi         | SOL30           | SOL30
FXcess      | BTC             | BTCUSD
FXcess      | GOLD            | XAUUSD
FXcess      | SOL30           | SOL30
Raise FX    | BTC             | BTCUSD
Raise FX    | GOLD            | XAUUSD
Raise FX    | SOL30           | SOL30
VT Markets    | BTC             | BTCUSD
VT Markets    | GOLD            | XAUUSD
VT Markets    | SOL30           | SOL30
```

✅ Si tu vois ça, c'est bon !

---

## 📋 Checklist Finale

- [ ] Token MetaAPI récupéré depuis https://app.metaapi.cloud/
- [ ] Token MetaAPI testé avec curl (retourne une liste, pas une erreur)
- [ ] Token MetaAPI ajouté dans Render (variable `METAAPI_TOKEN`)
- [ ] URL Render récupérée
- [ ] Webhook Telegram configuré avec curl
- [ ] Webhook Telegram vérifié (getWebhookInfo)
- [ ] Bot ajouté au canal Telegram comme admin
- [ ] Canal Telegram ajouté dans Supabase (table `telegram_channels`)
- [ ] Mappings de symboles exécutés dans Supabase
- [ ] Mappings vérifiés (requête SELECT)

---

## 🧪 Test Final

Une fois tout configuré, teste avec un message dans ton canal Telegram :

```
BUY XAUUSD @ 2650.50 SL: 2640 TP: 2670
```

**Vérifie dans Render Logs :**
- ✅ "Signal traité pour..."
- ✅ "Trade créé pour user..."
- ✅ "Trade X exécuté..."

**Vérifie dans Supabase :**
```sql
-- Voir le signal
SELECT * FROM telegram_signals ORDER BY parsed_at DESC LIMIT 1;

-- Voir les trades
SELECT * FROM telegram_trades ORDER BY created_at DESC LIMIT 5;
```

Si tu vois tout ça, **c'est bon !** 🎉

