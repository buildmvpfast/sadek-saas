/**
 * Connexion FXcess MT4 uniquement — tentatives multi-noms MetaAPI.
 */
import type { ConnectAttempt } from "@/lib/broker-connect-config";
import {
  pickFxcessKnownServer,
  searchFxcessKnownServers,
  type KnownServerMatch,
} from "@/lib/metaapi-known-servers";
import {
  fxcessServerVariant,
  fxcessStaticServerCandidates,
} from "@/lib/fxcess-servers";

function isFxcessBlob(blob: string): boolean {
  return /fxcess|fxness|mfx/i.test(blob);
}

function uniqServers(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    const t = n.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export function listFxcessKnownForVariant(
  known: Record<string, string[]>,
  userServer: string,
): KnownServerMatch[] {
  const variant = fxcessServerVariant(userServer);
  const out: KnownServerMatch[] = [];
  const seen = new Set<string>();

  for (const [broker, servers] of Object.entries(known)) {
    if (!Array.isArray(servers)) continue;
    for (const server of servers) {
      if (typeof server !== "string" || !server.trim()) continue;
      if (!isFxcessBlob(`${broker} ${server}`)) continue;
      if (variant !== "other" && fxcessServerVariant(server) !== variant) {
        continue;
      }
      const key = server.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ server: server.trim(), keywords: [broker], brokerNames: [broker] });
    }
  }
  return out;
}

const DEFAULT_FXCESS_KEYWORDS = [
  "FXcess",
  "FXCess",
  "MFX",
  "MFX Capital",
  "MFX Capital Markets Ltd",
];

function keywordsForServer(
  server: string,
  known: Record<string, string[]>,
): string[] {
  const match = pickFxcessKnownServer(server, known);
  if (match?.keywords?.length) {
    return Array.from(new Set([...match.keywords, ...DEFAULT_FXCESS_KEYWORDS]));
  }
  return [...DEFAULT_FXCESS_KEYWORDS];
}

/** Toutes les tentatives FXcess (même variante demo/demo1) — source MetaAPI + MT4. */
export async function buildFxcessConnectAttempts(
  rawServer: string,
  canonicalServer: string,
  token: string,
): Promise<ConnectAttempt[]> {
  const known = await searchFxcessKnownServers(token);
  const variantMatches = listFxcessKnownForVariant(known, canonicalServer);

  const serverNames = uniqServers([
    canonicalServer,
    rawServer.trim(),
    ...fxcessStaticServerCandidates(canonicalServer),
    ...variantMatches.map((m) => m.server),
  ]);

  const attempts: ConnectAttempt[] = [];
  const seenAttempt = new Set<string>();

  const pushAttempt = (server: string, keywords: string[]) => {
    const key = `${server.toLowerCase()}|${keywords.length > 0 ? "kw" : "nokw"}`;
    if (seenAttempt.has(key)) return;
    seenAttempt.add(key);
    attempts.push({ server, platform: "mt4", keywords });
  };

  for (const server of serverNames) {
    pushAttempt(server, keywordsForServer(server, known));
    pushAttempt(server, []);
  }

  return attempts;
}

export function fxcessSameVariant(
  userServer: string,
  candidateServer: string,
): boolean {
  const userVariant = fxcessServerVariant(userServer);
  if (userVariant === "other") return true;
  return fxcessServerVariant(candidateServer) === userVariant;
}
