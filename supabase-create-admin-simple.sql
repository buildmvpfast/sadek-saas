-- VERSION SIMPLE: Crée l'admin directement dans auth.users
-- Si ça ne marche pas, utilise la méthode signup + UPDATE à la place

-- 1. Insérer directement dans auth.users (fonctionne sur la plupart des projets Supabase)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
SELECT 
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'sadek@admin.cupped',
  crypt('Qwerty123.123', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Sadek Admin"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'sadek@admin.cupped'
);

-- 2. Créer le profil admin
INSERT INTO public.profiles (id, email, full_name, is_admin, created_at, updated_at)
SELECT 
  u.id,
  'sadek@admin.cupped',
  'Sadek Admin',
  true,
  NOW(),
  NOW()
FROM auth.users u
WHERE u.email = 'sadek@admin.cupped'
ON CONFLICT (id) DO UPDATE 
SET is_admin = true, full_name = 'Sadek Admin';

-- 3. Créer l'abonnement actif
INSERT INTO public.subscriptions (user_id, status, current_period_start, current_period_end, created_at, updated_at)
SELECT 
  u.id,
  'active',
  NOW(),
  NOW() + INTERVAL '1 year',
  NOW(),
  NOW()
FROM auth.users u
WHERE u.email = 'sadek@admin.cupped'
ON CONFLICT (user_id) DO UPDATE 
SET status = 'active',
    current_period_start = NOW(),
    current_period_end = NOW() + INTERVAL '1 year';

-- 4. Vérifier le résultat
SELECT 
  u.id,
  u.email,
  u.email_confirmed_at,
  p.full_name,
  p.is_admin,
  s.status as subscription_status
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
JOIN public.subscriptions s ON s.user_id = u.id
WHERE u.email = 'sadek@admin.cupped';

