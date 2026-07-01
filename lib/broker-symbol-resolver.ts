/**
 * Résolution symbole broker : static → ECN/STP → symboles réels MetaAPI du compte.
 */
import {
  brokerMappingKeys,
  staticBrokerSymbol,
  mandatoryBrokerGoldSymbol,
} from "@/lib/broker-symbol-fallback";
import { normalizeSymbol } from "@/lib/symbol-normalizer";
import { fetchMetaApiSymbolNames } from "@/lib/metaapi-trade-client";
import type { SymbolProfile } from "@/lib/trade-risk";

const SYMBOL_CACHE_MS = 5 * 60 * 1000;
const symbolCache = new Map<
  string,
  { at: number; symbols: Set<string> }
>();

export function invalidateSymbolCache(accountId?: string): void {
  if (accountId) symbolCache.delete(accountId);
  else symbolCache.clear();
}

async function getLiveSymbols(
  accountId: string,
  token: string,
  refresh = false,
): Promise<{ ok: true; symbols: Set<string> } | { ok: false; error: string }> {
  if (!refresh) {
    const hit = symbolCache.get(accountId);
    if (hit && Date.now() - hit.at < SYMBOL_CACHE_MS) {
      return { ok: true, symbols: hit.symbols };
    }
  }

  const live = await fetchMetaApiSymbolNames(accountId, token);
  if (live.ok) {
    symbolCache.set(accountId, { at: Date.now(), symbols: live.symbols });
  }
  return live;
}

function findInLiveSet(candidate: string, live: Set<string>): string | null {
  if (live.has(candidate)) return candidate;
  const lc = candidate.toLowerCase();
  for (const s of Array.from(live)) {
    if (s.toLowerCase() === lc) return s;
  }
  return null;
}

function isUsdGoldSymbol(sym: string): boolean {
  const c = sym.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return c === "GOLD" || c === "XAUUSD" || c.startsWith("XAUUSD");
}

function isCrossGoldSymbol(sym: string): boolean {
  const c = sym.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return /^XAU(?!USD)/i.test(c);
}

const CRYPTO_STANDARDS = new Set(["BTC", "ETH", "SOL30"]);

function isCryptoStandard(symbol: string): boolean {
  return CRYPTO_STANDARDS.has(symbol.toUpperCase());
}

function isUsdCryptoSymbol(sym: string, standard: string): boolean {
  const c = sym.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const s = standard.toUpperCase();
  if (s === "BTC") return c === "BTCUSD" || /^BTCUSD/i.test(sym);
  if (s === "ETH") return c === "ETHUSD" || /^ETHUSD/i.test(sym);
  if (s === "SOL30") return c === "SOL30" || c === "SOLUSD";
  return false;
}

function isCrossCryptoSymbol(sym: string, standard: string): boolean {
  if (!isCryptoStandard(standard)) return false;
  const c = sym.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return (
    c.startsWith(standard.toUpperCase()) && !isUsdCryptoSymbol(sym, standard)
  );
}

function scoreCryptoForBroker(
  sym: string,
  standard: string,
  _brokerName: string | null,
): number {
  const c = sym.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const s = standard.toUpperCase();
  if (s === "BTC") {
    if (c === "BTCUSD") return 0;
    return 50;
  }
  if (s === "ETH") {
    if (c === "ETHUSD") return 0;
    return 50;
  }
  if (s === "SOL30") {
    if (c === "SOL30") return 0;
    if (c === "SOLUSD") return 2;
    return 50;
  }
  return 10;
}

/** BTCUSD / ETHUSD uniquement — pas BTCBCH, BTCEUR, etc. */
export function listRankedLiveCryptoSymbols(
  live: Set<string>,
  standardSymbol: string,
  brokerName: string | null,
  exclude?: Set<string>,
): string[] {
  const std = standardSymbol.toUpperCase();
  if (!isCryptoStandard(std)) return [];

  return Array.from(live)
    .filter(
      (sym) =>
        !exclude?.has(sym) &&
        isUsdCryptoSymbol(sym, std) &&
        !isCrossCryptoSymbol(sym, std),
    )
    .sort(
      (a, b) =>
        scoreCryptoForBroker(a, std, brokerName) -
        scoreCryptoForBroker(b, std, brokerName),
    );
}

function ecnStpCandidates(standardSymbol: string): string[] {
  const s = standardSymbol.toUpperCase();
  const out: string[] = [];
  const bases: string[] = [];

  if (s === "GOLD") bases.push("XAUUSD");
  else if (s === "BTC") bases.push("BTCUSD");
  else if (s === "ETH") bases.push("ETHUSD");
  else if (s === "SOL30") bases.push("SOL30");
  else bases.push(s);

  for (const b of bases) {
    out.push(
      b,
      `${b}+`,
      `${b}-ECN`,
      `${b}-VIP`,
      `${b}.ecn`,
      `${b}.raw`,
      `${b}.pro`,
      `${b}.crp`,
      `${b}.s`,
      `${b}.i`,
      `${b}.m`,
      `${b}.std`,
      `${b}-STD`,
    );
  }

  if (s === "US30") out.push("DJ30", "DJ30.s", "US30", "US30.cash", "US30.cash-ECN", "WS30");
  if (s === "NAS100") out.push("NAS100", "NAS100.s", "USTEC", "US100", "NDX100");
  if (s === "GER40") {
    out.push(
      "GER40",
      "GER40.s",
      "GER40.cash",
      "DE40",
      "DE40.cash",
      "DAX40",
      "DAX",
      "GER30",
      "DE30",
    );
  }
  if (s === "UK100") out.push("UK100", "UK100.s", "FTSE100");
  if (s === "SPX500") out.push("SPX500", "SPX500.s", "US500");

  return Array.from(new Set(out));
}

function orderByProfile(
  candidates: string[],
  profile: SymbolProfile,
  brokerName?: string | null,
): string[] {
  const isEcn = (sym: string) =>
    /[-+]ECN|ECN|\.ecn|\.raw|\.pro|\+$/i.test(sym) || /\.s$/i.test(sym);
  const isStp = (sym: string) =>
    !isEcn(sym) &&
    (/^[A-Z0-9]{3,10}$/.test(sym) || /\.std|\.m$/i.test(sym));

  const preferEcn =
    profile === "ecn" ||
    (profile === "auto" && /vt\s*markets/i.test(brokerName ?? ""));

  if (preferEcn) {
    return [
      ...candidates.filter(isEcn),
      ...candidates.filter((c) => !isEcn(c)),
    ];
  }
  if (profile === "stp") {
    return [
      ...candidates.filter(isStp),
      ...candidates.filter((c) => !isStp(c)),
    ];
  }
  return candidates;
}

const INDEX_STANDARDS = new Set([
  "US30",
  "NAS100",
  "GER40",
  "UK100",
  "SPX500",
]);

function isIndexStandard(symbol: string): boolean {
  return INDEX_STANDARDS.has(symbol.toUpperCase());
}

function compactSymbol(sym: string): string {
  return sym.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

function liveSymbolMatchesIndex(sym: string, standard: string): boolean {
  const c = compactSymbol(sym);
  switch (standard) {
    case "GER40":
      return (
        /^(GER40|DE40|DAX40|GER30|DE30)$/.test(c) ||
        /^GER40|^DE40|^DAX40|^GER30|^DE30/.test(c)
      );
    case "US30":
      return /^(US30|DJ30|WS30|DOW30)$/.test(c) || /^(US30|DJ30)/.test(c);
    case "NAS100":
      return /^(NAS100|USTEC|US100|NDX100|NASDAQ100)$/.test(c) || /^NAS100|^USTEC|^US100/.test(c);
    case "UK100":
      return /^(UK100|FTSE100)$/.test(c) || /^UK100|^FTSE100/.test(c);
    case "SPX500":
      return /^(SPX500|US500|SP500)$/.test(c) || /^SPX500|^US500/.test(c);
    default:
      return false;
  }
}

function scoreIndexSymbolForBroker(
  sym: string,
  standard: string,
  brokerName: string | null,
): number {
  const c = compactSymbol(sym);
  const b = (brokerName ?? "").toLowerCase();

  if (standard === "GER40") {
    if (/raise/i.test(b)) {
      if (c === "DE40") return 0;
      if (c.startsWith("DE40")) return 2;
      if (c === "GER40") return 6;
      if (c.startsWith("GER40")) return 8;
      if (c.includes("DAX")) return 4;
      return 12;
    }
    if (/vtmarket/i.test(b)) {
      if (/GER40\.S$/i.test(sym)) return 0;
      if (/\.S$/i.test(sym)) return 3;
    }
    if (c === "GER40") return 0;
    if (c.startsWith("GER40")) return 2;
    if (c === "DE40") return 4;
    return 10;
  }

  if (standard === "NAS100") {
    if (/raise/i.test(b)) {
      if (c === "NAS100" && !/[.+]$/.test(sym)) return 0;
      if (c === "USTEC") return 2;
      if (/\+$/.test(sym)) return 20;
      if (/\.R$/i.test(sym)) return 18;
      if (c.startsWith("NAS100")) return 5;
      return 12;
    }
    if (/vantage/i.test(b)) {
      if (/NAS100\.R$/i.test(sym)) return 0;
      if (/\.R$/i.test(sym)) return 4;
      if (c === "NAS100" && !/[.+]$/.test(sym)) return 6;
    }
    if (/vtmarket/i.test(b)) {
      if (/NAS100\.S$/i.test(sym)) return 0;
      if (/\.S$/i.test(sym)) return 3;
    }
    if (c === "NAS100" && !/[.+]$/.test(sym)) return 0;
    if (c === "USTEC") return 3;
    if (/\+$/.test(sym)) return 15;
    return 10;
  }

  if (standard === "US30") {
    if (/raise/i.test(b)) {
      if (c === "US30") return 0;
      if (c === "DJ30") return 3;
    }
    if (/vantage/i.test(b) && c === "DJ30") return 0;
    if (/vtmarket/i.test(b) && /DJ30\.S$/i.test(sym)) return 0;
  }

  if (c === compactSymbol(standard)) return 0;
  if (c.startsWith(compactSymbol(standard))) return 3;
  return 10;
}

/** Indices live triés (GER40 → DE40 sur Raise, etc.). */
export function listRankedLiveIndexSymbols(
  live: Set<string>,
  standardSymbol: string,
  brokerName: string | null,
  exclude?: Set<string>,
): string[] {
  const std = standardSymbol.toUpperCase();
  if (!isIndexStandard(std)) return [];

  return Array.from(live)
    .filter(
      (sym) =>
        !exclude?.has(sym) && liveSymbolMatchesIndex(sym, std),
    )
    .sort(
      (a, b) =>
        scoreIndexSymbolForBroker(a, std, brokerName) -
        scoreIndexSymbolForBroker(b, std, brokerName),
    );
}

function scoreGoldForBroker(sym: string, brokerName: string | null): number {
  const b = (brokerName ?? "").toLowerCase().replace(/\s+/g, "");
  const c = sym.replace(/[^A-Z0-9]/gi, "").toUpperCase();

  if (isCrossGoldSymbol(sym)) return 100;

  if (/vantage/i.test(b)) {
    if (/XAUUSD\+$/i.test(sym) || (sym.endsWith("+") && /XAUUSD/i.test(sym))) {
      return 0;
    }
    if (/XAUUSD/i.test(sym) && !sym.endsWith("+")) return 18;
    if (c.startsWith("XAUUSD")) return 4;
    return 12;
  }
  if (/vtmarket/i.test(b)) {
    if (/XAUUSD/i.test(sym) && /VIP/i.test(sym)) return 0;
    if (/VIP/i.test(sym)) return 50;
    if (/ECN/i.test(sym)) return 6;
    if (/\.crp$/i.test(sym)) return 20;
    if (/[-.]STD$/i.test(sym) || /\.STD/i.test(sym)) return 22;
    if (c === "XAUUSD") return 8;
    return 14;
  }
  if (/fxcess/i.test(b)) {
    if (c === "XAUUSD" || c === "GOLD") return 0;
    return 10;
  }
  if (/raise/i.test(b)) {
    if (c === "GOLD") return 0;
    if (c === "XAUUSD" || c.startsWith("XAUUSD")) return 4;
    return 12;
  }
  if (c === "XAUUSD") return 5;
  if (/^XAUUSD/i.test(sym)) return 7;
  if (/^GOLD/i.test(sym)) return 9;
  return 15;
}

function fuzzyMatchSymbol(
  available: Set<string>,
  standardSymbol: string,
  exclude?: Set<string>,
  brokerName?: string | null,
): string | null {
  if (isIndexStandard(standardSymbol)) {
    return (
      listRankedLiveIndexSymbols(
        available,
        standardSymbol,
        brokerName ?? null,
        exclude,
      )[0] ?? null
    );
  }

  if (isCryptoStandard(standardSymbol)) {
    return (
      listRankedLiveCryptoSymbols(
        available,
        standardSymbol,
        brokerName ?? null,
        exclude,
      )[0] ?? null
    );
  }

  const compact = standardSymbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  for (const sym of Array.from(available)) {
    if (exclude?.has(sym)) continue;
    if (standardSymbol === "GOLD" && !isUsdGoldSymbol(sym)) continue;
    if (isCryptoStandard(standardSymbol) && !isUsdCryptoSymbol(sym, standardSymbol)) {
      continue;
    }
    const c = sym.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    if (c === compact) return sym;
  }
  if (standardSymbol === "GOLD") {
    const gold = Array.from(available).filter(
      (sym) =>
        !exclude?.has(sym) &&
        isUsdGoldSymbol(sym) &&
        !isCrossGoldSymbol(sym) &&
        !/^(BTC|ETH)/i.test(sym.replace(/[^A-Z0-9]/gi, "")),
    );
    gold.sort(
      (a, b) =>
        scoreGoldForBroker(a, brokerName ?? null) -
        scoreGoldForBroker(b, brokerName ?? null),
    );
    if (gold[0]) return gold[0];
  }
  return null;
}

function pickLiveSymbol(
  candidates: string[],
  live: Set<string>,
  standardSymbol: string,
  exclude?: Set<string>,
  brokerName?: string | null,
): string | null {
  if (standardSymbol === "GOLD") {
    const sorted = [...candidates]
      .filter((c) => !exclude?.has(c) && isUsdGoldSymbol(c) && !isCrossGoldSymbol(c))
      .sort(
        (a, b) =>
          scoreGoldForBroker(a, brokerName ?? null) -
          scoreGoldForBroker(b, brokerName ?? null),
      );
    for (const c of sorted) {
      if (exclude?.has(c)) continue;
      if (!isUsdGoldSymbol(c)) continue;
      const hit = findInLiveSet(c, live);
      if (hit && !exclude?.has(hit)) return hit;
    }
    const fuzzy = fuzzyMatchSymbol(live, standardSymbol, exclude, brokerName);
    if (fuzzy && isUsdGoldSymbol(fuzzy) && !isCrossGoldSymbol(fuzzy)) {
      return fuzzy;
    }
    return null;
  }

  if (isCryptoStandard(standardSymbol)) {
    const ranked = listRankedLiveCryptoSymbols(
      live,
      standardSymbol,
      brokerName ?? null,
      exclude,
    );
    if (ranked[0]) return ranked[0];

    for (const c of candidates) {
      if (exclude?.has(c)) continue;
      if (!isUsdCryptoSymbol(c, standardSymbol)) continue;
      const hit = findInLiveSet(c, live);
      if (hit && !exclude?.has(hit)) return hit;
    }
    return fuzzyMatchSymbol(live, standardSymbol, exclude, brokerName);
  }

  if (isIndexStandard(standardSymbol)) {
    const ranked = listRankedLiveIndexSymbols(
      live,
      standardSymbol,
      brokerName ?? null,
      exclude,
    );
    if (ranked[0]) return ranked[0];

    for (const c of candidates) {
      if (exclude?.has(c)) continue;
      const hit = findInLiveSet(c, live);
      if (hit && !exclude?.has(hit)) return hit;
    }
    return fuzzyMatchSymbol(live, standardSymbol, exclude, brokerName);
  }

  for (const c of candidates) {
    if (exclude?.has(c)) continue;
    const hit = findInLiveSet(c, live);
    if (hit && !exclude?.has(hit)) return hit;
  }
  return fuzzyMatchSymbol(live, standardSymbol, exclude, brokerName);
}

/** Ne jamais envoyer le symbole standard (GOLD) tel quel au broker. */
function finalizeBrokerSymbol(
  picked: string,
  normalizedSymbol: string,
  ordered: string[],
): string {
  const stdOnly = new Set([
    "GOLD",
    "BTC",
    "ETH",
    "SOL30",
    "US30",
    "NAS100",
    "GER40",
    "UK100",
    "SPX500",
  ]);

  if (normalizedSymbol === "GOLD" && (picked === "GOLD" || stdOnly.has(picked))) {
    const xau =
      ordered.find((c) => /^XAUUSD\+$/i.test(c)) ??
      ordered.find((c) => /XAUUSD-VIP/i.test(c)) ??
      ordered.find((c) => /^XAUUSD/i.test(c)) ??
      ordered.find((c) => /XAUUSD/i.test(c)) ??
      "XAUUSD";
    return xau;
  }

  if (
    normalizedSymbol === "GOLD" &&
    (isCrossGoldSymbol(picked) || !isUsdGoldSymbol(picked))
  ) {
    const xau =
      ordered.find((c) => isUsdGoldSymbol(c)) ??
      ordered.find((c) => /^XAUUSD/i.test(c)) ??
      "XAUUSD";
    return xau;
  }

  if (
    isCryptoStandard(normalizedSymbol) &&
    (isCrossCryptoSymbol(picked, normalizedSymbol) ||
      !isUsdCryptoSymbol(picked, normalizedSymbol) ||
      picked === normalizedSymbol)
  ) {
    const usd =
      ordered.find((c) => isUsdCryptoSymbol(c, normalizedSymbol)) ??
      (normalizedSymbol === "BTC"
        ? "BTCUSD"
        : normalizedSymbol === "ETH"
          ? "ETHUSD"
          : normalizedSymbol === "SOL30"
            ? "SOL30"
            : picked);
    return usd;
  }

  if (stdOnly.has(picked) && picked === normalizedSymbol) {
    if (normalizedSymbol === "BTC") {
      const btc = ordered.find((c) => isUsdCryptoSymbol(c, "BTC"));
      if (btc) return btc;
    }
    if (normalizedSymbol === "ETH") {
      const eth = ordered.find((c) => isUsdCryptoSymbol(c, "ETH"));
      if (eth) return eth;
    }
    const alt = ordered.find((c) => c !== picked);
    if (alt) return alt;
  }

  return picked;
}

/** Symboles GOLD/XAUUSD triés par préférence broker (live MetaAPI uniquement). */
export function listRankedLiveGoldSymbols(
  live: Set<string>,
  brokerName: string | null,
  exclude?: Set<string>,
): string[] {
  return Array.from(live)
    .filter(
      (sym) =>
        !exclude?.has(sym) &&
        isUsdGoldSymbol(sym) &&
        !isCrossGoldSymbol(sym) &&
        !/^(BTC|ETH)/i.test(sym.replace(/[^A-Z0-9]/gi, "")),
    )
    .sort(
      (a, b) =>
        scoreGoldForBroker(a, brokerName) -
        scoreGoldForBroker(b, brokerName),
    );
}

function applyBrokerGoldOverride(
  symbol: string,
  normalizedSymbol: string,
  brokerName: string | null,
  live?: Set<string> | null,
): string {
  if (normalizedSymbol !== "GOLD") return symbol;
  const mandatory = mandatoryBrokerGoldSymbol(brokerName);
  if (!mandatory) return symbol;

  if (live && live.size > 0) {
    const mandatoryHit = findInLiveSet(mandatory, live);
    if (mandatoryHit) return mandatoryHit;
    const symbolHit = findInLiveSet(symbol, live);
    if (symbolHit) return symbolHit;
    const ranked = listRankedLiveGoldSymbols(live, brokerName);
    if (ranked[0]) return ranked[0];
    return symbol;
  }

  return mandatory;
}

export async function resolveBrokerSymbol(
  standardSymbolInput: string,
  brokerName: string | null,
  supabase: any,
  options?: {
    metaApiAccountId?: string | null;
    metaApiToken?: string | null;
    symbolProfile?: SymbolProfile | null;
    excludeSymbols?: string[];
    refreshSymbols?: boolean;
  },
): Promise<string> {
  const normalizedSymbol = normalizeSymbol(standardSymbolInput);
  const profile = options?.symbolProfile ?? "auto";
  const exclude = new Set(
    (options?.excludeSymbols ?? []).map((s) => s.trim()).filter(Boolean),
  );

  const namesOrdered: string[] = [];
  for (const n of brokerMappingKeys(brokerName ?? "")) {
    if (n && !namesOrdered.includes(n)) namesOrdered.push(n);
  }

  const candidates: string[] = [];

  if (namesOrdered.length > 0) {
    try {
      const { data: rows } = await supabase
        .from("symbol_mappings")
        .select("broker_symbol, broker_name")
        .eq("standard_symbol", normalizedSymbol)
        .in("broker_name", namesOrdered);

      if (Array.isArray(rows)) {
        rows.sort(
          (a, b) =>
            namesOrdered.indexOf(a.broker_name) -
            namesOrdered.indexOf(b.broker_name),
        );
        for (const r of rows) {
          if (r.broker_symbol) candidates.push(r.broker_symbol);
        }
      }
    } catch {
      /* static fallback */
    }
  }

  for (const name of namesOrdered) {
    const mapped = staticBrokerSymbol(name, normalizedSymbol);
    if (mapped) candidates.push(mapped);
  }

  candidates.push(...ecnStpCandidates(normalizedSymbol));
  if (normalizedSymbol === "BTC") candidates.push("BTCUSD");
  else if (normalizedSymbol === "ETH") candidates.push("ETHUSD");
  else candidates.push(normalizedSymbol);

  const ordered = orderByProfile(
    Array.from(new Set(candidates)).filter((c) => !exclude.has(c)),
    profile,
    brokerName,
  );

  const token = options?.metaApiToken;
  const accountId = options?.metaApiAccountId;
  if (token && accountId) {
    let live = await getLiveSymbols(
      accountId,
      token,
      options?.refreshSymbols ?? false,
    );
    if (!live.ok) {
      live = await getLiveSymbols(accountId, token, true);
    }
    if (live.ok && live.symbols.size > 0) {
      if (normalizedSymbol === "GOLD") {
        const mandatory = mandatoryBrokerGoldSymbol(brokerName);
        if (mandatory) {
          const mHit = findInLiveSet(mandatory, live.symbols);
          if (mHit && !exclude.has(mHit)) return mHit;
        }
        const ranked = listRankedLiveGoldSymbols(
          live.symbols,
          brokerName,
          exclude,
        );
        if (ranked[0]) return ranked[0];
      }

      if (isIndexStandard(normalizedSymbol)) {
        const rankedIndex = listRankedLiveIndexSymbols(
          live.symbols,
          normalizedSymbol,
          brokerName,
          exclude,
        );
        if (rankedIndex[0]) return rankedIndex[0];
      }

      if (isCryptoStandard(normalizedSymbol)) {
        for (const name of namesOrdered) {
          const mapped = staticBrokerSymbol(name, normalizedSymbol);
          if (!mapped || exclude.has(mapped)) continue;
          if (!isUsdCryptoSymbol(mapped, normalizedSymbol)) continue;
          const hit = findInLiveSet(mapped, live.symbols);
          if (hit && !exclude.has(hit)) return hit;
        }

        const rankedCrypto = listRankedLiveCryptoSymbols(
          live.symbols,
          normalizedSymbol,
          brokerName,
          exclude,
        );
        if (rankedCrypto[0]) return rankedCrypto[0];

        for (const name of namesOrdered) {
          const mapped = staticBrokerSymbol(name, normalizedSymbol);
          if (
            mapped &&
            !exclude.has(mapped) &&
            isUsdCryptoSymbol(mapped, normalizedSymbol)
          ) {
            return mapped;
          }
        }
      }

      for (const name of namesOrdered) {
        const mapped = staticBrokerSymbol(name, normalizedSymbol);
        if (!mapped || exclude.has(mapped)) continue;
        const hit = findInLiveSet(mapped, live.symbols);
        if (hit && !exclude.has(hit)) {
          return applyBrokerGoldOverride(
            finalizeBrokerSymbol(hit, normalizedSymbol, ordered),
            normalizedSymbol,
            brokerName,
            live.symbols,
          );
        }
      }

      const picked = pickLiveSymbol(
        ordered,
        live.symbols,
        normalizedSymbol,
        exclude,
        brokerName,
      );
      if (picked) {
        return applyBrokerGoldOverride(
          finalizeBrokerSymbol(picked, normalizedSymbol, ordered),
          normalizedSymbol,
          brokerName,
          live.symbols,
        );
      }
      const fuzzy = fuzzyMatchSymbol(
        live.symbols,
        normalizedSymbol,
        exclude,
        brokerName,
      );
      if (fuzzy) {
        return applyBrokerGoldOverride(
          fuzzy,
          normalizedSymbol,
          brokerName,
          live.symbols,
        );
      }

      if (normalizedSymbol === "GOLD") {
        const ranked = listRankedLiveGoldSymbols(live.symbols, brokerName, exclude);
        if (ranked[0]) return ranked[0];
      }

      if (isIndexStandard(normalizedSymbol)) {
        const rankedIndex = listRankedLiveIndexSymbols(
          live.symbols,
          normalizedSymbol,
          brokerName,
          exclude,
        );
        if (rankedIndex[0]) return rankedIndex[0];
      }
    }
  }

  const fallback =
    ordered.find((c) => !exclude.has(c)) ?? normalizedSymbol;
  const finalized = applyBrokerGoldOverride(
    finalizeBrokerSymbol(fallback, normalizedSymbol, ordered),
    normalizedSymbol,
    brokerName,
  );

  if (token && accountId) {
    const live = await getLiveSymbols(accountId, token, options?.refreshSymbols ?? false);
    if (live.ok && live.symbols.size > 0) {
      const hit = findInLiveSet(finalized, live.symbols);
      if (hit) return hit;
      if (isIndexStandard(normalizedSymbol)) {
        const rankedIndex = listRankedLiveIndexSymbols(
          live.symbols,
          normalizedSymbol,
          brokerName,
          exclude,
        );
        if (rankedIndex[0]) return rankedIndex[0];
      }
    }
  }

  return finalized;
}
