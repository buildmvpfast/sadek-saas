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

function ecnStpCandidates(standardSymbol: string): string[] {
  const s = standardSymbol.toUpperCase();
  const out: string[] = [];
  const bases = [s];

  if (s === "GOLD") bases.push("XAUUSD");
  if (s === "BTC") bases.push("BTCUSD");
  if (s === "ETH") bases.push("ETHUSD");

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

  if (s === "US30") out.push("DJ30", "DJ30.s", "US30", "US30.cash", "US30.cash-ECN");
  if (s === "NAS100") out.push("NAS100", "NAS100.s", "USTEC", "US100");
  if (s === "GER40") out.push("GER40", "GER40.s", "DE40", "DAX");
  if (s === "UK100") out.push("UK100", "UK100.s", "FTSE100");
  if (s === "SPX500") out.push("SPX500", "SPX500.s", "US500");

  return Array.from(new Set(out));
}

function orderByProfile(
  candidates: string[],
  profile: SymbolProfile,
): string[] {
  const isEcn = (sym: string) =>
    /[-+]ECN|ECN|\.ecn|\.raw|\.pro|\+$/i.test(sym) || /\.s$/i.test(sym);
  const isStp = (sym: string) =>
    !isEcn(sym) &&
    (/^[A-Z0-9]{3,10}$/.test(sym) || /\.std|\.m$/i.test(sym));

  if (profile === "ecn") {
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

function scoreGoldForBroker(sym: string, brokerName: string | null): number {
  const b = (brokerName ?? "").toLowerCase().replace(/\s+/g, "");
  const c = sym.replace(/[^A-Z0-9]/gi, "").toUpperCase();

  if (isCrossGoldSymbol(sym)) return 100;

  if (/vantage/i.test(b)) {
    if (/XAUUSD\+$/i.test(sym) || (sym.endsWith("+") && /XAUUSD/i.test(sym))) return 0;
    if (c.startsWith("XAUUSD")) return 4;
    return 12;
  }
  if (/vtmarket/i.test(b)) {
    if (/XAUUSD/i.test(sym) && /VIP/i.test(sym)) return 0;
    if (/VIP/i.test(sym)) return 50;
    if (/ECN/i.test(sym)) return 6;
    if (c === "XAUUSD") return 8;
    return 14;
  }
  if (/fxcess/i.test(b)) {
    if (c === "XAUUSD" || c === "GOLD") return 0;
    return 10;
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
  const compact = standardSymbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  for (const sym of Array.from(available)) {
    if (exclude?.has(sym)) continue;
    if (standardSymbol === "GOLD" && !isUsdGoldSymbol(sym)) continue;
    const c = sym.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    if (c === compact || c.startsWith(compact) || compact.startsWith(c)) {
      return sym;
    }
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

  if (stdOnly.has(picked) && picked === normalizedSymbol) {
    const alt = ordered.find((c) => c !== picked);
    if (alt) return alt;
  }

  return picked;
}

function applyBrokerGoldOverride(
  symbol: string,
  normalizedSymbol: string,
  brokerName: string | null,
): string {
  if (normalizedSymbol !== "GOLD") return symbol;
  return mandatoryBrokerGoldSymbol(brokerName) ?? symbol;
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
  candidates.push(normalizedSymbol);

  const ordered = orderByProfile(
    Array.from(new Set(candidates)).filter((c) => !exclude.has(c)),
    profile,
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
      for (const name of namesOrdered) {
        const mapped = staticBrokerSymbol(name, normalizedSymbol);
        if (!mapped || exclude.has(mapped)) continue;
        const hit = findInLiveSet(mapped, live.symbols);
        if (hit && !exclude.has(hit)) {
          return applyBrokerGoldOverride(
            finalizeBrokerSymbol(hit, normalizedSymbol, ordered),
            normalizedSymbol,
            brokerName,
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
        );
      }
      const fuzzy = fuzzyMatchSymbol(
        live.symbols,
        normalizedSymbol,
        exclude,
        brokerName,
      );
      if (fuzzy) {
        return applyBrokerGoldOverride(fuzzy, normalizedSymbol, brokerName);
      }
    }
  }

  const fallback =
    ordered.find((c) => !exclude.has(c)) ?? normalizedSymbol;
  return applyBrokerGoldOverride(
    finalizeBrokerSymbol(fallback, normalizedSymbol, ordered),
    normalizedSymbol,
    brokerName,
  );
}
