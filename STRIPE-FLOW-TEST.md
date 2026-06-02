# Guide de Test du Flow Stripe

## ✅ Checklist de Configuration

### ⚠️ IMPORTANT: Stripe LIVE (Production)

**Tu utilises Stripe LIVE, pas test!** Les paiements sont RÉELS.

### 1. Variables d'Environnement Vercel

Vérifier que toutes ces variables sont configurées avec les clés **LIVE** :

```env
STRIPE_SECRET_KEY=sk_live_<REDACTED>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_51SItfhGW0nj93dcTiMDkrrlH1YzEKkGBIiYxMlPCJH0gynRAmX0ROwFKEtHpQHnDEIVOr6yowYdvqUSBIAFLuICC00YnVByz
STRIPE_WEBHOOK_SECRET=whsec_... (secret du webhook LIVE)
NEXT_PUBLIC_APP_URL=https://sadek-saas.vercel.app
```

**⚠️ Vérifier que les clés commencent par `sk_live_` et `pk_live_` (pas `sk_test_` ou `pk_test_`)**

### 2. Webhook Stripe Configuré (LIVE)

- **Mode:** LIVE (pas test!)
- URL: `https://sadek-saas.vercel.app/api/webhook`
- Événements:
  - ✅ `checkout.session.completed`
  - ✅ `customer.subscription.updated`
  - ✅ `customer.subscription.deleted`
- **Secret:** Récupérer le secret du webhook LIVE (commence par `whsec_`)

### 3. Produits Stripe Vérifiés (LIVE)

- Plan Mensuel: `prod_TOJi07OHG8AVUc`
- Plan Annuel: `prod_TOJkO0xDiqmvZn`

**Vérifier dans Stripe Dashboard (mode LIVE) → Products** que ces produits existent et ont des prix actifs.

---

## 🧪 Test du Flow Complet

### Étape 1: Créer un Compte Test

1. Aller sur `https://sadek-saas.vercel.app/auth/signup`
2. Créer un compte avec un email test
3. Vérifier que tu es redirigé vers `/subscription-required`

### Étape 2: Tester l'Abonnement Mensuel

1. Sur la page `/subscription-required`, cliquer sur "🚀 Commencer" (plan mensuel)
2. Tu devrais être redirigé vers Stripe Checkout (LIVE - Production)
3. **⚠️ ATTENTION: C'est Stripe LIVE, les paiements sont RÉELS**
   - Utiliser une vraie carte de crédit
   - Le paiement sera réellement débité
   - Pour tester sans payer, créer un abonnement test dans Stripe Dashboard
4. Cliquer sur "Subscribe" ou "S'abonner"
5. Tu devrais être redirigé vers `/subscription?success=true`

### Étape 3: Vérifier l'Activation

1. Vérifier dans Supabase:
```sql
SELECT 
  user_id,
  status,
  stripe_customer_id,
  stripe_subscription_id,
  current_period_start,
  current_period_end
FROM subscriptions
WHERE user_id = 'TON_USER_ID';
```

Tu devrais voir:
- `status: 'active'`
- `stripe_customer_id` rempli
- `stripe_subscription_id` rempli
- Dates de période correctes

2. Vérifier que tu peux accéder au dashboard:
   - Aller sur `/dashboard`
   - Tu ne devrais plus être redirigé vers `/subscription-required`

### Étape 4: Tester l'Abonnement Annuel

1. Se déconnecter
2. Créer un nouveau compte test
3. Cliquer sur "💎 Meilleure Offre" (plan annuel)
4. **⚠️ Compléter le paiement avec une vraie carte (LIVE)**
5. Vérifier que l'abonnement est actif

### Étape 5: Tester la Gestion d'Abonnement

1. Aller sur `/subscription`
2. Cliquer sur "Gérer mon abonnement"
3. Tu devrais être redirigé vers Stripe Customer Portal
4. Tu peux:
   - Voir les détails de l'abonnement
   - Annuler l'abonnement
   - Mettre à jour la méthode de paiement

### Étape 6: Tester l'Annulation

1. Dans Stripe Customer Portal, annuler l'abonnement
2. Vérifier dans Supabase que `status` passe à `'canceled'`
3. Vérifier que tu es redirigé vers `/subscription-required` quand tu essaies d'accéder au dashboard

---

## 🔍 Vérification des Webhooks (LIVE)

### Voir les Webhooks Reçus

1. Aller sur **Stripe Dashboard (mode LIVE)** → Developers → Webhooks
2. Cliquer sur ton webhook LIVE
3. Onglet "Events" pour voir tous les événements reçus

### ⚠️ Tester un Webhook en LIVE

**Attention:** En mode LIVE, tu ne peux pas envoyer de webhook de test. Les webhooks sont automatiquement envoyés lors des vrais événements (paiements réels).

Pour tester:
1. Faire un vrai paiement (ou utiliser une carte de test en mode LIVE si configurée)
2. Vérifier les logs Vercel pour voir si le webhook est reçu
3. Vérifier dans Stripe Dashboard → Webhooks → Events

---

## 🐛 Dépannage

### Problème: "URL de checkout non reçue"

**Solutions:**
- Vérifier que `STRIPE_SECRET_KEY` est correct
- Vérifier que les produits Stripe existent
- Vérifier les logs Vercel pour voir l'erreur exacte

### Problème: Abonnement créé mais pas activé

**Solutions:**
- Vérifier que le webhook Stripe est configuré
- Vérifier que `STRIPE_WEBHOOK_SECRET` est correct
- Vérifier les logs Vercel pour voir si le webhook est reçu
- Vérifier que `user_id` est bien dans les `metadata` du checkout

### Problème: Redirection vers subscription-required après paiement

**Solutions:**
- Vérifier que le webhook a bien mis à jour l'abonnement
- Vérifier que `status` est bien `'active'` dans Supabase
- Attendre quelques secondes (le webhook peut prendre du temps)
- Rafraîchir la page

### Problème: "No subscription found" dans Customer Portal

**Solutions:**
- Vérifier que `stripe_customer_id` est bien rempli dans la table `subscriptions`
- Vérifier que le webhook `checkout.session.completed` a bien été reçu

---

## 📊 Logs à Surveiller

### Logs Vercel

- ✅ `Subscription activated for user ...` - Webhook reçu et traité
- ❌ `Error updating subscription:` - Erreur lors de la mise à jour
- ❌ `No user_id in session metadata` - Problème avec les metadata

### Logs Stripe

- Vérifier dans Stripe Dashboard → Developers → Logs
- Voir tous les appels API et les erreurs

---

## ✅ Checklist Finale (LIVE)

- [ ] Variables d'environnement configurées dans Vercel avec clés **LIVE** (`sk_live_`, `pk_live_`)
- [ ] Webhook Stripe LIVE configuré avec l'URL de production
- [ ] `STRIPE_WEBHOOK_SECRET` du webhook LIVE ajouté dans Vercel
- [ ] Produits Stripe LIVE vérifiés (`prod_TOJi07OHG8AVUc`, `prod_TOJkO0xDiqmvZn`)
- [ ] ⚠️ **Test avec un vrai paiement** (ou carte de test LIVE si configurée)
- [ ] Vérification que l'abonnement est actif dans Supabase après paiement
- [ ] Test de la gestion d'abonnement (Customer Portal)
- [ ] Test de l'annulation
- [ ] Vérification que le middleware redirige correctement

## ⚠️ IMPORTANT: Mode LIVE

**Tu es en mode PRODUCTION avec Stripe LIVE:**
- Les paiements sont **RÉELS**
- Les clients seront **VRAIMENT débités**
- Les webhooks sont envoyés automatiquement lors des vrais événements
- Pas de mode test disponible (sauf si tu configures des cartes de test en LIVE)

---

## 🎯 Résultat Attendu

Après un paiement réussi:

1. ✅ Redirection vers `/subscription?success=true`
2. ✅ Abonnement créé/mis à jour dans Supabase avec `status: 'active'`
3. ✅ Accès au dashboard sans redirection
4. ✅ Customer Portal accessible depuis `/subscription`
5. ✅ Renouvellement automatique géré par Stripe
6. ✅ Annulation gérée correctement

