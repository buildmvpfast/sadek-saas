/**
 * Alias et recherche serveurs MT5 (PDF feedback Sadek SaaS).
 * Normalise la saisie utilisateur → nom exact attendu par MetaAPI/MT5.
 */

/** clé = lowercase sans espaces */
const SERVER_ALIASES: Record<string, string> = {
  vantageinternationallive21: "VantageInternational-Live 21",
  vantagemarketslive21: "VantageMarkets-Live 21",
  démodevtmarkets: "VTMarkets-Demo",
  demodevtmarkets: "VTMarkets-Demo",
  démodévtmarkets: "VTMarkets-Demo",
  vtmarketsdemo: "VTMarkets-Demo",
  fxcesslive01: "FXCESS-Live01",
  fxcesslive1: "FXCESS-Live01",
  fxcessdemo: "FXCESS-Demo01",
  "fxcess-demo": "FXCESS-Demo01",
  fxcessdemo01: "FXCESS-Demo01",
  vantagemarketsdemo: "VantageInternational-Demo",
  vantageinternationaldemo: "VantageInternational-Demo",
  vantageinternationaldemo2: "VantageInternational-Demo 2",
  vantagefxdemo: "VantageFX-Demo",
  vantageprimelimiteddemo: "VantagePrimeLimited-Demo",
  raiseglobalsalive: "RaiseGlobalSA-LIVE",
  raiseglobalserver: "RaiseGroup-Server",
};

function aliasKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

/**
 * Résout un alias ou une variante d’espacement vers le nom canonique MT5.
 * Si aucun alias : retourne la valeur trimée (espaces multiples → un espace).
 */
export function resolveServerName(input: string): string {
  const trimmed = input.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;

  const key = aliasKey(trimmed);
  if (SERVER_ALIASES[key]) return SERVER_ALIASES[key];

  // VantageInternational-Demo2 → avec espace
  const demoNoSpace = trimmed.match(
    /^(VantageInternational)-Demo(\d+)$/i,
  );
  if (demoNoSpace) {
    return `${demoNoSpace[1]}-Demo ${demoNoSpace[2]}`;
  }

  // VantageInternational-Live21 sans espace → avec espace
  const liveNoSpace = trimmed.match(
    /^(Vantage(?:International|Markets|FX))-Live(\d+)$/i,
  );
  if (liveNoSpace) {
    return `${liveNoSpace[1]}-Live ${liveNoSpace[2]}`;
  }

  // VTMarkets-Live5 → VTMarkets-Live 5
  const vtNoSpace = trimmed.match(/^VT\s*Markets-Live(\d+)$/i);
  if (vtNoSpace) {
    return `VTMarkets-Live ${vtNoSpace[1]}`;
  }

  return trimmed;
}

/**
 * Recherche fuzzy dans une liste de serveurs (UI dropdown).
 */
export function filterServers(query: string, servers: string[]): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return servers;

  const resolved = resolveServerName(query);
  const qCompact = q.replace(/\s+/g, "");

  return servers.filter((s) => {
    const name = s.toLowerCase();
    const compact = name.replace(/\s+/g, "");
    return (
      name.includes(q) ||
      compact.includes(qCompact) ||
      s === resolved ||
      resolveServerName(s).toLowerCase() === resolved.toLowerCase()
    );
  });
}

/**
 * Si la saisie manuelle ne matche aucune liste, retourne quand même le nom résolu.
 */
export function canonicalServerOrResolved(
  input: string,
  knownServers: string[],
): string {
  const resolved = resolveServerName(input);
  const exact = knownServers.find(
    (s) => s.toLowerCase() === resolved.toLowerCase(),
  );
  if (exact) return exact;

  const fuzzy = knownServers.find(
    (s) => aliasKey(s) === aliasKey(resolved),
  );
  if (fuzzy) return fuzzy;

  return resolved;
}
