-- Migration pour corriger le typo "VTmarker" en "VT Markets"

-- 1. Mettre à jour symbol_mappings
UPDATE symbol_mappings 
SET broker_name = 'VT Markets' 
WHERE broker_name = 'VTmarker';

-- 2. Mettre à jour la table brokers si elle existe
UPDATE brokers 
SET name = 'VT Markets' 
WHERE name = 'VTmarker';

-- 3. S'assurer que VT Markets existe dans la table brokers avec un serveur par défaut
INSERT INTO brokers (name, server_address)
VALUES ('VT Markets', 'VTMarkets-Live')
ON CONFLICT (name) DO NOTHING;

-- 4. Ajouter des serveurs communs pour VT Markets si besoin dans la table brokers (si format permet)
-- Pour l'instant on garde le serveur principal
