/**
 * Hôtes MetaAPI vérifiés (certificats valides, Jun 2026).
 *
 * Ne pas utiliser *.agiliumtrade.agiliumtrade.ai pour le client REST trade :
 * certificats ingress Kubernetes expirés / auto-signés sur mt-client-api-v1.*.
 * Le provisioning API (mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai) reste OK.
 */
export const METAAPI_CLIENT_ROOTS = [
  "https://mt-client-api-v1.london.agiliumtrade.ai",
  "https://mt-client-api-v1.new-york.agiliumtrade.ai",
] as const;

export const METAAPI_PROVISIONING_ACCOUNTS_URL =
  "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts";

export const METAAPI_KNOWN_SERVERS_URL =
  "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/known-mt-servers";

export function metaApiClientAccountPath(
  accountId: string,
  suffix: string,
): string[] {
  const id = encodeURIComponent(accountId);
  const path = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return METAAPI_CLIENT_ROOTS.map(
    (root) => `${root}/users/current/accounts/${id}${path}`,
  );
}
