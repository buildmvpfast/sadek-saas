# 📋 Guide des Brokers MT5

## Comment trouver les informations de connexion MT5

### 🔍 Trouver le nom du serveur

**Méthode 1: Dans MT5 Desktop**
1. Ouvrez MetaTrader 5
2. Fichier → Se connecter au compte de trading
3. Le serveur apparaît dans la liste (ex: `ICMarkets-Live`)

**Méthode 2: Email du broker**
- Cherchez l'email de bienvenue de votre broker
- Le serveur est indiqué avec vos identifiants

**Méthode 3: Site du broker**
- Connectez-vous à votre espace client
- Section "Plateformes de trading" ou "MT5"

### 🔑 Informations requises

Pour connecter un compte MT5:
- **Broker**: Sélectionné depuis la liste
- **Serveur**: Nom exact du serveur MT5
- **Login**: Votre numéro de compte (numérique)
- **Mot de passe**: Votre mot de passe MT5

## 📊 Brokers populaires et leurs serveurs

### IC Markets
- **Live**: `ICMarketsEU-Live` ou `ICMarketsSC-Live`
- **Demo**: `ICMarkets-Demo`
- Site: icmarkets.com

### XM Global
- **Live**: `XMGlobal-Real`
- **Demo**: `XMGlobal-Demo`
- Site: xm.com

### Pepperstone
- **Live**: `Pepperstone-Live`
- **Demo**: `Pepperstone-Demo`
- Site: pepperstone.com

### Exness
- **Live**: `Exness-MT5Live`
- **Demo**: `Exness-MT5Demo`
- Site: exness.com

### FTMO
- **Live**: `FTMO-Server`
- **Demo**: `FTMO-Demo`
- Site: ftmo.com

### Admiral Markets
- **Live**: `AdmiralMarkets-Live`
- **Demo**: `AdmiralMarkets-Demo`
- Site: admiralmarkets.com

### FBS
- **Live**: `FBS-Real`
- **Demo**: `FBS-Demo`
- Site: fbs.com

### RoboForex
- **Live**: `RoboForex-ECN`
- **Demo**: `RoboForex-Demo`
- Site: roboforex.com

## ⚠️ Notes importantes

### Serveur pas dans la liste?

Si votre broker n'est pas listé:
1. Sélectionnez "Autre (serveur personnalisé)"
2. Entrez le nom exact du serveur manuellement

### Erreur de connexion?

Vérifiez:
- ✅ Le nom du serveur est **exactement** celui de MT5
- ✅ Le login est correct (nombre à 8-10 chiffres généralement)
- ✅ Le mot de passe est bon
- ✅ Le compte n'est pas expiré (pour comptes prop firm)
- ✅ Le broker autorise les connexions API tierces

### Sécurité

- 🔒 Les mots de passe sont chiffrés
- 🔒 MetaApi utilise des connexions SSL/TLS
- 🔒 Jamais stocké en clair
- 💡 **Recommandé**: Utilisez un mot de passe investisseur (lecture seule) si possible

### Type de compte

**Compte réel (Live)**:
- Pour le trading avec de l'argent réel
- Requiert un abonnement actif
- Les positions sont copiées en temps réel

**Compte démo**:
- Pour tester sans risque
- Gratuit, pas d'abonnement nécessaire
- Parfait pour vérifier que tout fonctionne

**Compte prop firm** (FTMO, etc):
- Fonctionne comme un compte réel
- Vérifiez que les API tierces sont autorisées
- Certaines firms interdisent le copy trading

## 🆘 Problèmes fréquents

### "Invalid credentials"
→ Vérifiez login/password dans MT5 directement d'abord

### "Server not found"
→ Le nom du serveur n'est pas exact (sensible à la casse)

### "Connection timeout"
→ Le broker bloque peut-être les connexions API

### Mon broker n'est pas listé
→ Pas de problème! Sélectionnez "Autre" et entrez le serveur manuellement

## 📞 Support broker

Si vous ne trouvez pas vos infos:
1. Contactez le support de votre broker
2. Demandez: "Quelles sont mes informations de connexion MT5?"
3. Mentionnez que vous voulez connecter via API MetaApi

## 🧪 Tester d'abord

**Avant de connecter votre compte réel:**
1. Créez un compte démo chez votre broker
2. Connectez-le dans le SaaS
3. Vérifiez que tout fonctionne
4. Ensuite connectez votre compte réel

## 📱 Où obtenir MT5

Si vous n'avez pas encore MT5:
- Desktop: Téléchargez depuis le site de votre broker
- Mobile: App Store / Google Play "MetaTrader 5"
- Web: https://trade.metatrader5.com

## ✅ Checklist connexion

Avant d'ajouter un compte:
- [ ] J'ai ouvert MT5 et vérifié que je peux me connecter
- [ ] J'ai noté le nom exact du serveur
- [ ] J'ai mon numéro de compte
- [ ] J'ai mon mot de passe
- [ ] Mon abonnement au SaaS est actif (si compte réel)
- [ ] J'ai configuré mes settings de trading (/settings)

Une fois connecté:
- [ ] Le compte apparaît dans "Comptes MT5"
- [ ] Le statut est "Actif"
- [ ] Je vois les positions se copier quand l'admin trade

## 💡 Best practices

1. **Commencez avec un démo**
2. **Testez les settings** (lot/pourcentage)
3. **Surveillez les premiers trades** copiés
4. **Ajustez si nécessaire**
5. **Passez au réel** une fois confiant

## 🔗 Liens utiles

- Dashboard MetaApi: https://app.metaapi.cloud
- Liste complète des brokers MT5: https://www.metatrader5.com/en/brokers
- Support MetaApi: https://metaapi.cloud/docs/

