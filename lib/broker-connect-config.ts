/**
 * Config connexion MetaAPI par broker (platform, keywords, alias serveur).
 */
import { resolveServerName } from "@/lib/server-aliases";
import { findBrokerByName } from "@/lib/metaapi-broker-servers";
import {
  fxcessConnectFallbacks,
  matchKnownServer,
  searchFxcessKnownServers,
  searchVantageKnownServers,
  vantageConnectFallbacks,
} from "@/lib/metaapi-known-servers";

export type BrokerConnectConfig = {
  server: string;
  platform: "mt4" | "mt5";
  keywords: string[];
  hint?: string;
};

/** FXCess = MT4 uniquement (pas MT5). Détecte broker + serveur (FXCESS-*). */
export function isFxcessConnectContext(
  brokerName?: string | null,
  server?: string | null,
): boolean {
  const blob = `${brokerName ?? ""} ${server ?? ""}`.toLowerCase();
  if (/fxcess|fxness|mfx\s*capital/i.test(blob)) return true;
  const s = (server ?? "").trim();
  return /^fxcess[-_]/i.test(s);
}

/** Alias serveurs connus incorrects → nom MT exact. */
const SERVER_CANONICAL: Record<string, string> = {
  "fxcess-demo": "FXcess-Demo",
  fxcessdemo: "FXcess-Demo",
  "fxcess-demo01": "FXcess-Demo1",
  fxcessdemo01: "FXcess-Demo1",
  "fxcess-demo1": "FXcess-Demo1",
  fxcessdemo1: "FXcess-Demo1",
  "fxcess-live": "FXcess-Live",
  fxcesslive: "FXcess-Live",
  "fxcess-live01": "FXcess-Live",
  fxcesslive01: "FXcess-Live",
  "vantagemarkets-demo": "VantageInternational-Demo",
  vantagemarketsdemo: "VantageInternational-Demo",
};

function compactKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]+/g, "");
}

export function canonicalConnectServer(
  rawServer: string,
  brokerName?: string | null,
): string {
  let s = resolveServerName(rawServer.trim());
  const key = compactKey(s);
  if (SERVER_CANONICAL[key]) {
    s = SERVER_CANONICAL[key];
  }

  return s;
}

export function resolveBrokerConnectConfig(
  rawServer: string,
  brokerName?: string | null,
): BrokerConnectConfig {
  const server = canonicalConnectServer(rawServer, brokerName);
  const broker = brokerName ? findBrokerByName(brokerName) : undefined;
  const fxcess = isFxcessConnectContext(brokerName, server);
  const blob = `${server} ${brokerName ?? ""}`.toLowerCase();

  let platform: "mt4" | "mt5" = broker?.platform ?? "mt5";
  if (fxcess) platform = "mt4";

  const keywords: string[] = [];

  if (fxcess) {
    return {
      server,
      platform: "mt4",
      keywords: [],
      hint:
        "FXCess = MT4 uniquement. Demo : FXcess-Demo ou FXcess-Demo1 (copie exacte depuis MT4).",
    };
  }

  if (/vantage/i.test(blob)) {
    keywords.push(
      "Vantage",
      "Vantage Markets",
      "Vantage International",
      "VantageGlobal",
      "Vantage FX",
    );
    let hint: string | undefined;
    if (/vantagemarkets-demo/i.test(compactKey(server))) {
      hint =
        "Si VantageMarkets-Demo échoue, essayez VantageInternational-Demo (nom exact dans MT5 → Fichier → Ouvrir un compte).";
    }
    return { server, platform: "mt5", keywords, hint };
  }

  if (/vtmarket/i.test(blob)) {
    keywords.push("VT Markets", "VTMarkets", "Vantage");
  }

  if (/^axi/i.test(blob)) {
    keywords.push("Axi", "AxiTrader");
  }

  if (/raise/i.test(blob)) {
    keywords.push("Raise FX", "RaiseGlobal", "Raise Group");
  }

  return { server, platform, keywords };
}

export type ConnectAttempt = {
  server: string;
  platform: "mt4" | "mt5";
  keywords: string[];
};

export async function buildConnectAttempts(
  rawServer: string,
  brokerName: string | null | undefined,
  token: string,
): Promise<ConnectAttempt[]> {
  const cfg = resolveBrokerConnectConfig(rawServer, brokerName);
  const attempts: ConnectAttempt[] = [];
  const seen = new Set<string>();

  const push = (server: string, keywords: string[], platform = cfg.platform) => {
    const s = server.trim();
    if (!s) return;
    const key = s.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    attempts.push({
      server: s,
      platform,
      keywords: keywords.length > 0 ? keywords : cfg.keywords,
    });
  };

  const blob = `${rawServer} ${brokerName ?? ""} ${cfg.server}`.toLowerCase();
  const fxcess = isFxcessConnectContext(brokerName, `${rawServer} ${cfg.server}`);

  if (/vantage/i.test(blob)) {
    const known = await searchVantageKnownServers(token, cfg.platform);
    const matched =
      matchKnownServer(rawServer, known) ??
      matchKnownServer(cfg.server, known);

    if (matched) {
      push(matched.server, matched.keywords);
    }

    push(cfg.server, cfg.keywords);

    for (const fb of vantageConnectFallbacks(rawServer)) {
      const m = matchKnownServer(fb, known);
      push(m?.server ?? fb, m?.keywords ?? cfg.keywords);
    }

    return attempts;
  }

  if (fxcess) {
    push(cfg.server, cfg.keywords, "mt4");

    const explicitServer = /fxcess[-_]/i.test(cfg.server);
    if (!explicitServer) {
      const known = await searchFxcessKnownServers(token);
      const matched =
        matchKnownServer(rawServer, known) ??
        matchKnownServer(cfg.server, known);

      if (matched) push(matched.server, matched.keywords, "mt4");

      for (const fb of fxcessConnectFallbacks(rawServer)) {
        const m = matchKnownServer(fb, known);
        push(m?.server ?? fb, m?.keywords ?? cfg.keywords, "mt4");
      }
    }

    return attempts;
  }

  push(cfg.server, cfg.keywords);
  return attempts;
}
