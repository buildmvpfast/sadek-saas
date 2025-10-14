# 🧪 Guide de Test - Paywall & Abonnements

## 🎯 Fonctionnement

Le système redirige automatiquement les utilisateurs **sans abonnement actif** vers `/subscription-required`.

### Flow Utilisateur:

1. **Signup** → Abonnement créé avec `status: 'inactive'`
2. **Login** → Middleware vérifie l'abonnement
3. **Si inactive** → Redirection vers `/subscription-required` (Paywall)
4. **Si active** → Accès au dashboard

---

## 🧪 Mode Test Activé

**En mode test, cliquer sur "Commencer" ou "Meilleure Offre" active l'abonnement instantanément!**

Pas besoin de Stripe, c'est validé en 1 clic pour faciliter les tests.

---

## 📝 Scénarios de Test

### Test 1: Nouveau Utilisateur Sans Abonnement

1. **Créer un compte:**
   - Va sur `/auth/signup`
   - Inscris-toi avec un nouvel email
   - L'abonnement est créé avec `status = 'inactive'`

2. **Essayer d'accéder au dashboard:**
   - Va sur `/dashboard`
   - Tu es **redirigé vers `/subscription-required`** ✅

3. **Activer l'abonnement (mode test):**
   - Clique sur **"Commencer"** (mensuel) ou **"Meilleure Offre"** (annuel)
   - L'abonnement passe à `status = 'active'`
   - Tu es redirigé vers `/dashboard` ✅

---

### Test 2: Utilisateur avec Abonnement Actif

1. **User avec abonnement actif:**
   - Login avec un compte qui a `subscription.status = 'active'`
   - Accès direct au `/dashboard` ✅
   - Aucune redirection vers le paywall

---

### Test 3: Admin (Bypass Paywall)

1. **Admin:**
   - Login avec le compte admin (`sadek@admin.cupped`)
   - Accès direct aux pages admin
   - **Pas de vérification d'abonnement** ✅

---

## 🔧 Scripts SQL Utiles

### Désactiver un abonnement (pour tester le paywall):

```sql
-- Désactiver l'abonnement d'un user
UPDATE subscriptions
SET status = 'inactive'
WHERE user_id = (SELECT id FROM profiles WHERE email = 'test@example.com');
```

### Activer un abonnement manuellement:

```sql
-- Activer l'abonnement d'un user
UPDATE subscriptions
SET 
  status = 'active',
  current_period_start = NOW(),
  current_period_end = NOW() + INTERVAL '1 month'
WHERE user_id = (SELECT id FROM profiles WHERE email = 'test@example.com');
```

### Vérifier le statut d'un user:

```sql
-- Voir l'abonnement d'un user
SELECT 
  p.email,
  p.full_name,
  s.status,
  s.current_period_end
FROM profiles p
JOIN subscriptions s ON s.user_id = p.id
WHERE p.email = 'test@example.com';
```

---

## 📋 Checklist de Test

- [ ] Nouveau user → Redirigé vers paywall
- [ ] Clic sur plan mensuel → Abonnement activé → Dashboard accessible
- [ ] Clic sur plan annuel → Abonnement activé → Dashboard accessible
- [ ] User avec abonnement actif → Accès direct au dashboard
- [ ] User avec abonnement inactif → Redirigé vers paywall
- [ ] Admin → Bypass paywall, accès direct aux pages admin
- [ ] Désactiver un abonnement SQL → User redirigé vers paywall

---

## 🎨 Design du Paywall

### Plans Proposés:

**Mensuel: 29€/mois**
- Copy trading automatique
- Configuration personnalisée (GOLD, SOL, BTC)
- Accès à tous les signaux
- Support communauté
- Multi-comptes MT5

**Annuel: 249€/an** (économie de 99€)
- Tout du plan mensuel
- Support prioritaire
- Multi-comptes MT5 illimités
- Accès anticipé aux nouvelles features
- Badge "Meilleure offre"

---

## 🚀 Passage en Production

### Quand tu veux activer Stripe:

1. **Créer les produits dans Stripe:**
   - Plan Mensuel: 29€/mois
   - Plan Annuel: 249€/an

2. **Modifier `/subscription-required/page.tsx`:**

Remplace la fonction `activateSubscription` par:

```typescript
const activateSubscription = async (plan: 'monthly' | 'yearly') => {
  setLoading(plan)
  setError('')

  try {
    // Appeler l'API Stripe pour créer une session de paiement
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })

    const { url } = await response.json()
    
    // Rediriger vers Stripe Checkout
    window.location.href = url
  } catch (err: any) {
    setError(err.message || 'Erreur lors de la redirection')
    setLoading('')
  }
}
```

3. **Supprimer le badge "MODE TEST"** du paywall

---

## 💡 Notes

- **Mode Test:** Un simple clic active l'abonnement
- **En Production:** Redirige vers Stripe pour le paiement
- **Admins:** Jamais bloqués par le paywall
- **Middleware:** Vérifie l'abonnement à chaque requête

---

Bon test! 🎯

