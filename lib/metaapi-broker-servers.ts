/**
 * Source unique pour les listes broker + serveurs (UI + /api/metaapi/servers + /api/metaapi/brokers).
 * Le nom du serveur doit correspondre exactement à MT5 / MetaAPI.
 */
import { resolveServerName } from "@/lib/server-aliases";

export type BrokerServersEntry = {
  name: string;
  servers: string[];
  /** MT4 uniquement pour certains brokers (ex. FXCess). */
  platform?: "mt5" | "mt4";
};

function uniqServers(servers: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of servers) {
    const t = resolveServerName(s.trim());
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function buildNumberedLive(prefix: string, numbers: number[]): string[] {
  const list: string[] = [];
  for (const n of numbers) {
    list.push(`${prefix}-Live ${n}`, `${prefix}-Live${n}`);
  }
  return list;
}

function buildVtMarketsServers(): string[] {
  const list: string[] = [];
  const prefixes = ["VTMarkets", "VT Markets"] as const;

  for (const p of prefixes) {
    list.push(`${p}-Live`, `${p}-Demo`, "Démo de VTMarkets");
    for (let i = 1; i <= 25; i++) {
      list.push(`${p}-Live ${i}`, `${p}-Live${i}`);
    }
    for (let i = 1; i <= 9; i++) {
      list.push(`${p}-Live0${i}`);
    }
    list.push(`${p}-Real`, `${p}-Real01`, `${p}-Real02`, `${p}-Real03`);
  }

  return uniqServers(list);
}

function buildVantageMarketsServers(): string[] {
  const prefix = "VantageMarkets";
  return uniqServers([
    `${prefix}-Demo`,
    `${prefix}-Live`,
    ...buildNumberedLive(prefix, [3, 4, 5, 6, 7, 8, 10, 11, 13, 14, 15, 19, 21]),
  ]);
}

function buildVantageInternationalServers(): string[] {
  const prefix = "VantageInternational";
  return uniqServers([
    `${prefix}-Demo`,
    `${prefix}-Live`,
    ...buildNumberedLive(prefix, [
      3, 4, 5, 6, 7, 8, 10, 11, 13, 14, 15, 19, 21,
    ]),
    "VantageInternational-Live 1",
    "VantageInternational-Live 2",
    "VantageInternational-Live 9",
    "VantageInternational-Live 12",
    "VantageInternational-Live 16",
    "VantageInternational-Live 18",
  ]);
}

function buildAxiServers(): string[] {
  return uniqServers([
    "Axi-US52-Live",
    "Axi-US51-Live",
    "Axi-US88-Live",
    "Axi-US50-Demo",
    "Axi-US50-Live",
    "Axi-UK55-Live",
    "Axi-US03-Live",
    "Axi-US05-Live",
    "Axi-US06-Live",
    "Axi-US09-Live",
    "Axi-US16-Live",
    "Axi-US18-Live",
    "Axi-Live",
    "Axi-Demo",
    "Axi-Live01",
    "Axi-Live02",
    "Axi-Live03",
    "Axi-Real",
    "Axi-Real01",
    "Axi-Real02",
    "Axi-Real03",
    "Axi-MT5-Live",
    "Axi-MT5-Demo",
    "Axi-MT5-Real",
    "Axi-MT5-Real01",
    "Axi-MT5-Real02",
    "AxiTrader-Live",
    "AxiTrader-Demo",
    "AxiTrader-Real",
    "AxiTrader-Real01",
    "AxiTrader-Real02",
  ]);
}

export const METAAPI_BROKER_SERVERS: BrokerServersEntry[] = [
  {
    name: "VT Markets",
    servers: buildVtMarketsServers(),
    platform: "mt5",
  },
  {
    name: "Raise FX",
    servers: uniqServers([
      "RaiseGroup-Server",
      "RaiseFX-Live",
      "RaiseFX-Demo",
      "RaiseGlobal-Live",
      "RaiseGlobalSA-LIVE",
      "RaiseFX-Live01",
      "RaiseFX-Live02",
      "RaiseFX-Live03",
      "RaiseFX-Real",
      "RaiseFX-Real01",
      "RaiseFX-Real02",
      "RaiseFX-Real03",
      "RaiseFX-MT5-Live",
      "RaiseFX-MT5-Demo",
      "RaiseFX-MT5-Real",
      "RaiseFX-MT5-Real01",
      "RaiseFX-MT5-Real02",
    ]),
    platform: "mt5",
  },
  {
    name: "Raise Global",
    servers: uniqServers([
      "RaiseGroup-Server",
      "RaiseGlobal-Live",
      "RaiseGlobalSA-LIVE",
      "RaiseGlobal-Demo",
      "RaiseGlobal-Live01",
      "RaiseGlobal-Live02",
      "RaiseGlobal-Live03",
      "RaiseGlobal-Real",
      "RaiseGlobal-Real01",
      "RaiseGlobal-Real02",
      "RaiseGlobal-Real03",
      "RaiseGlobal-MT5-Live",
      "RaiseGlobal-MT5-Demo",
      "RaiseGlobal-MT5-Real",
      "RaiseGlobal-MT5-Real01",
      "RaiseGlobal-MT5-Real02",
    ]),
    platform: "mt5",
  },
  {
    name: "FXcess",
    servers: uniqServers([
      "FXCESS-Live01",
      "FXcess-Live",
      "FXcess-Demo",
      "FXcess-Live01",
      "FXcess-Live02",
      "FXcess-Live03",
      "FXcess-Real",
      "FXcess-Real01",
      "FXcess-Real02",
      "FXcess-Real03",
      "FXcess-MT5-Live",
      "FXcess-MT5-Demo",
      "FXcess-MT5-Real",
      "FXcess-MT5-Real01",
      "FXcess-MT5-Real02",
    ]),
    platform: "mt4",
  },
  {
    name: "Axi",
    servers: buildAxiServers(),
    platform: "mt5",
  },
  {
    name: "Vantage",
    servers: uniqServers([
      "VantageFX-Live",
      "VantageFX-Demo",
      "VantageFXInternational-Live",
      ...buildVantageInternationalServers(),
      ...buildVantageMarketsServers(),
      "VantageGlobalPrimeLLP-Live",
      "VantageGlobalPrimeLLP-Live 2",
      "VantageGlobalPrimeAU-Live",
      "VantagePrimeLimited-Live",
      "VantagePrimeLimited-Demo",
    ]),
    platform: "mt5",
  },
];

const SLUG: Record<string, string> = {
  "VT Markets": "vtmarkets",
  "Raise FX": "raisefx",
  "Raise Global": "raiseglobal",
  FXcess: "fxcess",
  Axi: "axi",
  Vantage: "vantage",
};

export function getStaticBrokersWithServers() {
  return METAAPI_BROKER_SERVERS.map((b) => ({
    id: SLUG[b.name] ?? b.name.toLowerCase().replace(/\s+/g, "-"),
    name: b.name,
    servers: b.servers,
    platform: b.platform ?? "mt5",
  }));
}

export function findBrokerByName(
  brokerName: string,
): BrokerServersEntry | undefined {
  const q = brokerName.toLowerCase();
  return METAAPI_BROKER_SERVERS.find(
    (b) =>
      b.name.toLowerCase().includes(q) || q.includes(b.name.toLowerCase()),
  );
}
