/**
 * Liste symboles XAU/EURUSD live pour un compte MetaAPI.
 * METAAPI_TOKEN=... npx tsx scripts/debug-symbols.ts --account UUID
 */
import * as dotenv from "dotenv";
import { fetchMetaApiSymbolNames } from "../lib/metaapi-trade-client";

dotenv.config({ path: ".env.local" });

const accountId =
  process.argv.find((a, i) => process.argv[i - 1] === "--account") ??
  "a7d26e9a-dc9c-418d-9cc1-bb3350aa435e";

async function main() {
  const token = process.env.METAAPI_TOKEN;
  if (!token) {
    console.error("❌ METAAPI_TOKEN requis");
    process.exit(1);
  }
  const live = await fetchMetaApiSymbolNames(accountId, token);
  if (!live.ok) {
    console.error("❌", live.error);
    process.exit(1);
  }
  const arr = Array.from(live.symbols);
  console.log(`✅ ${arr.length} symboles`);
  console.log("GOLD/XAU:", arr.filter((s) => /XAU|GOLD/i.test(s)).join(", "));
  console.log("EURUSD:", arr.filter((s) => /EURUSD/i.test(s)).join(", "));
}

main();
