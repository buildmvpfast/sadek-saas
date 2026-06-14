/**
 * Résolution symbole broker : static → ECN/STP → symboles réels MetaAPI du compte.
 */
import {
  brokerMappingKeys,
  staticBrokerSymbol,
} from "@/lib/broker-symbol-fallback";
import { normalizeSymbol } from "@/lib/symbol-normalizer";
import { fetchMetaApiSymbolNames } from "@/lib/metaapi-trade-client";
import type { SymbolProfile } from "@/lib/trade-risk";

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
      `${b}.ecn`,
      `${b}.raw`,
      `${b}.pro`,
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

  return [...new Set(out)];
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

function fuzzyMatchSymbol(
  available: Set<string>,
  standardSymbol: string,
): string | null {
  const compact = standardSymbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  for (const sym of available) {
    const c = sym.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    if (c === compact || c.startsWith(compact) || compact.startsWith(c)) {
      return sym;
    }
  }
  if (standardSymbol === "GOLD") {
    for (const sym of available) {
      if (/XAU|GOLD/i.test(sym)) return sym;
    }
  }
  return null;
}

export async function resolveBrokerSymbol(
  standardSymbolInput: string,
  brokerName: string | null,
  supabase: {
    from: (t: string) => {
      select: (s: string) => {
        eq: (
          c: string,
          v: string,
        ) => {
          in: (
            c: string,
            v: string[],
          ) => Promise<{
            data?: { broker_symbol: string; broker_name: string }[] | null;
            error?: unknown;
          }>;
        };
      };
    };
  },
  options?: {
    metaApiAccountId?: string | null;
    metaApiToken?: string | null;
    symbolProfile?: SymbolProfile | null;
  },
): Promise<string> {
  const normalizedSymbol = normalizeSymbol(standardSymbolInput);
  const profile = options?.symbolProfile ?? "auto";

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

  const ordered = orderByProfile([...new Set(candidates)], profile);

  const token = options?.metaApiToken;
  const accountId = options?.metaApiAccountId;
  if (token && accountId) {
    const live = await fetchMetaApiSymbolNames(accountId, token);
    if (live.ok && live.symbols.size > 0) {
      for (const c of ordered) {
        if (live.symbols.has(c)) return c;
      }
      const fuzzy = fuzzyMatchSymbol(live.symbols, normalizedSymbol);
      if (fuzzy) return fuzzy;
    }
  }

  return ordered[0] ?? normalizedSymbol;
}
