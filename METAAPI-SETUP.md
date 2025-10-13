# 🚀 Configuration MetaApi

MetaApi remplace ZeroMQ et rend l'intégration MT5 beaucoup plus simple!

## ✅ Avantages MetaApi

- ☁️ **Pas besoin d'EA** - Tout fonctionne via le cloud
- 🌍 **N'importe quel broker** - Compatible avec 99% des brokers MT5
- 📱 **API moderne** - REST + WebSocket
- 🔒 **Sécurisé** - Connexions SSL/TLS
- 📊 **Dashboard** - Monitoring sur metaapi.cloud

## 🔑 Configuration

### 1. Ton token est déjà configuré! ✅

Le token MetaApi a été ajouté automatiquement dans `.env.local`:
```
METAAPI_TOKEN=eyJhbGciOiJSUzUxMiIs...
```

### 2. Connecter un compte MT5

Il y a 2 façons:

#### Option A: Via l'interface web (recommandé pour tester)

1. Va sur https://app.metaapi.cloud/
2. Connecte-toi avec ton compte
3. "Add account"
4. Remplis:
   - **Login**: Ton numéro de compte MT5
   - **Password**: Ton mot de passe MT5
   - **Server**: Le serveur de ton broker (ex: `ICMarkets-Demo`)
   - **Platform**: MT5

#### Option B: Via l'app SaaS (automatique)

Quand tu ajoutes un compte MT5 dans l'app:
- Va sur `/mt5-accounts`
- Clique "Ajouter un compte"
- Remplis le formulaire
- **Le compte sera automatiquement créé sur MetaApi!**

## 🧪 Tester la connexion

### Test rapide avec Node.js:

```bash
node -e "
const MetaApi = require('metaapi.cloud-sdk').default;
const api = new MetaApi('TON_TOKEN');

api.metatraderAccountApi.getAccounts().then(accounts => {
  console.log('Comptes connectés:', accounts.length);
  accounts.forEach(a => console.log('- Account', a.login));
}).catch(console.error);
"
```

### Test du copy trading:

```bash
# Dans un terminal séparé
npm run copy-trading
```

Tu devrais voir:
```
🚀 Starting MetaApi Copy Trading Service...
✅ Admin user: xxx-xxx-xxx
✅ Admin account connected
✅ Copy Trading Service is running
```

## 📋 Workflow Copy Trading

1. **Admin configure son compte**:
   - Va sur `/admin/dashboard`
   - Ajoute son compte MT5 master

2. **Utilisateurs s'abonnent**:
   - S'inscrivent
   - Souscrivent à l'abonnement
   - Ajoutent leur(s) compte(s) MT5

3. **Copie automatique**:
   - Service vérifie les positions de l'admin toutes les 3 secondes
   - Nouvelle position détectée → copie sur tous les followers actifs
   - Calcul automatique du volume selon les settings

## 🎯 Prochaines étapes

1. **Crée ton compte admin**:
   - Inscris-toi sur l'app
   - Dans Supabase, mets `is_admin = true`
   - Reconnecte-toi

2. **Ajoute ton compte MT5 master**:
   - Va sur `/admin/dashboard`
   - Clique sur "Configurer le compte master"
   - Ajoute tes credentials MT5

3. **Lance le service**:
   ```bash
   npm run copy-trading
   ```

4. **Teste avec un compte démo**:
   - Crée un compte utilisateur (incognito)
   - Ajoute un compte MT5 démo
   - Ouvre une position sur ton compte admin
   - Vérifie qu'elle apparaît sur le compte follower!

## 🔧 Monitoring

### Logs en temps réel:

Le service affiche:
- ✅ Connexions réussies
- 📊 Nouvelles positions détectées
- 👥 Nombre de followers
- ✅/❌ Résultat de chaque copie

### Dashboard MetaApi:

https://app.metaapi.cloud/
- États des comptes
- Positions ouvertes
- Historique des trades
- Métriques

## 💡 Tips

**Volume trop petit?**
- Par défaut, le volume est calculé en fonction du capital
- Ajuste dans `/settings` → "Taille de position"

**Compte ne se connecte pas?**
- Vérifie login/password/server dans MetaApi dashboard
- Certains brokers bloquent les API tierces
- Utilise un compte démo pour tester d'abord

**Latence?**
- Normal: 1-3 secondes de délai
- MetaApi → Cloud → Ta machine → Cloud → MT5
- Pour HFT, considère un VPS près des serveurs MetaApi

## 📚 Documentation MetaApi

- [Getting Started](https://metaapi.cloud/docs/client/)
- [API Reference](https://metaapi.cloud/docs/client/reference/)
- [Exemples](https://github.com/metaapi/metaapi-node.js-client/tree/master/examples)

## 🆓 Limites gratuites

Plan gratuit MetaApi:
- ✅ 1 compte connecté
- ✅ Toutes les fonctionnalités
- ✅ Copy trading illimité

Pour plusieurs comptes: upgrade sur metaapi.cloud

