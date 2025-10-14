# 🔐 Configuration du Compte Admin

## Compte Admin Par Défaut

Le système est configuré avec un compte admin par défaut pour faciliter la configuration initiale.

### Identifiants Admin

```
Email: sadek@admin.cupped
Mot de passe: Qwerty123.123
```

---

## 📝 Installation

### Étape 1: Exécuter le script SQL

1. Allez dans votre projet Supabase: https://supabase.com/dashboard
2. Cliquez sur **"SQL Editor"** dans le menu de gauche
3. Cliquez sur **"New Query"**
4. Copiez tout le contenu de `supabase-create-admin.sql`
5. Collez-le dans l'éditeur
6. Cliquez sur **"Run"** (ou `Cmd/Ctrl + Enter`)

### Étape 2: Vérifier la création

Le script affichera:
```
✅ Admin user created successfully with ID: [UUID]
```

Et un tableau avec les informations:
```
email                  | full_name    | is_admin | subscription_status
-----------------------|--------------|-----------|-----------------
sadek@admin.cupped     | Sadek Admin  | true     | active
```

---

## 🚀 Première Connexion

1. Allez sur: `http://localhost:3000/auth/login`
2. Entrez:
   - **Email:** `sadek@admin.cupped`
   - **Mot de passe:** `Qwerty123.123`
3. Cliquez sur **"Se connecter"**

Vous serez redirigé vers le dashboard admin: `/admin/dashboard`

---

## ⚙️ Configuration Post-Installation

### 1. Ajouter un Compte MT5 Admin

Une fois connecté comme admin:

1. Allez sur: `/admin/mt5-accounts`
2. Cliquez sur **"+ Ajouter un compte"**
3. Remplissez:
   - **Broker:** Votre broker (ex: IC Markets)
   - **Serveur:** Votre serveur MT5 (ex: ICMarketsEU-Live)
   - **Numéro de compte:** Votre numéro MT5
   - **Mot de passe:** Votre mot de passe MT5
4. Cliquez sur **"✓ Ajouter le compte admin"**

### 2. Démarrer le Copy Trading

1. Allez sur: `/admin/copy-trading`
2. Cliquez sur **"▶️ Démarrer"**
3. Le système commence à monitorer vos positions

---

## 🔒 Sécurité

### ⚠️ IMPORTANT - Production

**Pour la production, vous DEVEZ:**

1. **Changer le mot de passe** immédiatement après la première connexion
2. **Activer 2FA** dans les paramètres Supabase
3. **Utiliser un email réel** au lieu de `@admin.cupped`

### Changer le mot de passe

**Option A - Via Supabase Dashboard:**
1. Allez dans **Authentication → Users**
2. Trouvez `sadek@admin.cupped`
3. Cliquez sur le menu ⋮
4. Sélectionnez **"Reset Password"**
5. Utilisez le lien reçu par email

**Option B - Via SQL:**
```sql
-- Changer le mot de passe
UPDATE auth.users 
SET encrypted_password = crypt('NOUVEAU_MOT_DE_PASSE_FORT', gen_salt('bf'))
WHERE email = 'sadek@admin.cupped';
```

---

## 👥 Créer d'Autres Admins

Pour créer un autre compte admin:

```sql
-- 1. Créer l'utilisateur normalement via l'interface de signup

-- 2. Le promouvoir admin
UPDATE public.profiles 
SET is_admin = true 
WHERE email = 'nouvel.admin@example.com';
```

---

## 🧹 Supprimer le Compte Admin

Si vous voulez supprimer le compte admin par défaut:

```sql
-- Attention: cela supprimera TOUTES les données associées
DELETE FROM auth.users WHERE email = 'sadek@admin.cupped';
```

---

## ✅ Checklist de Configuration

- [ ] Script SQL exécuté dans Supabase
- [ ] Compte admin créé avec succès
- [ ] Connexion testée avec les identifiants par défaut
- [ ] Compte MT5 admin ajouté
- [ ] Service de copy trading démarré
- [ ] **Mot de passe changé pour la production**
- [ ] Email réel configuré (production)

---

## 🆘 Troubleshooting

### Erreur: "Email already exists"

Le compte existe déjà. Vous pouvez:
1. Utiliser le compte existant
2. Ou le supprimer et recréer:
```sql
DELETE FROM auth.users WHERE email = 'sadek@admin.cupped';
-- Puis réexécuter le script
```

### Erreur: "Invalid login credentials"

Vérifiez:
1. Email correctement tapé: `sadek@admin.cupped`
2. Mot de passe correct: `Qwerty123.123`
3. Que le script SQL a bien été exécuté

### Le compte n'est pas admin

```sql
-- Vérifier le statut
SELECT email, is_admin FROM profiles WHERE email = 'sadek@admin.cupped';

-- Promouvoir en admin si nécessaire
UPDATE profiles SET is_admin = true WHERE email = 'sadek@admin.cupped';
```

---

## 📚 Pages Admin Disponibles

Une fois connecté comme admin, vous avez accès à:

- `/admin/dashboard` - Vue d'ensemble
- `/admin/mt5-accounts` - Gestion des comptes MT5 admin
- `/admin/copy-trading` - Contrôle du service de copy trading
- `/admin/users` - Gestion des utilisateurs
- `/admin/trades` - Monitoring des trades

---

Bon trading! 💰

