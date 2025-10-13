# 🧪 Guide de Test Local

## Option 1: Test complet avec Supabase uniquement

### 1. Setup Supabase

```bash
# 1. Va sur https://supabase.com
# 2. Crée un projet (gratuit)
# 3. Attends 2 minutes que le projet se crée
```

### 2. Exécute le schéma SQL

Dans Supabase:
- SQL Editor (à gauche)
- New Query
- Copie TOUT le contenu de `supabase-schema.sql`
- Run

### 3. Récupère tes clés

Dans Supabase:
- Settings > API
- Copie:
  - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
  - anon public → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - service_role (clique "Reveal") → `SUPABASE_SERVICE_ROLE_KEY`

### 4. Crée .env.local

```env
NEXT_PUBLIC_SUPABASE_URL=ta_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=ta_cle_anon
SUPABASE_SERVICE_ROLE_KEY=ta_cle_service

# Pour tester SANS Stripe, mets des valeurs bidon
STRIPE_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Démarre l'app

```bash
npm install
npm run dev
```

### 6. Teste le flow

#### A. Créer un utilisateur
1. Va sur http://localhost:3000
2. Clique "S'inscrire"
3. Remplis le formulaire
4. Tu seras redirigé vers `/subscription` (normal, pas d'abo actif)

#### B. Bypass le système d'abonnement (pour tester)

**Méthode 1: Activer l'abonnement manuellement**

Dans Supabase Table Editor:
1. Table `subscriptions`
2. Trouve ta ligne (ton user_id)
3. Change `status` de `inactive` à `active`
4. Recharge la page → tu peux accéder au dashboard!

**Méthode 2: Désactiver le middleware temporairement**

Commente le check d'abonnement dans `middleware.ts`:

```typescript
// Trouve ces lignes et commente-les:
/*
if (subscription?.status !== 'active' && subscription?.status !== 'trialing') {
  if (req.nextUrl.pathname !== '/subscription') {
    return NextResponse.redirect(new URL('/subscription', req.url))
  }
}
*/
```

#### C. Créer un admin

Dans Supabase Table Editor:
1. Table `profiles`
2. Trouve ton profil
3. Change `is_admin` à `true`
4. Déconnecte/reconnecte
5. Tu verras le dashboard admin

## Option 2: Test avec Stripe (paiement)

### 1. Crée un compte Stripe

- Va sur https://stripe.com
- Active le mode Test
- Dashboard > Developers > API keys
- Copie les clés test

### 2. Mets les vraies clés dans .env.local

```env
STRIPE_SECRET_KEY=sk_test_51xxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx (voir ci-dessous)
```

### 3. Configure le webhook Stripe (local)

**Option A: Stripe CLI (recommandé)**

```bash
# Installe Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward les webhooks vers ton local
stripe listen --forward-to localhost:3000/api/webhook
# Copie le webhook secret qui s'affiche
```

**Option B: Sans webhook (test basique)**

Mets un faux secret:
```env
STRIPE_WEBHOOK_SECRET=whsec_test123
```

Tu pourras tester le checkout mais pas les webhooks.

### 4. Teste un paiement

1. Va sur `/subscription`
2. Clique "S'abonner"
3. Utilise la carte test: `4242 4242 4242 4242`
4. Date: n'importe quelle date future
5. CVC: n'importe quel 3 chiffres

## Option 3: Test du Copy Trading (avancé)

### Prérequis: MT5 + ZeroMQ

**Sans MT5 réel:**

Tu peux simuler en appelant directement l'API:

```bash
# Démarre le service
npm run copy-trading

# Dans un autre terminal, simule un trade
curl -X POST http://localhost:3000/api/start-copy-trading \
  -H "Content-Type: application/json"
```

**Avec MT5:**

1. Installe MetaTrader 5
2. Télécharge [MQL-ZMQ](https://github.com/dingmaotu/mql-zmq)
3. Compile `mt5-zmq-ea/CopyTradingEA.mq5`
4. Attache l'EA à un graphique
5. Lance `npm run copy-trading`

## 🎯 Checklist de test

### Frontend
- [ ] Signup fonctionne
- [ ] Login fonctionne
- [ ] Dashboard utilisateur s'affiche
- [ ] Ajout de compte MT5 fonctionne
- [ ] Paramètres de trading s'enregistrent
- [ ] Page abonnement s'affiche

### Admin
- [ ] Dashboard admin accessible
- [ ] Liste des utilisateurs s'affiche
- [ ] Historique des trades s'affiche

### Base de données
- [ ] Table profiles créée
- [ ] Table mt5_accounts créée
- [ ] Table subscriptions créée
- [ ] Trigger sur signup fonctionne

## 🐛 Problèmes fréquents

### "Invalid API key"
→ Vérifie que tes clés Supabase sont correctes dans .env.local

### "Redirect to /subscription"
→ Active manuellement l'abonnement dans Supabase (voir ci-dessus)

### "Cannot find module"
→ `rm -rf node_modules && npm install`

### Page blanche
→ Vérifie la console navigateur (F12) et le terminal

### Erreur Stripe
→ Mets des valeurs bidon si tu veux tester sans Stripe d'abord

## 📊 Données de test

Pour tester rapidement, insère dans Supabase:

```sql
-- Activer ton abonnement
UPDATE subscriptions 
SET status = 'active', 
    current_period_end = NOW() + INTERVAL '30 days'
WHERE user_id = 'ton_user_id';

-- Ajouter un compte MT5 de test
INSERT INTO mt5_accounts (user_id, broker_id, account_number, password_encrypted)
VALUES (
  'ton_user_id',
  (SELECT id FROM brokers WHERE name = 'IC Markets' LIMIT 1),
  123456,
  'cGFzc3dvcmQ=' -- "password" en base64
);
```

## ✅ Flow de test recommandé

1. **Jour 1**: Setup Supabase + test auth uniquement
2. **Jour 2**: Active l'abo manuellement + teste le dashboard
3. **Jour 3**: Setup Stripe + teste les paiements
4. **Jour 4**: Setup MT5 + teste le copy trading

Pas besoin de tout faire d'un coup!

