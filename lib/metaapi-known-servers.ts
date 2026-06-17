/**
 * Recherche serveurs MT connus MetaAPI (source de vérité pour la connexion).
 * GET /known-mt-servers/:version/search?query=...
 */
import {
  fxcessServerVariant,
  fxcessStaticServerCandidates,
} from "@/lib/fxcess-servers";

const KNOWN_MT_SERVERS_BASE =
  "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/known-mt-servers";

export type KnownServerMatch = {
  server: string;
  keywords: string[];
  brokerNames: string[];
};

function compactKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]+/g, "");
}

/** Recherche MetaAPI — retourne brokers → serveurs. */
export async function searchKnownMtServers(
  version: 4 | 5,
  query: string,
  token: string,
): Promise<Record<string, string[]>> {
  const q = query.trim();
  if (!q || !token) return {};

  const url = `${KNOWN_MT_SERVERS_BASE}/${version}/search?query=${encodeURIComponent(q)}`;
  try {
    const r = await fetch(url, {
      headers: { "auth-token": token, Accept: "application/json" },
      cache: "no-store",
    });
    if (!r.ok) return {};
    const data = (await r.json()) as Record<string, string[]>;
    if (!data || typeof data !== "object") return {};
    return data;
  } catch {
    return {};
  }
}

export function flattenKnown(
  known: Record<string, string[]>,
): Array<{ broker: string; server: string }> {
  const out: Array<{ broker: string; server: string }> = [];
  for (const [broker, servers] of Object.entries(known)) {
    if (!Array.isArray(servers)) continue;
    for (const server of servers) {
      if (typeof server === "string" && server.trim()) {
        out.push({ broker, server: server.trim() });
      }
    }
  }
  return out;
}

function isFxcessServerBlob(blob: string): boolean {
  return /fxcess|fxness|mfx/i.test(blob);
}

/** Résout le nom exact MetaAPI pour FXcess sans basculer Demo ↔ Demo1. */
export function pickFxcessKnownServer(
  input: string,
  known: Record<string, string[]>,
): KnownServerMatch | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const flat = flattenKnown(known).filter(({ broker, server }) =>
    isFxcessServerBlob(`${broker} ${server}`),
  );
  if (flat.length === 0) return null;

  const variant = fxcessServerVariant(trimmed);
  const inputKey = compactKey(trimmed);

  for (const { broker, server } of flat) {
    if (compactKey(server) === inputKey) {
      return { server, keywords: [broker], brokerNames: [broker] };
    }
  }

  const pool =
    variant === "other"
      ? flat
      : flat.filter(({ server }) => fxcessServerVariant(server) === variant);

  if (pool.length === 0) return null;

  const scored = pool
    .map(({ broker, server }) => {
      const sk = compactKey(server);
      let score = 0;
      if (sk === inputKey) score += 100;
      if (sk.includes(inputKey) || inputKey.includes(sk)) score += 35;
      if (isFxcessServerBlob(server)) score += 15;
      return { broker, server, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = scored[0] ?? pool[0];
  return {
    server: best.server,
    keywords: [best.broker],
    brokerNames: [best.broker],
  };
}

/** Trouve le meilleur serveur MetaAPI connu pour une saisie utilisateur. */
export function matchKnownServer(
  input: string,
  known: Record<string, string[]>,
): KnownServerMatch | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (isFxcessServerBlob(trimmed)) {
    return pickFxcessKnownServer(trimmed, known);
  }

  const flat = flattenKnown(known);
  if (flat.length === 0) return null;

  const inputKey = compactKey(trimmed);

  // Exact (casse / espaces)
  for (const { broker, server } of flat) {
    if (compactKey(server) === inputKey) {
      return {
        server,
        keywords: [broker],
        brokerNames: [broker],
      };
    }
  }

  // Contient demo/live + vantage
  const isDemo = /demo/i.test(trimmed);
  const isLive = /live|real/i.test(trimmed);

  const scored = flat
    .map(({ broker, server }) => {
      const sk = compactKey(server);
      let score = 0;
      if (sk.includes(inputKey) || inputKey.includes(sk)) score += 50;
      if (/vantage/i.test(server)) score += 20;
      if (/fxcess/i.test(server)) score += 25;
      if (isDemo && /demo/i.test(server)) score += 30;
      if (isLive && /live|real/i.test(server)) score += 30;
      if (/international/i.test(trimmed) && /international/i.test(server))
        score += 25;
      if (/markets/i.test(trimmed) && /markets/i.test(server)) score += 15;
      return { broker, server, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;

  const best = scored[0];
  const brokerNames = Array.from(
    new Set(
      scored
        .filter((s) => compactKey(s.server) === compactKey(best.server))
        .map((s) => s.broker),
    ),
  );
  return {
    server: best.server,
    keywords: brokerNames.length > 0 ? brokerNames : [best.broker],
    brokerNames,
  };
}

/** Agrège plusieurs requêtes MetaAPI pour Vantage (demo + live + international). */
export async function searchVantageKnownServers(
  token: string,
  platform: "mt4" | "mt5" = "mt5",
): Promise<Record<string, string[]>> {
  const version = platform === "mt4" ? 4 : 5;
  const queries = [
    "vantage international demo",
    "vantage international",
    "vantage markets",
    "vantage fx",
    "vantage prime",
    "vantage global",
    "vantage",
  ];

  const merged: Record<string, string[]> = {};
  for (const q of queries) {
    const chunk = await searchKnownMtServers(version, q, token);
    for (const [broker, servers] of Object.entries(chunk)) {
      if (!merged[broker]) merged[broker] = [];
      for (const s of servers) {
        if (!merged[broker].includes(s)) merged[broker].push(s);
      }
    }
  }
  return merged;
}

/** Agrège requêtes MetaAPI pour FXCess (MT4). */
export async function searchFxcessKnownServers(
  token: string,
): Promise<Record<string, string[]>> {
  const queries = [
    "fxcess",
    "mfx capital",
    "FXCESS-Demo",
    "FXCESS-Demo01",
  ];

  const merged: Record<string, string[]> = {};
  for (const q of queries) {
    const chunk = await searchKnownMtServers(4, q, token);
    for (const [broker, servers] of Object.entries(chunk)) {
      if (!merged[broker]) merged[broker] = [];
      for (const s of servers) {
        if (!merged[broker].includes(s)) merged[broker].push(s);
      }
    }
  }
  return merged;
}

/** Extrait les noms de serveurs cités dans un message Validation failed MetaAPI. */
export function extractServersFromMetaApiMessage(message: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /[A-Z][A-Za-z0-9]*(?:[-_][A-Za-z0-9]+)+/g;
  for (const m of message.match(re) ?? []) {
    if (!/demo|live|fxcess|mfx/i.test(m)) continue;
    const key = m.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

/** Liste plate triée : demo d'abord, puis live. */
export function extractSuggestedServersFromMetaApiError(
  data: Record<string, unknown>,
): KnownServerMatch[] {
  const details = data.details as Record<string, unknown> | undefined;
  const byBrokers = details?.serversByBrokers as
    | Record<string, string[]>
    | undefined;
  if (!byBrokers || typeof byBrokers !== "object") return [];

  const out: KnownServerMatch[] = [];
  for (const [broker, servers] of Object.entries(byBrokers)) {
    if (!Array.isArray(servers)) continue;
    for (const server of servers) {
      if (typeof server !== "string" || !server.trim()) continue;
      out.push({
        server: server.trim(),
        keywords: [broker],
        brokerNames: [broker],
      });
    }
  }
  return out;
}

/** Liste plate triée : demo d'abord, puis live. */
export function listKnownServerNames(
  known: Record<string, string[]>,
): string[] {
  const names = flattenKnown(known).map((x) => x.server);
  const uniq = Array.from(new Set(names));
  return uniq.sort((a, b) => {
    const aDemo = /demo/i.test(a) ? 0 : 1;
    const bDemo = /demo/i.test(b) ? 0 : 1;
    if (aDemo !== bDemo) return aDemo - bDemo;
    return a.localeCompare(b);
  });
}

/** Candidats statiques FXcess. */
export function fxcessConnectFallbacks(rawServer: string): string[] {
  return fxcessStaticServerCandidates(rawServer);
}

export function vantageConnectFallbacks(rawServer: string): string[] {
  const isDemo = /demo/i.test(rawServer);
  if (isDemo) {
    return [
      "VantageInternational-Demo",
      "VantageInternational-Demo 2",
      "VantageMarkets-Demo",
      "VantageFX-Demo",
      "VantagePrimeLimited-Demo",
    ];
  }
  return [
    rawServer.trim(),
    "VantageInternational-Live",
    "VantageMarkets-Live",
  ];
}
