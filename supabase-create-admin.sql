-- Script pour créer le compte admin par défaut
-- Email: sadek@admin.cupped
-- Password: Qwerty123.123

-- IMPORTANT: Ce script doit être exécuté dans l'éditeur SQL de Supabase
-- Il créera un utilisateur admin avec accès complet au système

DO $$
DECLARE
  v_user_id UUID;
  v_user_exists BOOLEAN;
BEGIN
  -- Vérifier si l'utilisateur existe déjà
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'sadek@admin.cupped'
  ) INTO v_user_exists;

  IF v_user_exists THEN
    RAISE NOTICE 'User already exists, updating to admin...';
    
    -- Récupérer l'ID existant
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'sadek@admin.cupped';
    
  ELSE
    RAISE NOTICE 'Creating new admin user...';
    
    -- Créer le nouvel utilisateur
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
    ) VALUES (
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
    )
    RETURNING id INTO v_user_id;
  END IF;

  -- Créer ou mettre à jour le profil avec is_admin = true
  INSERT INTO public.profiles (id, email, full_name, is_admin, created_at, updated_at)
  VALUES (v_user_id, 'sadek@admin.cupped', 'Sadek Admin', true, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE 
  SET is_admin = true, 
      full_name = 'Sadek Admin',
      email = 'sadek@admin.cupped';

  -- Créer ou mettre à jour l'abonnement actif
  INSERT INTO public.subscriptions (user_id, status, current_period_start, current_period_end, created_at, updated_at)
  VALUES (v_user_id, 'active', NOW(), NOW() + INTERVAL '1 year', NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE 
  SET status = 'active',
      current_period_start = NOW(),
      current_period_end = NOW() + INTERVAL '1 year';

  RAISE NOTICE '✅ Admin user created/updated successfully!';
  RAISE NOTICE 'User ID: %', v_user_id;
  RAISE NOTICE 'Email: sadek@admin.cupped';
  RAISE NOTICE 'Password: Qwerty123.123';
END $$;

-- Vérifier que tout est bien créé
SELECT 
  u.id,
  u.email,
  u.email_confirmed_at,
  p.full_name,
  p.is_admin,
  s.status as subscription_status,
  s.current_period_end
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
JOIN public.subscriptions s ON s.user_id = u.id
WHERE u.email = 'sadek@admin.cupped';
