# Configuration Complète Telegram → Trades

## 📋 Checklist de Configuration

### 1. Variables d'environnement requises

Ajoute dans `.env.local`:

```env
# Telegram
TELEGRAM_BOT_TOKEN=ton_token_bot_telegram

# MetaAPI (déjà requis)
METAAPI_TOKEN=ton_token_metaapi

# Supabase (déjà requis)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. Créer un Bot Telegram

1. Ouvrir Telegram et chercher **@BotFather**
2. Envoyer `/newbot`
3. Suivre les instructions pour créer le bot
4. **Copier le token** (format: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
5. Ajouter le token dans `.env.local` comme `TELEGRAM_BOT_TOKEN`

### 3. Configurer le Webhook Telegram

**Option A: En local avec ngrok (pour tester)**

```bash
# Installer ngrok: https://ngrok.com/download
ngrok http 3000

# Copier l'URL HTTPS (ex: https://abc123.ngrok.io)
# Configurer le webhook:
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://abc123.ngrok.io/api/telegram/webhook"
```

**Option B: En production**

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://ton-domaine.com/api/telegram/webhook"
```

**Vérifier le webhook:**
```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

### 4. Ajouter le Bot au Canal Telegram

1. Créer ou utiliser un canal Telegram existant
2. Aller dans les paramètres du canal → Administrateurs
3. Ajouter le bot comme **Administrateur** (au minimum avec permission de lire les messages)
4. Noter le **username** du canal (ex: `@sadektrading`)

### 5. Configurer le Canal dans la Base de Données

Exécuter dans Supabase SQL Editor:

```sql
-- Ajouter votre canal
INSERT INTO public.telegram_channels (name, username, description, is_active)
VALUES ('Sadek Trading', 'sadektrading', 'Signaux de trading', true);

-- Vérifier
SELECT * FROM public.telegram_channels;
```

### 6. Lancer les Services

**Terminal 1 - Application Next.js:**
```bash
npm run dev
```

**Terminal 2 - Service d'exécution des trades Telegram:**
```bash
npm run telegram-trades
```

Ce service vérifie toutes les 5 secondes les trades en attente et les exécute.

**Alternative: Utiliser l'API route (pour cron job):**
```bash
# Appeler périodiquement (ex: toutes les 10 secondes)
curl -X POST http://localhost:3000/api/telegram/execute-trades
```

### 7. Tester le Flux Complet

1. **Envoyer un message de test dans le canal:**
   ```
   BUY XAUUSD @ 2650.50 SL: 2640 TP: 2670
   ```

2. **Vérifier les logs:**
   - Terminal 1 (Next.js): Devrait afficher "Signal traité pour..."
   - Terminal 2 (telegram-trades): Devrait afficher "Trade exécuté"

3. **Vérifier dans Supabase:**
   ```sql
   -- Voir les signaux reçus
   SELECT * FROM telegram_signals ORDER BY parsed_at DESC LIMIT 10;
   
   -- Voir les trades créés
   SELECT * FROM telegram_trades ORDER BY created_at DESC LIMIT 10;
   ```

## 🔧 Formats de Signaux Supportés

Le parser détecte ces formats:

1. `BUY XAUUSD @ 2650.50 SL: 2640 TP: 2670`
2. `🟢 BUY GOLD 2650.50 SL 2640 TP 2670`
3. `Signal: BUY EURUSD Entry: 1.0850 SL: 1.0800 TP: 1.0900`

## 📊 Flux Complet

```
1. Message Telegram → Canal
2. Webhook Telegram → /api/telegram/webhook
3. Webhook → /api/telegram/parse-signal
4. Parse Signal → Sauvegarde dans telegram_signals
5. Création trades → telegram_trades (status: pending)
6. Service execute-trades → Exécute via MetaAPI
7. Mise à jour → telegram_trades (status: executed/failed)
```

## 🐛 Dépannage

### Problème: Les messages ne sont pas reçus

**Solutions:**
- Vérifier que le bot est admin du canal
- Vérifier le webhook: `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"`
- Vérifier les logs du terminal Next.js
- Vérifier que le canal est dans la table `telegram_channels`

### Problème: Les signaux ne sont pas parsés

**Solutions:**
- Vérifier le format du message (doit correspondre aux patterns)
- Vérifier les logs dans `/api/telegram/parse-signal`
- Ajouter plus de patterns dans `parseSignal()` si nécessaire

### Problème: Les trades ne s'exécutent pas

**Solutions:**
- Vérifier que le service `telegram-trades` tourne
- Vérifier `METAAPI_TOKEN` dans `.env.local`
- Vérifier que les comptes MT5 ont un `metaapi_account_id`
- Vérifier que les utilisateurs ont un abonnement actif
- Vérifier les logs du service pour les erreurs MetaAPI

### Problème: "Canal non configuré"

**Solution:**
- Vérifier que le canal est dans `telegram_channels` avec le bon `username`
- Le username doit correspondre exactement (sans le @)

## 🔐 Sécurité

- **Ne jamais commit le token Telegram** dans Git
- Utiliser des variables d'environnement
- En production, utiliser HTTPS pour le webhook
- Optionnel: Ajouter une vérification du secret dans le webhook

## 📝 Notes

- Le service `telegram-trades` doit tourner en continu pour exécuter les trades
- En production, utiliser un service comme PM2, systemd, ou un cron job
- Les trades sont exécutés par batch de 50 maximum
- Le volume par défaut est 0.01 lots (modifiable dans le parser)

