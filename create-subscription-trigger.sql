-- Créer un trigger pour créer automatiquement un abonnement inactif
-- Exécute ce script dans Supabase SQL Editor

-- Fonction pour créer un abonnement inactif
CREATE OR REPLACE FUNCTION create_inactive_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Créer un abonnement inactif pour le nouvel utilisateur
  INSERT INTO public.subscriptions (
    user_id,
    status,
    current_period_start,
    current_period_end,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    'inactive',
    NOW(),
    NOW(),
    NOW(),
    NOW()
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- En cas d'erreur, on continue quand même
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supprimer le trigger existant s'il existe
DROP TRIGGER IF EXISTS create_subscription_trigger ON auth.users;

-- Créer le trigger
CREATE TRIGGER create_subscription_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_inactive_subscription();

-- Vérifier que le trigger est créé
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'create_subscription_trigger';
