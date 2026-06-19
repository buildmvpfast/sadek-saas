#!/usr/bin/env bash
# Annule tous les ordres pending (buy/sell limit/stop) sur les 3 comptes.
# Token : https://app.metaapi.cloud → API → copy token
#
# Usage:
#   METAAPI_TOKEN=eyJ... bash scripts/cancel-pending-curl.sh
#   bash scripts/cancel-pending-curl.sh eyJ...

set -euo pipefail

TOKEN="${METAAPI_TOKEN:-${1:-}}"
if [[ -z "$TOKEN" ]]; then
  echo "❌ METAAPI_TOKEN manquant"
  echo "   METAAPI_TOKEN=xxx bash scripts/cancel-pending-curl.sh"
  echo "   Token : https://app.metaapi.cloud (section API)"
  exit 1
fi

API="https://mt-client-api-v1.london.agiliumtrade.ai"
ACCOUNTS=(
  "a7d26e9a-dc9c-418d-9cc1-bb3350aa435e|VT Markets"
  "b48f5708-8c82-406e-8264-c41deb761872|Vantage"
  "b2f7ffb6-1f64-47c0-b428-5a5c9ab3d954|FXcess"
)

cancelled=0

for entry in "${ACCOUNTS[@]}"; do
  account_id="${entry%%|*}"
  broker="${entry##*|}"
  echo ""
  echo "🔍 $broker ($account_id)"

  orders_json=$(curl -sS --max-time 30 \
    -H "auth-token: $TOKEN" \
    "$API/users/current/accounts/$account_id/orders" || echo "[]")

  if ! echo "$orders_json" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
    echo "  ⚠️ Impossible de lire les ordres (compte déconnecté ou mauvaise région?)"
    continue
  fi

  count=$(echo "$orders_json" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
  if [[ "$count" == "0" ]]; then
    echo "  ✅ Aucun ordre pending"
    continue
  fi

  echo "$orders_json" | python3 -c "
import sys, json
for o in json.load(sys.stdin):
    oid = o.get('id') or o.get('orderId') or o.get('ticket')
    sym = o.get('symbol', '?')
    typ = o.get('type') or o.get('orderType') or 'pending'
    if oid is not None:
        print(f'{oid}\t{sym}\t{typ}')
" | while IFS=$'\t' read -r oid sym typ; do
    echo "  🗑️ Cancel $oid $sym ($typ)"
    res=$(curl -sS --max-time 30 -X POST \
      -H "auth-token: $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"actionType\":\"ORDER_CANCEL\",\"orderId\":\"$oid\"}" \
      "$API/users/current/accounts/$account_id/trade")
    if echo "$res" | grep -qiE 'ERR_NO_ERROR|TRADE_RETCODE_DONE|10009|10008|"numericCode":0'; then
      echo "     ✅ OK"
      cancelled=$((cancelled + 1))
    else
      echo "     ⚠️ $res"
    fi
  done
done

echo ""
echo "✅ Terminé ($cancelled annulation(s))"
echo ""
echo "📋 Nettoie aussi Supabase (SQL Editor) :"
cat <<'SQL'
UPDATE telegram_trades
SET status = 'cancelled', error_message = 'cleanup', executed_at = NULL
WHERE status IN ('pending', 'executing', 'failed');
SQL
