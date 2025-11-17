# 🔑 Comment obtenir le Token MetaAPI

## ✅ Le code est DÉJÀ automatique !

Quand un user ajoute un compte MT5 depuis le SaaS :
1. ✅ Le compte est **automatiquement créé** sur MetaAPI
2. ✅ Le compte est **automatiquement déployé**
3. ✅ Le compte se **connecte automatiquement**
4. ✅ Tout se fait **sans intervention manuelle**

**Tu n'as RIEN à faire manuellement !** 🎉

## 🔑 Où trouver le Token MetaAPI

### Étape 1 : Se connecter au Dashboard MetaAPI

1. Va sur **https://app.metaapi.cloud/**
2. Connecte-toi avec ton compte MetaAPI
   - Si tu n'as pas de compte → Crée-en un (gratuit)

### Étape 2 : Récupérer le Token

1. Dans le menu, clique sur **"API Access"**
2. Tu verras ton **"API Token"** ou **"Access Token"**
3. **Copie ce token** (il commence généralement par `eyJhbGci...`)

### Étape 3 : Configurer le Token

#### Pour le développement local :

1. Ouvre ton fichier `.env.local` (à la racine du projet)
2. Ajoute ou modifie :
```bash
METAAPI_TOKEN=eyJhbGciOiJSUzUxMiIs... (ton token complet)
```

#### Pour la production (Vercel/Render) :

1. Va dans ton dashboard Vercel/Render
2. Settings → Environment Variables
3. Ajoute ou modifie :
   - **Key** : `METAAPI_TOKEN`
   - **Value** : `eyJhbGciOiJSUzUxMiIs...` (ton token complet)
4. **Redéploie** l'application

## ✅ Vérifier que ça marche

### Test 1 : Vérifier le token

```bash
# Dans ton terminal
curl -H "auth-token: TON_TOKEN" \
  https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts
```

Si tu reçois une liste de comptes (même vide), le token est bon ✅

### Test 2 : Ajouter un compte depuis le SaaS

1. Va sur `/mt5-accounts`
2. Clique "Ajouter un compte"
3. Remplis le formulaire
4. Le compte devrait être créé automatiquement sur MetaAPI

## 🚨 Erreurs courantes

### "Unauthorized" ou "Invalid token"
→ Le token est incorrect ou expiré
→ Va dans "API Access" et génère un nouveau token

### "Account limit reached"
→ Tu as atteint la limite de comptes gratuits (1 compte)
→ Upgrade ton plan MetaAPI dans "Billing"

### Le compte ne se connecte pas
→ Vérifie que les credentials MT5 sont corrects
→ Vérifie que le serveur MT5 est correct (ex: `ICMarkets-Demo`)

## 📋 Checklist

- [ ] Compte MetaAPI créé sur https://app.metaapi.cloud/
- [ ] Token récupéré dans "API Access"
- [ ] Token ajouté dans `.env.local` (dev) ou variables d'environnement (prod)
- [ ] Application redéployée (si prod)
- [ ] Test : Ajouter un compte depuis le SaaS → Vérifier qu'il apparaît dans MetaAPI Dashboard

## 🎯 Résultat

Une fois le token configuré :
- ✅ User ajoute un compte MT5 → **Créé automatiquement sur MetaAPI**
- ✅ Compte déployé automatiquement
- ✅ Connexion automatique
- ✅ Balance en temps réel automatique
- ✅ **Aucune intervention manuelle nécessaire !**

