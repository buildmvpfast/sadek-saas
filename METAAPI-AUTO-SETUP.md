# 🤖 Configuration Automatique MetaAPI pour SaaS

## ✅ Ce qui est DÉJÀ automatisé dans le code

1. **Création automatique des comptes** : Quand un user ajoute un compte MT5, il est automatiquement créé sur MetaAPI
2. **Déploiement automatique** : Le compte est automatiquement déployé après création
3. **Récupération des infos** : Balance, positions, etc. récupérées automatiquement via API REST

## 🔧 Configuration à faire sur MetaAPI Dashboard

### 1. Activer le déploiement automatique (Optionnel mais recommandé)

1. Va sur https://app.metaapi.cloud/
2. Settings → Account Settings
3. Active **"Auto-deploy accounts"** si disponible
   - Cela permet de déployer automatiquement les nouveaux comptes sans attendre

### 2. Configurer les Webhooks (Important pour les événements)

1. Dans MetaAPI Dashboard → Settings → Webhooks
2. Ajoute un webhook pointant vers : `https://ton-domaine.com/api/metaapi/webhook`
3. Sélectionne les événements :
   - `account.deployed` - Quand un compte est déployé
   - `account.connected` - Quand un compte se connecte
   - `account.disconnected` - Quand un compte se déconnecte
   - `position.opened` - Quand une position s'ouvre (pour copy trading)
   - `position.closed` - Quand une position se ferme

**Note** : Pour l'instant, le code utilise du polling (vérification toutes les 5 secondes). Les webhooks rendraient ça encore plus rapide et automatique.

### 3. Région et Performance

Dans le code (`connect-account/route.ts` ligne 33), la région est définie :
```typescript
region: 'new-york', // ou 'london', 'singapore'
```

**Recommandation** :
- Si tes users sont en Europe → `'london'`
- Si tes users sont en Asie → `'singapore'`
- Si tes users sont en Amérique → `'new-york'`

Tu peux aussi le rendre dynamique selon le broker ou la localisation de l'utilisateur.

### 4. Configuration des comptes (Auto-reconnect)

1. Dans MetaAPI Dashboard → Accounts
2. Pour chaque compte, active :
   - **"Auto-reconnect"** : Reconnexion automatique en cas de déconnexion
   - **"Auto-sync"** : Synchronisation automatique des données

### 5. Limites et Quotas

1. Vérifie ton plan MetaAPI :
   - Plan gratuit : 1 compte
   - Plan payant : Plus de comptes selon ton abonnement
2. Si tu as beaucoup d'utilisateurs, upgrade ton plan MetaAPI

## 🚀 Améliorations possibles pour plus d'automatisation

### A. Webhooks au lieu de Polling

Actuellement, le code vérifie les positions toutes les 5 secondes. Avec les webhooks :
- Réaction instantanée aux événements
- Moins de charge serveur
- Plus rapide pour le copy trading

**À implémenter** : Route `/api/metaapi/webhook` qui reçoit les événements MetaAPI

### B. Auto-retry en cas d'échec

Si un compte ne se connecte pas :
- Retry automatique après X minutes
- Notification à l'utilisateur
- Logs pour debugging

### C. Health Check automatique

Vérifier périodiquement que les comptes sont bien connectés :
- Si déconnecté → tentative de reconnexion
- Alert si problème persistant

## 📋 Checklist Configuration MetaAPI

- [ ] Token MetaAPI configuré dans `.env` (`METAAPI_TOKEN`)
- [ ] Auto-deploy activé (si disponible)
- [ ] Webhooks configurés (optionnel mais recommandé)
- [ ] Région choisie selon tes users (`new-york`, `london`, `singapore`)
- [ ] Auto-reconnect activé pour chaque compte
- [ ] Plan MetaAPI adapté au nombre de comptes

## 🎯 Résultat Final

Avec cette configuration :
1. ✅ User ajoute un compte MT5 → Créé automatiquement sur MetaAPI
2. ✅ Compte déployé automatiquement
3. ✅ Connexion automatique
4. ✅ Synchronisation automatique
5. ✅ Balance et positions récupérées automatiquement
6. ✅ Copy trading automatique (si service lancé)

**Tout est automatique !** 🎉

