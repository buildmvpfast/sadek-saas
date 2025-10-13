# Guide de Configuration Complet

## 🚀 Installation Rapide

### Étape 1: Installation des dépendances

```bash
npm install
```

### Étape 2: Configuration Supabase

1. Créer un compte sur [Supabase](https://supabase.com)
2. Créer un nouveau projet
3. Aller dans SQL Editor
4. Copier/coller le contenu de `supabase-schema.sql`
5. Exécuter le script
6. Aller dans Settings > API pour récupérer:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### Étape 3: Configuration Stripe

1. Créer un compte sur [Stripe](https://stripe.com)
2. Récupérer les clés API dans Developers > API keys:
   - `STRIPE_SECRET_KEY` (sk_test_...)
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (pk_test_...)
3. Configurer un webhook:
   - URL: `http://localhost:3000/api/webhook` (ou votre domaine en prod)
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Récupérer le `STRIPE_WEBHOOK_SECRET`

### Étape 4: Variables d'environnement

Créer `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Étape 5: Créer le compte admin

1. Démarrer l'app: `npm run dev`
2. S'inscrire avec un email
3. Dans Supabase, aller dans Table Editor > profiles
4. Trouver votre profil et mettre `is_admin` à `true`
5. Se déconnecter et se reconnecter

### Étape 6: Installation MT5 ZeroMQ

#### Option A: Utiliser l'EA fourni

1. Télécharger [MQL-ZMQ library](https://github.com/dingmaotu/mql-zmq/releases)
2. Extraire dans `MT5_DATA_FOLDER/MQL5/Include/Zmq/`
3. Ouvrir MetaEditor dans MT5
4. Ouvrir `mt5-zmq-ea/CopyTradingEA.mq5`
5. Compiler (F7)
6. Drag & drop l'EA sur un graphique
7. Activer "Allow DLL imports" dans les paramètres

#### Option B: Alternative REST API

Si ZeroMQ pose problème, vous pouvez créer une REST API dans MT5:

1. Utiliser [MT5 REST API](https://github.com/vdemydiuk/mtapi)
2. Modifier `services/mt5-connector.ts` pour utiliser HTTP au lieu de ZeroMQ

### Étape 7: Lancer l'application

Terminal 1 - Application web:
```bash
npm run dev
```

Terminal 2 - Service de copy trading:
```bash
npm run copy-trading
```

## 📱 Test de l'application

### Tester le flux utilisateur

1. Créer un compte utilisateur
2. Aller sur `/subscription`
3. S'abonner (utiliser carte test Stripe: `4242 4242 4242 4242`)
4. Aller sur `/mt5-accounts`
5. Ajouter un compte MT5
6. Configurer les paramètres dans `/settings`
7. Vérifier le dashboard

### Tester le flux admin

1. Se connecter avec le compte admin
2. Aller sur `/admin/dashboard`
3. Ajouter votre compte MT5 master
4. Ouvrir une position sur MT5
5. Vérifier qu'elle est copiée sur les comptes utilisateurs

## 🔧 Dépannage

### Problème: ZeroMQ ne se connecte pas

**Solution:**
- Vérifier que l'EA est actif sur MT5
- Vérifier le port (5555 par défaut)
- Vérifier que "Allow DLL imports" est activé
- Redémarrer MT5

### Problème: Les trades ne sont pas copiés

**Solutions:**
- Vérifier que le service copy-trading tourne
- Vérifier que l'abonnement est actif
- Vérifier les logs dans le terminal
- Vérifier que les comptes MT5 sont actifs

### Problème: Erreur Stripe webhook

**Solutions:**
- Vérifier le STRIPE_WEBHOOK_SECRET
- En local, utiliser [Stripe CLI](https://stripe.com/docs/stripe-cli) pour forwarder les webhooks
- Commande: `stripe listen --forward-to localhost:3000/api/webhook`

### Problème: Erreur Supabase RLS

**Solution:**
- Vérifier que les policies RLS sont bien créées
- Réexécuter le script `supabase-schema.sql`

## 🚀 Déploiement en Production

### Hébergement recommandé

- **Frontend/API**: Vercel
- **Service copy trading**: Railway, Render, ou VPS dédié
- **Base de données**: Supabase (déjà hébergé)

### Checklist de déploiement

- [ ] Configurer les variables d'environnement de prod
- [ ] Mettre à jour NEXT_PUBLIC_APP_URL
- [ ] Configurer le webhook Stripe avec l'URL de prod
- [ ] Activer HTTPS partout
- [ ] Chiffrer les mots de passe MT5 avec un vrai système (crypto-js)
- [ ] Ajouter des logs (Sentry)
- [ ] Configurer les backups Supabase
- [ ] Tester le flux complet en production

### Déploiement Vercel

```bash
vercel --prod
```

### Déploiement service copy trading (Railway)

1. Créer un nouveau projet sur Railway
2. Connecter le repo
3. Configurer les variables d'environnement
4. Ajouter un Procfile:
```
worker: npm run copy-trading
```

## 📊 Monitoring

### Logs à surveiller

- Connexions/déconnexions MT5
- Trades copiés (succès/échec)
- Erreurs d'abonnement
- Erreurs de paiement

### Métriques importantes

- Nombre d'utilisateurs actifs
- Taux de succès de copie
- Revenus mensuels
- Uptime du service

## 🔐 Sécurité

### Checklist sécurité

- [ ] Chiffrer les mots de passe MT5 (ne pas utiliser base64 en prod)
- [ ] Activer 2FA pour les admins
- [ ] Rate limiting sur les API
- [ ] Validation des inputs côté serveur
- [ ] HTTPS obligatoire
- [ ] Backups réguliers
- [ ] Monitoring des accès suspects

## 💰 Tarification

Actuellement fixé à 49€/mois. Pour modifier:

1. Changer le prix dans `app/api/create-checkout-session/route.ts`
2. Mettre à jour l'affichage dans `app/subscription/page.tsx`

## 🆘 Support

En cas de problème:

1. Vérifier les logs du terminal
2. Vérifier les logs Supabase
3. Vérifier les logs MT5
4. Consulter la documentation des dépendances
5. Ouvrir une issue sur GitHub

## 📚 Ressources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Stripe Documentation](https://stripe.com/docs)
- [MT5 Documentation](https://www.mql5.com/en/docs)
- [ZeroMQ MQL Documentation](https://github.com/dingmaotu/mql-zmq)

