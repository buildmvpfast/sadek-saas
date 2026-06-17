/**
 * Lie un compte MetaAPI CONNECTED (orphelin) à un user Supabase.
 *
 * Usage:
 *   METAAPI_TOKEN=... NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/recover-orphan-mt5-account.ts --email user@example.com --login 7009357 --server FXcess-Demo --broker FXcess
 *
 *   # Lister les orphelins sans lier:
 *   npx tsx scripts/recover-orphan-mt5-account.ts --list
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import {
  listUnlinkedMetaApiAccounts,
  syncOrphanMetaApiAccount,
} from "../lib/mt5-account-persist";

dotenv.config({ path: ".env.local" });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || !process.argv[i + 1]) return undefined;
  return process.argv[i + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = process.env.METAAPI_TOKEN;

  if (!url || !key || !token) {
    console.error(
      "❌ Manque NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ou METAAPI_TOKEN",
    );
    process.exit(1);
  }

  const supabase = createClient(url, key);

  if (hasFlag("list")) {
    const orphans = await listUnlinkedMetaApiAccounts(supabase, token);
    console.log(`\n📋 ${orphans.length} compte(s) MetaAPI CONNECTED non liés:\n`);
    for (const acc of orphans) {
      console.log({
        id: acc.id,
        name: acc.name,
        login: acc.login,
        server: acc.server,
        platform: acc.platform,
        state: acc.state,
        connectionStatus: acc.connectionStatus,
      });
    }
    return;
  }

  const email = arg("email");
  const userId = arg("user-id");
  const login = arg("login");
  const server = arg("server");
  const broker = arg("broker") ?? "FXcess";

  if (!email && !userId) {
    console.error("❌ Fournir --email ou --user-id");
    process.exit(1);
  }

  let uid = userId;
  if (!uid && email) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (error) {
      console.error("❌ listUsers:", error.message);
      process.exit(1);
    }
    const user = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (!user) {
      console.error(`❌ User introuvable: ${email}`);
      process.exit(1);
    }
    uid = user.id;
  }

  if (!uid) {
    console.error("❌ user id introuvable");
    process.exit(1);
  }

  console.log(`\n🔗 Liaison pour user ${uid}...`);
  if (login) console.log(`   login=${login} server=${server ?? "?"} broker=${broker}`);

  const result = await syncOrphanMetaApiAccount(supabase, uid, token, {
    login,
    server,
    brokerName: broker,
  });

  if (!result.synced) {
    console.error("❌ Échec:", result.error);
    console.log("\n💡 Essayez: npx tsx scripts/recover-orphan-mt5-account.ts --list");
    process.exit(1);
  }

  console.log("✅ Compte lié — metaapi_account_id:", result.accountId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
