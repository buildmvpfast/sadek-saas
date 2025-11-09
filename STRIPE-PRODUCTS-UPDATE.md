# Mise à Jour des Produits Stripe

## 📋 Nouveaux Prix

### Plan Basique Mensuel
- **Prix:** 29,99€ / mois
- **Product ID actuel:** `prod_TOJi07OHG8AVUc`
- **Action:** Mettre à jour le prix dans Stripe Dashboard

### Plan Basique Annuel
- **Prix:** 22,99€ / mois × 12 = **275,88€ / an**
- **Product ID actuel:** `prod_TOJkO0xDiqmvZn`
- **Action:** Mettre à jour le prix dans Stripe Dashboard

## 🔧 Mise à Jour dans Stripe Dashboard

### Étape 1: Mettre à Jour le Plan Mensuel

1. Aller sur [Stripe Dashboard](https://dashboard.stripe.com) → **Products**
2. Trouver le produit `prod_TOJi07OHG8AVUc` (Plan Basic Mensuel)
3. Cliquer sur le produit
4. Dans la section **Pricing**, cliquer sur le prix existant
5. **Désactiver l'ancien prix** (ou le garder si tu veux garder les anciens abonnements)
6. **Créer un nouveau prix:**
   - **Amount:** `29.99` (en euros, donc Stripe le convertira en centimes: 2999)
   - **Billing period:** Monthly
   - **Recurring:** Oui
7. **Activer le nouveau prix**
8. **Noter le nouveau Price ID** (commence par `price_...`)

### Étape 2: Mettre à Jour le Plan Annuel

1. Trouver le produit `prod_TOJkO0xDiqmvZn` (Plan Basic Annuel)
2. Cliquer sur le produit
3. Dans la section **Pricing**, cliquer sur le prix existant
4. **Désactiver l'ancien prix**
5. **Créer un nouveau prix:**
   - **Amount:** `275.88` (en euros, donc Stripe le convertira en centimes: 27588)
   - **Billing period:** Yearly (ou Annual)
   - **Recurring:** Oui
7. **Activer le nouveau prix**
8. **Noter le nouveau Price ID**

### Étape 3: Vérifier

1. Vérifier que les nouveaux prix sont actifs
2. Vérifier que les montants sont corrects:
   - Mensuel: 29,99€
   - Annuel: 275,88€

## ⚠️ Important

- Les **anciens abonnements** continueront avec leur ancien prix jusqu'à leur renouvellement
- Les **nouveaux abonnements** utiliseront les nouveaux prix
- Si tu veux que tous les abonnements utilisent le nouveau prix, il faut les migrer manuellement dans Stripe

## 📝 Notes

- Le code utilise les **Product IDs**, pas les Price IDs
- Le code récupère automatiquement le premier prix actif du produit
- Donc pas besoin de modifier le code, juste mettre à jour les prix dans Stripe

## ✅ Vérification

Après la mise à jour dans Stripe:

1. Tester un nouvel abonnement mensuel → devrait être 29,99€
2. Tester un nouvel abonnement annuel → devrait être 275,88€
3. Vérifier dans Stripe Dashboard → Subscriptions que les nouveaux abonnements ont les bons prix

