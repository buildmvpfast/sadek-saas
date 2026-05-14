export const METAAPI_PROVISIONING_ACCOUNTS_URL =
  "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts";

export async function deleteProvisioningAccount(
  accountId: string,
  token: string,
): Promise<void> {
  try {
    await fetch(`${METAAPI_PROVISIONING_ACCOUNTS_URL}/${accountId}`, {
      method: "DELETE",
      headers: { "auth-token": token },
    });
  } catch {
    // best-effort cleanup
  }
}

export async function fetchProvisioningAccount(
  accountId: string,
  token: string,
): Promise<Record<string, unknown> | null> {
  const r = await fetch(`${METAAPI_PROVISIONING_ACCOUNTS_URL}/${accountId}`, {
    headers: { "auth-token": token },
  });
  if (!r.ok) return null;
  return (await r.json()) as Record<string, unknown>;
}

export async function listProvisioningAccounts(
  token: string,
): Promise<Record<string, unknown>[]> {
  try {
    const r = await fetch(METAAPI_PROVISIONING_ACCOUNTS_URL, {
      headers: { "auth-token": token },
    });
    if (!r.ok) return [];
    const j = (await r.json()) as unknown;
    return Array.isArray(j) ? (j as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
}

function normalizeServerForMatch(server: string): string {
  return server.trim().replace(/\s+/g, " ");
}

function normalizeLoginForMatch(login: string | number): string {
  const s = String(login).trim().replace(/\s/g, "");
  if (/^\d+\.0+$/.test(s)) return s.replace(/\.\d+$/, "");
  return s;
}

/** Supprime les comptes MetaAPI déjà provisionnés pour le même login + serveur (évite doublons). */
export async function removeDuplicateProvisioningAccounts(
  token: string,
  login: string,
  server: string,
): Promise<void> {
  const ln = normalizeLoginForMatch(login);
  const sn = normalizeServerForMatch(server);
  const list = await listProvisioningAccounts(token);
  for (const acc of list) {
    const id = acc.id;
    if (typeof id !== "string" || !id) continue;
    const accLogin = normalizeLoginForMatch(
      (acc.login as string | number | undefined) ?? "",
    );
    const accServer = normalizeServerForMatch(String(acc.server ?? ""));
    if (accLogin === ln && accServer === sn) {
      await deleteProvisioningAccount(id, token);
    }
  }
}
