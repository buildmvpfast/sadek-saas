/**
 * Audit symboles live MetaAPI par compte → SQL symbol_mappings + rapport.
 *
 * METAAPI_TOKEN=... NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/audit-broker-symbols.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { fetchMetaApiSymbolNames } from "../lib/metaapi-trade-client";
import { resolveBrokerSymbol, invalidateSymbolCache } from "../lib/broker-symbol-resolver";

dotenv.config({ path: ".env.local" });

const STANDARDS = [
  "GOLD",
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "BTC",
  "US30",
  "NAS100",
  "GER40",
] as const;

function goldCandidates(symbols: Set<string>): string[] {
  return Array.from(symbols).filter(
    (s) =>
      /XAU|GOLD/i.test(s) &&
      !/BTC|ETH/i.test(s.replace(/[^A-Z0-9]/gi, "")),
  );
}

function forexCandidates(symbols: Set<string>, pair: string): string[] {
  const compact = pair.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return Array.from(symbols).filter((s) => {
    const c = s.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    return c === compact || c.startsWith(compact);
  });
}

async function main() {
  const token = process.env.METAAPI_TOKEN;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!token) {
    console.error("❌ METAAPI_TOKEN requis");
    process.exit(1);
  }

  type Row = {
    id: string;
    metaapi_account_id: string;
    broker_name: string;
    login: string | number;
    server_name?: string | null;
    symbol_profile?: string | null;
  };

  let accounts: Row[] = [];

  if (url && key) {
    const supabase = createClient(url, key);
    const { data } = await supabase
      .from("mt5_accounts")
      .select(
        "id, metaapi_account_id, broker_name, login, server_name, symbol_profile",
      )
      .not("metaapi_account_id", "is", null)
      .eq("is_active", true);
    accounts = (data ?? []) as Row[];
  }

  if (!accounts.length) {
    console.log("⚠️ Pas de Supabase — comptes hardcodés session");
    accounts = [
      {
        id: "vt",
        metaapi_account_id: "a7d26e9a-dc9c-418d-9cc1-bb3350aa435e",
        broker_name: "VT Markets",
        login: "?",
      },
      {
        id: "vantage",
        metaapi_account_id: "b48f5708-8c82-406e-8264-c41deb761872",
        broker_name: "Vantage",
        login: "?",
      },
      {
        id: "fxcess",
        metaapi_account_id: "b2f7ffb6-1f64-47c0-b428-5a5c9ab3d954",
        broker_name: "FXcess",
        login: "?",
      },
    ];
  }

  const supabase = url && key ? createClient(url, key) : null;
  const upserts: string[] = [];

  console.log(`\n🔍 Audit ${accounts.length} compte(s)\n`);

  for (const acc of accounts) {
    const aid = acc.metaapi_account_id;
    invalidateSymbolCache(aid);
    const live = await fetchMetaApiSymbolNames(aid, token);

    console.log("═".repeat(60));
    console.log(
      `${acc.broker_name} | login ${acc.login} | ${acc.server_name ?? "?"} | ${aid}`,
    );

    if (!live.ok) {
      console.log(`  ❌ symbols: ${live.error}\n`);
      continue;
    }

    console.log(`  ✅ ${live.symbols.size} symboles live`);
    const gold = goldCandidates(live.symbols);
    console.log(`  GOLD/XAU: ${gold.slice(0, 12).join(", ") || "(aucun)"}`);

    for (const std of STANDARDS) {
      let resolved = std;
      if (supabase) {
        resolved = await resolveBrokerSymbol(std, acc.broker_name, supabase, {
          metaApiAccountId: aid,
          metaApiToken: token,
          symbolProfile: (acc.symbol_profile as "auto" | "ecn" | "stp") ?? "auto",
          refreshSymbols: true,
        });
      } else {
        const list =
          std === "GOLD"
            ? gold
            : forexCandidates(live.symbols, std);
        resolved = list[0] ?? std;
      }

      const ok = live.symbols.has(resolved) ||
        Array.from(live.symbols).some(
          (s) => s.toLowerCase() === resolved.toLowerCase(),
        );
      const mark = ok ? "✅" : "❌";
      console.log(`  ${mark} ${std} → ${resolved}`);
      if (ok && supabase) {
        upserts.push(
          `  ('${acc.broker_name.replace(/'/g, "''")}', '${std}', '${resolved.replace(/'/g, "''")}'),`,
        );
      }
    }
    console.log("");
  }

  if (upserts.length) {
    const unique = Array.from(new Set(upserts));
    console.log("\n-- Coller dans Supabase SQL Editor:\n");
    console.log(`INSERT INTO symbol_mappings (broker_name, standard_symbol, broker_symbol) VALUES`);
    console.log(unique.join("\n"));
    console.log(
      `ON CONFLICT (broker_name, standard_symbol) DO UPDATE SET broker_symbol = EXCLUDED.broker_symbol;`,
    );
  }
}

main().catch(console.error);
