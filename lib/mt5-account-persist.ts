/**
 * Lie un compte MetaAPI CONNECTED à Supabase quand la création cloud a réussi
 * mais l’insert client a échoué (timeout 504, onglet fermé, etc.).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalConnectServer, isFxcessConnectContext } from "@/lib/broker-connect-config";
import {
  listProvisioningAccounts,
  fetchProvisioningAccount,
} from "@/lib/metaapi-provisioning";

function normalizeLogin(login: string | number | undefined): string {
  const s = String(login ?? "").trim().replace(/\s/g, "");
  if (/^\d+\.0+$/.test(s)) return s.replace(/\.\d+$/, "");
  return s;
}

function inferBrokerName(
  server: string,
  accountName: string,
  platform?: string,
): string {
  const blob = `${server} ${accountName}`.toLowerCase();
  if (isFxcessConnectContext(null, server) || /fxcess|fxness/i.test(blob)) {
    return "FXcess";
  }
  if (/vantage/i.test(blob)) return "Vantage";
  if (/vtmarket/i.test(blob)) return "VT Markets";
  if (/raise/i.test(blob)) return "Raise FX";
  if (/^axi/i.test(blob)) return "Axi";
  if (platform === "mt4") return "FXcess";
  return "Unknown";
}

/** Nom MetaAPI : User:<supabaseUserId>:<broker>:<login> */
export function buildMetaApiAccountLabel(
  userId: string,
  brokerName: string,
  login: string,
): string {
  return `User:${userId}:${brokerName.trim() || "broker"}:${normalizeLogin(login)}`;
}

/** Parse le label User:uuid:broker:login (ou legacy User - broker - login). */
function parseAccountLabel(name: string): {
  userId?: string;
  broker?: string;
  login?: string;
} {
  const modern = /^User:([^:]+):([^:]+):(\d+)$/i.exec(name.trim());
  if (modern) {
    return { userId: modern[1], broker: modern[2], login: modern[3] };
  }
  const legacy = /^User\s*-\s*(.+?)\s*-\s*(\d+)$/i.exec(name.trim());
  if (legacy) {
    return { broker: legacy[1].trim(), login: legacy[2] };
  }
  return {};
}

export type PersistMt5AccountInput = {
  userId: string;
  metaApiAccountId: string;
  brokerName: string;
  serverName: string;
  login: string | number;
  symbolProfile?: "auto" | "ecn" | "stp";
  isAdminAccount?: boolean;
};

export async function persistMt5AccountRow(
  supabase: SupabaseClient,
  input: PersistMt5AccountInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const login = normalizeLogin(input.login);
  const accountNumber = parseInt(login, 10);
  if (!Number.isFinite(accountNumber)) {
    return { ok: false, error: "Numéro de compte invalide" };
  }

  const { data: byMetaId } = await supabase
    .from("mt5_accounts")
    .select("id, user_id")
    .eq("metaapi_account_id", input.metaApiAccountId)
    .maybeSingle();

  if (byMetaId) {
    if (byMetaId.user_id === input.userId) {
      return { ok: true, id: byMetaId.id };
    }
    return { ok: false, error: "Ce compte MetaAPI est déjà lié à un autre utilisateur" };
  }

  const { count } = await supabase
    .from("mt5_accounts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId);

  if ((count ?? 0) > 0 && !input.isAdminAccount) {
    return {
      ok: false,
      error: "Un compte MT5 est déjà enregistré pour cet utilisateur",
    };
  }

  const { data: inserted, error } = await supabase
    .from("mt5_accounts")
    .insert({
      user_id: input.userId,
      broker_name: input.brokerName.trim(),
      server_name: input.serverName.trim(),
      account_number: accountNumber,
      password_encrypted: "STORED_BY_METAAPI",
      is_investor: false,
      is_admin_account: input.isAdminAccount ?? false,
      metaapi_account_id: input.metaApiAccountId,
      is_active: true,
      symbol_profile: input.symbolProfile ?? "auto",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: inserted.id };
}

function serversMatch(a: string, b: string): boolean {
  return (
    a.trim().toLowerCase().replace(/\s+/g, "") ===
    b.trim().toLowerCase().replace(/\s+/g, "")
  );
}

function isConnectedProvisioningAccount(acc: Record<string, unknown>): boolean {
  return (
    String(acc.state ?? "") === "DEPLOYED" &&
    String(acc.connectionStatus ?? "") === "CONNECTED"
  );
}

/** FXcess MT4 : peut être lié à Supabase dès DEPLOYED (connexion broker en cours). */
export function isMetaApiAccountLinkable(
  acc: Record<string, unknown>,
  brokerName?: string | null,
): boolean {
  if (String(acc.state ?? "") !== "DEPLOYED") return false;
  if (isConnectedProvisioningAccount(acc)) return true;
  const server = String(acc.server ?? "");
  const platform = String(acc.platform ?? "").toLowerCase();
  return (
    isFxcessConnectContext(brokerName, server) ||
    (platform === "mt4" && isFxcessConnectContext(null, server))
  );
}

export type SyncOrphanOptions = {
  login?: string;
  server?: string;
  brokerName?: string;
};

export async function listUnlinkedMetaApiAccounts(
  supabase: SupabaseClient,
  token: string,
): Promise<Record<string, unknown>[]> {
  const { data: allLinked } = await supabase
    .from("mt5_accounts")
    .select("metaapi_account_id")
    .not("metaapi_account_id", "is", null);

  const globallyLinked = new Set(
    (allLinked ?? [])
      .map((r) => r.metaapi_account_id)
      .filter((id): id is string => typeof id === "string"),
  );

  const accounts = await listProvisioningAccounts(token);
  return accounts.filter((acc) => {
    const id = acc.id;
    return (
      typeof id === "string" &&
      id.length > 0 &&
      !globallyLinked.has(id) &&
      isMetaApiAccountLinkable(acc)
    );
  });
}

export async function syncOrphanMetaApiAccount(
  supabase: SupabaseClient,
  userId: string,
  token: string,
  options?: SyncOrphanOptions,
): Promise<{ synced: boolean; accountId?: string; error?: string }> {
  const { data: existingRows } = await supabase
    .from("mt5_accounts")
    .select("metaapi_account_id")
    .eq("user_id", userId);

  const ownIds = new Set(
    (existingRows ?? [])
      .map((r) => r.metaapi_account_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  );

  if (ownIds.size > 0) {
    return { synced: false, error: "Compte déjà enregistré" };
  }

  const { data: allLinked } = await supabase
    .from("mt5_accounts")
    .select("metaapi_account_id")
    .not("metaapi_account_id", "is", null);

  const globallyLinked = new Set(
    (allLinked ?? [])
      .map((r) => r.metaapi_account_id)
      .filter((id): id is string => typeof id === "string"),
  );

  const targetLogin = options?.login
    ? normalizeLogin(options.login)
    : undefined;
  const targetServer = options?.server
    ? canonicalConnectServer(options.server, options.brokerName)
    : undefined;

  const accounts = await listProvisioningAccounts(token);
  const candidates = accounts.filter((acc) => {
    const id = acc.id;
    if (typeof id !== "string" || !id || globallyLinked.has(id)) return false;
    if (!isMetaApiAccountLinkable(acc, options?.brokerName)) return false;

    const accLogin = normalizeLogin(acc.login as string | number | undefined);
    const accServer = canonicalConnectServer(
      String(acc.server ?? ""),
      options?.brokerName,
    );
    const label = parseAccountLabel(String(acc.name ?? ""));

    if (label.userId && label.userId !== userId) return false;

    if (targetLogin && accLogin !== targetLogin) return false;
    if (targetServer && !serversMatch(accServer, targetServer)) return false;

    if (!targetLogin && !targetServer) {
      if (label.userId === userId) return true;
      if (label.userId) return false;
      // Legacy : nom User - FXcess - login sans user id → ignorer si ambigu
      if (!label.login) return false;
    }

    return true;
  });

  if (candidates.length === 0) {
    let legacyFxcess = accounts.filter((acc) => {
      const id = acc.id;
      if (typeof id !== "string" || !id || globallyLinked.has(id)) return false;
      if (!isMetaApiAccountLinkable(acc, options?.brokerName ?? "FXcess")) {
        return false;
      }
      const label = parseAccountLabel(String(acc.name ?? ""));
      if (label.userId) return false;
      const accLogin = normalizeLogin(acc.login as string | number | undefined);
      if (targetLogin && accLogin !== targetLogin) return false;
      if (targetServer) {
        const accServer = canonicalConnectServer(
          String(acc.server ?? ""),
          options?.brokerName,
        );
        if (!serversMatch(accServer, targetServer)) return false;
      }
      return (
        isFxcessConnectContext(null, String(acc.server ?? "")) ||
        String(acc.platform ?? "").toLowerCase() === "mt4"
      );
    });

    if (targetLogin && legacyFxcess.length > 1) {
      legacyFxcess = legacyFxcess.filter(
        (acc) =>
          normalizeLogin(acc.login as string | number | undefined) ===
          targetLogin,
      );
    }

    if (legacyFxcess.length >= 1) {
      candidates.push(...legacyFxcess);
    } else {
      return { synced: false, error: "Aucun compte MetaAPI orphelin trouvé" };
    }
  }

  // Préférer le compte dont le label contient l’userId
  candidates.sort((a, b) => {
    const aUid = parseAccountLabel(String(a.name ?? "")).userId === userId ? 0 : 1;
    const bUid = parseAccountLabel(String(b.name ?? "")).userId === userId ? 0 : 1;
    return aUid - bUid;
  });

  const acc = candidates[0];
  const metaId = String(acc.id);
  const accLogin = normalizeLogin(acc.login as string | number | undefined);
  const accServer = canonicalConnectServer(String(acc.server ?? ""));
  const label = parseAccountLabel(String(acc.name ?? ""));
  const broker =
    options?.brokerName?.trim() ||
    label.broker ||
    inferBrokerName(accServer, String(acc.name ?? ""), String(acc.platform ?? ""));

  const saved = await persistMt5AccountRow(supabase, {
    userId,
    metaApiAccountId: metaId,
    brokerName: broker,
    serverName: accServer,
    login: accLogin,
  });

  if (!saved.ok) return { synced: false, error: saved.error };
  return { synced: true, accountId: metaId };
}

/** Vérifie un metaapi_account_id connu et le persiste si CONNECTED. */
export async function linkMetaApiAccountById(
  supabase: SupabaseClient,
  userId: string,
  token: string,
  metaApiAccountId: string,
  hints?: { brokerName?: string; server?: string; login?: string },
): Promise<{ ok: boolean; error?: string }> {
  const acc = await fetchProvisioningAccount(metaApiAccountId, token);
  if (!acc) return { ok: false, error: "Compte MetaAPI introuvable" };
  if (String(acc.state ?? "") !== "DEPLOYED") {
    return { ok: false, error: `Compte non déployé (${String(acc.state)})` };
  }

  const brokerName =
    hints?.brokerName?.trim() ||
    inferBrokerName(
      String(acc.server ?? ""),
      String(acc.name ?? ""),
      String(acc.platform ?? ""),
    );
  const fxcess = isFxcessConnectContext(brokerName, String(acc.server ?? ""));

  if (String(acc.connectionStatus ?? "") !== "CONNECTED" && !fxcess) {
    return {
      ok: false,
      error: `Compte pas encore connecté (${String(acc.connectionStatus)})`,
    };
  }

  const server = canonicalConnectServer(
    hints?.server || String(acc.server ?? ""),
    hints?.brokerName,
  );

  const saved = await persistMt5AccountRow(supabase, {
    userId,
    metaApiAccountId,
    brokerName,
    serverName: server,
    login: hints?.login ?? (acc.login as string | number),
  });

  if (!saved.ok) return { ok: false, error: saved.error };
  return { ok: true };
}
