# MT5 Copy Trading SaaS

Plateforme de copy trading MetaTrader 5 avec abonnement et gestion multi-comptes.

## 🚀 Fonctionnalités

- ✅ Authentification avec Supabase
- ✅ Connexion multi-comptes MT5
- ✅ Copy trading automatique en temps réel
- ✅ Gestion de position par lot fixe ou pourcentage
- ✅ Dashboard admin et utilisateur
- ✅ Système d'abonnement avec Stripe
- ✅ Fermeture automatique des positions si abonnement inactif

## 📋 Prérequis

- Node.js 18+
- Compte Supabase
- Compte Stripe
- MetaTrader 5 avec ZeroMQ EA installé

## 🛠️ Installation

### 1. Cloner et installer les dépendances

```bash
npm install
```

### 2. Configurer Supabase

1. Créer un projet sur [Supabase](https://supabase.com)
2. Exécuter le script SQL dans `supabase-schema.sql`
3. Copier les clés d'API

### 3. Configurer les variables d'environnement

Créer un fichier `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Configurer Stripe

1. Créer un produit d'abonnement mensuel à 49€
2. Configurer le webhook pointant vers `/api/webhook`
3. Copier le webhook secret

### 5. Installer le MT5 ZeroMQ EA

1. Télécharger [MQL-ZMQ](https://github.com/dingmaotu/mql-zmq)
2. Copier les fichiers dans `MT5/MQL5/Include/Zmq`
3. Compiler et installer `mt5-zmq-ea/CopyTradingEA.mq5`
4. Attacher l'EA au graphique MT5

## 🏃 Démarrage

### Démarrer l'application Next.js

```bash
npm run dev
```

### Démarrer le service de copy trading

Dans un terminal séparé:

```bash
npm run copy-trading
```

## 📱 Utilisation

### Pour les utilisateurs

1. S'inscrire sur la plateforme
2. Souscrire à l'abonnement (49€/mois)
3. Ajouter un ou plusieurs comptes MT5
4. Configurer les paramètres de trading (lot fixe ou %)
5. Les trades de l'admin seront automatiquement copiés

### Pour l'admin

1. Se connecter avec un compte admin
2. Configurer le compte MT5 master
3. Trader normalement sur MT5
4. Les positions sont automatiquement copiées sur tous les comptes actifs

## 🔧 Configuration MT5

### Brokers supportés par défaut

- IC Markets
- XM Global
- Admiral Markets
- FTMO
- Pepperstone

Vous pouvez ajouter d'autres brokers dans la base de données.

### ZeroMQ Configuration

Le service utilise ZeroMQ pour communiquer avec MT5:
- Port par défaut: 5555
- Protocol: TCP
- Format: JSON

## 📊 Architecture

```
├── app/                    # Pages Next.js
│   ├── api/               # API routes
│   ├── auth/              # Authentification
│   ├── dashboard/         # Dashboard utilisateur
│   ├── admin/             # Dashboard admin
│   └── ...
├── services/              # Services backend
│   ├── mt5-connector.ts   # Connecteur MT5
│   └── copy-trading.ts    # Logique copy trading
├── components/            # Composants React
├── lib/                   # Utilities
└── types/                 # TypeScript types
```

## 🔒 Sécurité

- Les mots de passe MT5 sont chiffrés en base64 (utiliser un vrai chiffrement en production)
- Row Level Security activé sur Supabase
- Vérification des abonnements via middleware
- API protégées par authentification

## 🚨 Important pour la production

1. **Chiffrement**: Utiliser un vrai système de chiffrement pour les mots de passe MT5 (crypto-js, bcrypt)
2. **ZeroMQ**: Sécuriser la connexion ZeroMQ (authentification, SSL)
3. **Monitoring**: Ajouter des logs et monitoring (Sentry, LogRocket)
4. **Tests**: Ajouter des tests unitaires et d'intégration
5. **Rate limiting**: Ajouter du rate limiting sur les API
6. **Backup**: Mettre en place des backups de la base de données
7. **VPS**: Héberger le service copy trading sur un VPS dédié

## 📝 Commandes NPM

```bash
npm run dev          # Démarrer en mode développement
npm run build        # Build pour production
npm run start        # Démarrer en production
npm run copy-trading # Démarrer le service de copy trading
```

## 🤝 Support

Pour toute question ou problème, contactez le support.

## 📄 Licence

Propriétaire - Tous droits réservés

