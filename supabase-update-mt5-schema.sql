-- Migration pour passer aux brokers/serveurs dynamiques depuis MetaApi
-- Exécuter ce script dans Supabase SQL Editor

-- 1. Ajouter les nouvelles colonnes
ALTER TABLE mt5_accounts 
ADD COLUMN IF NOT EXISTS broker_name TEXT,
ADD COLUMN IF NOT EXISTS server_name TEXT;

-- 2. Migrer les données existantes (si tu as déjà des comptes)
UPDATE mt5_accounts 
SET broker_name = brokers.name,
    server_name = brokers.server_address
FROM brokers
WHERE mt5_accounts.broker_id = brokers.id
AND mt5_accounts.broker_name IS NULL;

-- 3. Rendre les nouvelles colonnes obligatoires pour les nouveaux comptes
-- (ne pas faire NOT NULL car ça casserait les anciens comptes)

-- 4. On garde broker_id pour compatibilité mais il devient optionnel
ALTER TABLE mt5_accounts 
ALTER COLUMN broker_id DROP NOT NULL;

-- 5. La table brokers peut maintenant être supprimée ou gardée comme référence
-- Pour l'instant on la garde pour éviter de casser l'existant

-- 6. Créer un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_mt5_accounts_broker_name ON mt5_accounts(broker_name);
CREATE INDEX IF NOT EXISTS idx_mt5_accounts_server_name ON mt5_accounts(server_name);

-- Note: Cette migration est safe et ne casse rien!
-- Les anciens comptes continuent de fonctionner
-- Les nouveaux comptes utilisent broker_name/server_name directement

