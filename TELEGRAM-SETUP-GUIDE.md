# Guide de Configuration Telegram - L'IMPRIMANTE

## 🚀 Configuration du Canal L'IMPRIMANTE

### 1. **Exécuter les scripts SQL**

Exécute ces scripts dans l'ordre dans Supabase SQL Editor :

```sql
-- 1. Ajouter le canal L'IMPRIMANTE
-- Exécute: add-telegram-channel.sql

-- 2. Créer la table des tokens et ajouter le token
-- Exécute: telegram-tokens-schema.sql
```

### 2. **Configurer le Webhook Telegram**

```bash
# Exécuter le script de configuration du webhook
node setup-telegram-webhook-limprimante.js
```

### 3. **Variables d'environnement**

Assure-toi d'avoir dans ton `.env.local` :

```env
NEXT_PUBLIC_APP_URL=https://ton-domaine.com
# ou pour le dev local:
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. **Test du Canal**

1. **Va sur `/telegram-channels`** dans ton app
2. **Tu devrais voir le canal "L'IMPRIMANTE"** avec le badge Premium ⭐
3. **Clique sur "S'abonner"** pour t'abonner au canal
4. **Envoie un message de test** sur le canal Telegram

### 5. **Format des Signaux**

Le système parse automatiquement les messages au format :

```
BUY GOLD @2650 SL:2640 TP:2670
SELL SOL @180 SL:185 TP:175
```

### 6. **Vérification**

- ✅ Canal ajouté en base
- ✅ Token configuré
- ✅ Webhook configuré
- ✅ Parsing des signaux fonctionnel
- ✅ Exécution automatique des trades

## 🔧 Dépannage

### Webhook ne fonctionne pas
```bash
# Vérifier le webhook
curl "https://api.telegram.org/bot8496815756:AAEFOf60xHTGEWlXWtzgSIMwNJzwDhCra4M/getWebhookInfo"
```

### Canal non trouvé
- Vérifie que le script SQL a bien été exécuté
- Vérifie que le nom d'utilisateur correspond (`limprimante`)

### Signaux non parsés
- Vérifie le format du message
- Regarde les logs dans la console de l'app

## 📱 Interface Utilisateur

Le canal apparaît maintenant avec :
- 🎨 **Avatar coloré** avec la première lettre
- ⭐ **Badge Premium** 
- 📝 **Description** du canal
- 🔄 **Bouton d'abonnement** fonctionnel

**Le canal L'IMPRIMANTE est maintenant configuré et prêt à recevoir des signaux!** 🎯
