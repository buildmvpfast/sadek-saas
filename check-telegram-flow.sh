#!/bin/bash

# Script de vérification du flow Telegram
# Utilise l'API Supabase directement

echo "🔍 Vérification complète du flow Telegram..."
echo ""

# Vérifier les variables d'environnement
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Variables d'environnement manquantes"
  echo "   Charge .env.local d'abord: source .env.local"
  exit 1
fi

SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL"
SUPABASE_KEY="$SUPABASE_SERVICE_ROLE_KEY"

echo "1️⃣ Vérification du canal Telegram..."
curl -s -X GET \
  "$SUPABASE_URL/rest/v1/telegram_channels?select=id,name,username,is_active&is_active=eq.true" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" | jq '.'

echo ""
echo "2️⃣ Vérification des signaux reçus (10 derniers)..."
curl -s -X GET \
  "$SUPABASE_URL/rest/v1/telegram_signals?select=id,signal_type,symbol,parsed_at&order=parsed_at.desc&limit=10" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" | jq '.'

echo ""
echo "3️⃣ Vérification des trades créés (20 derniers)..."
curl -s -X GET \
  "$SUPABASE_URL/rest/v1/telegram_trades?select=id,symbol,signal_type,status,created_at&order=created_at.desc&limit=20" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" | jq '.'

echo ""
echo "4️⃣ Vérification des trades en attente..."
curl -s -X GET \
  "$SUPABASE_URL/rest/v1/telegram_trades?select=id,symbol,signal_type,status,created_at&status=eq.pending&order=created_at.desc" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" | jq '.'

echo ""
echo "✅ Vérification terminée!"

