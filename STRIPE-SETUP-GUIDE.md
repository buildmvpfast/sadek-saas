# Configuration Stripe Complète

## 📋 Informations Fournies

- **Clé Publique (Live):** `pk_live_51SItfhGW0nj93dcTiMDkrrlH1YzEKkGBIiYxMlPCJH0gynRAmX0ROwFKEtHpQHnDEIVOr6yowYdvqUSBIAFLuICC00YnVByz`
- **Clé Secrète (Live):** `sk_live_<REDACTED>`
- **Plan Basic Mensuel:** `prod_TOJi07OHG8AVUc`
- **Plan Basic Annuel:** `prod_TOJkO0xDiqmvZn`

## 🔧 Configuration dans le Code

Le code a été mis à jour pour utiliser ces produits. Vérifie que:

1. ✅ `app/api/create-checkout-session/route.ts` utilise les bons product IDs
2. ✅ Les variables d'environnement sont configurées avec les clés LIVE

## 🔗 Configuration du Webhook Stripe

### Étape 1: Accéder aux Webhooks

1. Aller sur [Stripe Dashboard](https://dashboard.stripe.com)
2. **Developers** (menu de gauche)
3. **Webhooks**

### Étape 2: Créer le Webhook

1. Cliquer sur **"Add endpoint"** (ou **"Add webhook endpoint"**)
2. **Endpoint URL:** 
   - En local (test): `http://localhost:3000/api/webhook`
   - En production: `https://ton-domaine.com/api/webhook` (ou ton URL Render)
3. **Description:** "Sadek Bot SaaS - Webhook Production"
4. **Events to send:** Cliquer sur **"Select events"** et choisir:
   - ✅ `checkout.session.completed` - Quand un paiement est complété
   - ✅ `customer.subscription.updated` - Quand un abonnement est mis à jour (renouvellement, annulation, etc.)
   - ✅ `customer.subscription.deleted` - Quand un abonnement est supprimé
5. Cliquer sur **"Add endpoint"**

### Étape 3: Récupérer le Webhook Secret

1. Une fois le webhook créé, cliquer dessus pour l'ouvrir
2. Dans la section **"Signing secret"**, cliquer sur **"Reveal"** ou **"Click to reveal"**
3. **Copier le secret** (commence par `whsec_...`)
4. **Ajouter dans les variables d'environnement:**
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### Étape 4: Tester le Webhook

#### Option A: Test via Stripe Dashboard

1. Dans la page du webhook, cliquer sur **"Send test webhook"**
2. Sélectionner un événement (ex: `checkout.session.completed`)
3. Vérifier les logs de ton application pour voir si le webhook est reçu

#### Option B: Test avec Stripe CLI (Recommandé pour développement)

```bash
# Installer Stripe CLI: https://stripe.com/docs/stripe-cli
stripe login

# Forwarder les webhooks vers localhost
stripe listen --forward-to localhost:3000/api/webhook

# Dans un autre terminal, déclencher un événement de test
stripe trigger checkout.session.completed
```

## 📊 Vérifier les Produits Stripe

### Vérifier que les Produits Existent

1. Dans Stripe Dashboard → **Products**
2. Vérifier que ces produits existent:
   - `prod_TOJi07OHG8AVUc` (Basic Mensuel)
   - `prod_TOJkO0xDiqmvZn` (Basic Annuel)

### Vérifier les Prix Associés

1. Cliquer sur chaque produit
2. Vérifier qu'il y a un **Price** actif:
   - Mensuel: devrait être récurrent mensuel
   - Annuel: devrait être récurrent annuel

Si les prix n'existent pas ou ne sont pas actifs, il faut les créer dans Stripe Dashboard.

## 🔄 Flux Complet d'Abonnement

### 1. Utilisateur Clique sur "S'abonner"

- Frontend appelle `/api/create-checkout-session` avec `plan: 'monthly'` ou `plan: 'yearly'`
- L'API récupère le `price_id` du produit correspondant
- Crée une session Stripe Checkout
- Redirige l'utilisateur vers Stripe

### 2. Utilisateur Paiement sur Stripe

- L'utilisateur entre ses informations de carte
- Stripe traite le paiement
- Redirige vers `success_url` ou `cancel_url`

### 3. Webhook Reçu

- Stripe envoie `checkout.session.completed` à `/api/webhook`
- Le webhook:
  - Récupère `user_id` depuis `metadata`
  - Met à jour la table `subscriptions` avec:
    - `stripe_customer_id`
    - `stripe_subscription_id`
    - `status: 'active'`

### 4. Renouvellement Automatique

- À chaque période (mensuel/annuel), Stripe facture automatiquement
- Envoie `customer.subscription.updated` avec le nouveau `current_period_end`
- Le webhook met à jour la date de fin

### 5. Annulation

- Si l'utilisateur annule, Stripe envoie `customer.subscription.deleted`
- Le webhook met `status: 'canceled'`
- Les positions ouvertes sont fermées automatiquement

## 🐛 Dépannage

### Problème: "No price found for this product"

**Solution:**
- Vérifier que les produits ont des prix actifs dans Stripe
- Vérifier que les product IDs sont corrects dans le code

### Problème: Webhook non reçu

**Solutions:**
- Vérifier que l'URL du webhook est correcte dans Stripe
- Vérifier que `STRIPE_WEBHOOK_SECRET` est correct
- Vérifier les logs de l'application
- Tester avec Stripe CLI en local

### Problème: "Webhook signature verification failed"

**Solution:**
- Vérifier que `STRIPE_WEBHOOK_SECRET` correspond au secret du webhook dans Stripe
- Si tu as plusieurs webhooks (test/prod), utiliser le bon secret

### Problème: Abonnement créé mais pas activé

**Solutions:**
- Vérifier les logs du webhook
- Vérifier que `user_id` est bien dans les `metadata` du checkout
- Vérifier que la table `subscriptions` existe et a les bonnes colonnes

## 📝 Checklist Finale

- [ ] Clés Stripe LIVE configurées dans les variables d'environnement
- [ ] Webhook créé dans Stripe Dashboard
- [ ] Webhook secret récupéré et ajouté aux variables d'environnement
- [ ] URL du webhook pointant vers `/api/webhook` (prod)
- [ ] Événements sélectionnés: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- [ ] Produits vérifiés dans Stripe Dashboard
- [ ] Test d'un abonnement complet effectué
- [ ] Vérification que l'abonnement est bien activé dans la base de données

## 🎯 URLs Importantes

- **Stripe Dashboard:** https://dashboard.stripe.com
- **Webhooks:** https://dashboard.stripe.com/webhooks
- **Products:** https://dashboard.stripe.com/products
- **API Keys:** https://dashboard.stripe.com/apikeys

