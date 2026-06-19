#!/usr/bin/env bash
# Ferme toutes les positions ouvertes sur un compte MetaAPI (macOS bash 3.2 OK).
#
# Usage:
#   export METAAPI_TOKEN=eyJ...
#   bash scripts/close-positions-curl.sh vantage

set -eo pipefail

TOKEN="${METAAPI_TOKEN:-}"
TARGET="${1:-vantage}"

if [[ -z "$TOKEN" ]]; then
  echo "❌ METAAPI_TOKEN manquant"
  echo "   export METAAPI_TOKEN=eyJ..."
  echo "   bash scripts/close-positions-curl.sh vantage"
  exit 1
fi

resolve_account() {
  local key
  key=$(echo "$1" | tr '[:upper:]' '[:lower:]')
  case "$key" in
    vantage) echo "b48f5708-8c82-406e-8264-c41deb761872" ;;
    vt|vtmarkets|"vt markets") echo "a7d26e9a-dc9c-418d-9cc1-bb3350aa435e" ;;
    fxcess) echo "b2f7ffb6-1f64-47c0-b428-5a5c9ab3d954" ;;
    *)
      if echo "$1" | grep -qE '^[0-9a-f-]{36}$'; then
        echo "$1"
      else
        echo ""
      fi
      ;;
  esac
}

account_id=$(resolve_account "$TARGET")
if [[ -z "$account_id" ]]; then
  echo "❌ Compte inconnu: $TARGET (vantage | vt | fxcess | UUID)"
  exit 1
fi

APIS=(
  "https://mt-client-api-v1.london.agiliumtrade.ai"
  "https://mt-client-api-v1.new-york.agiliumtrade.ai"
)

echo "🔍 Positions ouvertes — $TARGET ($account_id)"

positions_json="[]"
used_api=""

for api in "${APIS[@]}"; do
  tmp=$(curl -sS --max-time 30 \
    -H "auth-token: $TOKEN" \
    "$api/users/current/accounts/$account_id/positions" 2>/dev/null || echo "")
  if echo "$tmp" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if isinstance(d,list) else 1)" 2>/dev/null; then
    positions_json="$tmp"
    used_api="$api"
    break
  fi
done

if [[ -z "$used_api" ]]; then
  echo "❌ Impossible de lire les positions (compte déconnecté?)"
  exit 1
fi

echo "   API: $used_api"

count=$(echo "$positions_json" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
if [[ "$count" == "0" ]]; then
  echo "✅ Aucune position ouverte"
  exit 0
fi

echo "📊 $count position(s) à fermer"
closed=0

echo "$positions_json" | python3 -c "
import sys, json
for p in json.load(sys.stdin):
    pid = p.get('id') or p.get('positionId') or p.get('ticket')
    sym = p.get('symbol', '?')
    vol = p.get('volume', '?')
    side = p.get('type') or p.get('side') or '?'
    if pid is not None:
        print(f'{pid}\t{sym}\t{vol}\t{side}')
" | while IFS=$'\t' read -r pid sym vol side; do
  [[ -z "$pid" ]] && continue
  echo "  🔴 Close $pid $sym $side vol=$vol"
  ok=0
  for api in "${APIS[@]}"; do
    res=$(curl -sS --max-time 45 -X POST \
      -H "auth-token: $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"actionType\":\"POSITION_CLOSE_ID\",\"positionId\":\"$pid\"}" \
      "$api/users/current/accounts/$account_id/trade" 2>/dev/null || echo "")
    if echo "$res" | grep -qiE 'ERR_NO_ERROR|TRADE_RETCODE_DONE|10009|10008|10010|"numericCode":0'; then
      echo "     ✅ OK ($api)"
      ok=1
      break
    fi
    res2=$(curl -sS --max-time 45 -X POST \
      -H "auth-token: $TOKEN" \
      "$api/users/current/accounts/$account_id/positions/$pid/close" 2>/dev/null || echo "")
    if echo "$res2" | grep -qiE 'ERR_NO_ERROR|TRADE_RETCODE_DONE|10009|10008|10010|"numericCode":0'; then
      echo "     ✅ OK close URL ($api)"
      ok=1
      break
    fi
  done
  if [[ "$ok" == "0" ]]; then
    echo "     ❌ Échec — $res"
  else
    closed=$((closed + 1))
  fi
done

echo ""
echo "✅ Terminé"
