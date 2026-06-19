export function isTlsCertificateError(error?: string | null): boolean {
  if (!error) return false;
  const e = error.toLowerCase();
  return (
    e.includes("certificate has expired") ||
    e.includes("self-signed certificate") ||
    e.includes("unable to verify the first certificate") ||
    e.includes("certificate verify failed")
  );
}

/** Erreurs réseau MetaAPI — ne pas marquer failed, laisser pending pour retry worker. */
export function isTransientMetaApiError(error?: string | null): boolean {
  if (!error) return false;
  const e = error.toLowerCase();
  return (
    e.includes("fetch failed") ||
    e.includes("aborterror") ||
    e.includes("timeout") ||
    e.includes("econnreset") ||
    e.includes("enotfound") ||
    e.includes("etimedout") ||
    e.includes("socket hang up") ||
    e.includes("network") ||
    isTlsCertificateError(e)
  );
}

export function formatFetchError(e: unknown): string {
  if (!(e instanceof Error)) return String(e ?? "fetch failed");
  const parts = [e.message];
  const cause = (e as Error & { cause?: unknown }).cause;
  if (cause instanceof Error) parts.push(cause.message);
  else if (cause != null) parts.push(String(cause));
  return parts.filter(Boolean).join(" — ");
}
