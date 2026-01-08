# Configuration du Mapping des Symboles

## 📋 Brokers Supportés

Seulement ces 5 brokers sont supportés pour le mapping automatique des symboles:

- **VT Markets**
- **Raise FX**
- **Raise Globale**
- **FXcess**
- **Axi**

## 🔧 Configuration dans Supabase

### Étape 1: Exécuter le Script SQL

Exécuter le script `supabase-symbol-mappings-actual-brokers.sql` dans Supabase SQL Editor:

```sql
-- Ce script crée les mappings pour GOLD, SOL30, BTC
-- Pour les 4 brokers supportés uniquement
```

### Étape 2: Vérifier les Mappings

```sql
SELECT broker_name, standard_symbol, broker_symbol 
FROM symbol_mappings 
WHERE broker_name IN ('VT Markets', 'Raise FX', 'Raise Globale', 'FXcess', 'Axi')
ORDER BY broker_name, standard_symbol;
```

Tu devrais voir:
```
broker_name   | standard_symbol | broker_symbol
--------------|-----------------|---------------
Axi           | BTC             | BTCUSD
Axi           | GOLD            | XAUUSD
Axi           | SOL30           | SOL30
FXcess        | BTC             | BTCUSD
FXcess        | GOLD            | XAUUSD
FXcess        | SOL30           | SOL30
Raise FX      | BTC             | BTCUSD
Raise FX      | GOLD            | XAUUSD
Raise FX      | SOL30           | SOL30
Raise Globale | BTC             | BTCUSD
Raise Globale | GOLD            | XAUUSD
Raise Globale | SOL30           | SOL30
VT Markets      | BTC             | BTCUSD
VT Markets      | GOLD            | XAUUSD
VT Markets      | SOL30           | SOL30
```

## ⚠️ Important: Nom du Broker

Le `broker_name` dans la table `mt5_accounts` doit correspondre **exactement** à un de ces noms:

- `VT Markets` (pas "VT Markets-Live" ou autre)
- `Raise FX` (avec l'espace et la majuscule)
- `Raise Globale` (avec l'espace et la majuscule)
- `FXcess` (exactement comme ça)
- `Axi` (pas "AxiTrader")

### Vérifier les Noms dans la Base

```sql
SELECT DISTINCT broker_name 
FROM mt5_accounts 
WHERE broker_name IS NOT NULL;
```

Si les noms ne correspondent pas, il faut les corriger:

```sql
-- Exemple: si tu as "IC Markets" au lieu de "VT Markets"
UPDATE mt5_accounts 
SET broker_name = 'VT Markets' 
WHERE broker_name = 'IC Markets';
```

## 🔄 Comment ça Fonctionne

1. **Signal Telegram reçu:** `BUY XAUUSD @ 2650.50`
2. **Normalisation:** `XAUUSD` → `GOLD`
3. **Pour chaque utilisateur:**
   - Récupère son `broker_name` depuis `mt5_accounts`
   - Vérifie si le broker est dans la liste supportée
   - Si oui, cherche le mapping: `GOLD` → `XAUUSD` (pour VT Markets)
   - Si non, utilise le symbole original du signal
4. **Trade créé** avec le symbole du broker

## 🐛 Dépannage

### Problème: "Broker non supporté"

**Solution:**
- Vérifier que le `broker_name` dans `mt5_accounts` correspond exactement à un des 4 brokers
- Vérifier la casse et les espaces (ex: "Raise FX" avec l'espace)

### Problème: "Pas de mapping trouvé"

**Solution:**
- Vérifier que le script SQL a été exécuté
- Vérifier que le mapping existe dans `symbol_mappings`
- Vérifier que le `standard_symbol` correspond (GOLD, SOL30, BTC)

### Problème: Symbole incorrect sur le broker

**Solution:**
- Vérifier le symbole réel utilisé par le broker
- Mettre à jour le mapping dans `symbol_mappings`:

```sql
UPDATE symbol_mappings 
SET broker_symbol = 'NOUVEAU_SYMBOLE' 
WHERE broker_name = 'VT Markets' 
AND standard_symbol = 'GOLD';
```

## 📝 Ajouter un Nouveau Broker

Si tu veux ajouter un nouveau broker:

1. **Ajouter dans le code** (`app/api/telegram/parse-signal/route.ts`):
```typescript
const supportedBrokers = ['VT Markets', 'Raise FX', 'Raise Globale', 'FXcess', 'Axi', 'NOUVEAU_BROKER']
```

2. **Ajouter les mappings dans Supabase:**
```sql
INSERT INTO symbol_mappings (broker_name, standard_symbol, broker_symbol) VALUES
  ('NOUVEAU_BROKER', 'GOLD', 'XAUUSD'),
  ('NOUVEAU_BROKER', 'SOL30', 'SOL30'),
  ('NOUVEAU_BROKER', 'BTC', 'BTCUSD')
ON CONFLICT (broker_name, standard_symbol) DO UPDATE 
SET broker_symbol = EXCLUDED.broker_symbol;
```

3. **Vérifier que les comptes MT5 ont le bon `broker_name`**

