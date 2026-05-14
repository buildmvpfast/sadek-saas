/**
 * Parse un nombre saisi avec virgule (FR) ou point (EN).
 */
export function parseLocaleNumber(
  input: string | number | null | undefined,
): number {
  if (input === null || input === undefined) return Number.NaN;
  if (typeof input === "number") {
    return Number.isFinite(input) ? input : Number.NaN;
  }
  const s = String(input).trim().replace(/\s/g, "");
  if (!s) return Number.NaN;
  const normalized = s.replace(",", ".");
  return Number.parseFloat(normalized);
}

export function parseLocaleNumberOr(
  input: string | number | null | undefined,
  fallback: number,
): number {
  const n = parseLocaleNumber(input);
  return Number.isFinite(n) ? n : fallback;
}
