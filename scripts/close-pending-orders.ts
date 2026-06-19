/**
 * Annule les ordres pending (buy/sell limit/stop) sur un compte MetaAPI.
 *
 * Usage:
 *   METAAPI_TOKEN=... NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/close-pending-orders.ts --all
 *
 *   npx tsx scripts/close-pending-orders.ts --account a7d26e9a-dc9c-418d-9cc1-bb3350aa435e
 *
 *   npx tsx scripts/close-pending-orders.ts --broker "VT Markets"
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import {
  cancelPendingOrdersForAccounts,
  loadMetaApiAccountsFromSupabase,
} from "../lib/cancel-pending-orders";

dotenv.config({ path: ".env.local" });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || !process.argv[i + 1]) return undefined;
  return process.argv[i + 1];
}

const KNOWN_ACCOUNTS = [
  { id: "a7d26e9a-dc9c-418d-9cc1-bb3350aa435e", brokerName: "VT Markets", login: null },
  { id: "b48f5708-8c82-406e-8264-c41deb761872", brokerName: "Vantage", login: null },
  { id: "b2f7ffb6-1f64-47c0-b428-5a5c9ab3d954", brokerName: "FXcess", login: null },
];

async function main() {
  const token = process.env.METAAPI_TOKEN;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const brokerFilter = arg("broker");
  const accountArg = arg("account");
  const symbolFilter = arg("symbol");
  const allAccounts = process.argv.includes("--all");

  if (!token) {
    console.error("❌ METAAPI_TOKEN manquant (.env.local ou export)");
    process.exit(1);
  }

  let accounts: Array<{ id: string; brokerName: string | null; login: string | null }> = [];

  const knownOnly = process.argv.includes("--known");

  if (accountArg) {
    accounts = [{ id: accountArg, brokerName: null, login: null }];
  } else if (knownOnly) {
    accounts = KNOWN_ACCOUNTS;
    console.log(`📋 ${accounts.length} compte(s) connus (sans Supabase)`);
  } else if ((allAccounts || brokerFilter) && supabaseUrl && serviceKey) {
    const supabase = createClient(supabaseUrl, serviceKey);
    accounts = await loadMetaApiAccountsFromSupabase(supabase, {
      broker: brokerFilter,
    });
    console.log(
      `📋 ${accounts.length} compte(s):`,
      accounts
        .map((a) => `${a.brokerName} ${a.login} (${a.id})`)
        .join("\n   "),
    );
  } else {
    console.error(
      "❌ --account UUID | --known | --broker \"VT Markets\" | --all",
    );
    process.exit(1);
  }

  if (!accounts.length) {
    console.error("❌ Aucun compte MetaAPI trouvé");
    process.exit(1);
  }

  const result = await cancelPendingOrdersForAccounts(
    accounts.map((a) => ({ id: a.id, brokerName: a.brokerName })),
    token,
    symbolFilter,
  );

  for (const d of result.details) {
    if (d.orderId === "-") {
      console.warn(`⚠️ ${d.accountId}: ${d.error}`);
      continue;
    }
    const mark = d.ok ? "✅" : "⚠️";
    console.log(
      `${mark} ${d.brokerName ?? d.accountId} cancel ${d.orderId} ${d.symbol} (${d.type})${d.error ? ` — ${d.error}` : ""}`,
    );
  }

  console.log(`\n✅ ${result.cancelled} ordre(s) pending annulé(s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
