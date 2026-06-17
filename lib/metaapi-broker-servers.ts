/**
 * Source unique pour les listes broker + serveurs (UI + /api/metaapi/servers + /api/metaapi/brokers).
 * Le nom du serveur doit correspondre exactement à MT5 / MetaAPI.
 */
import { resolveServerName } from "@/lib/server-aliases";
import { VANTAGE_MT5_SERVERS } from "@/lib/vantage-servers";

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
      "FXCESS-Demo01",
      "FXCESS-Demo02",
      "FXCESS-Live01",
      "FXCESS-Live02",
      "FXcess-Demo",
      "FXcess-Live",
      "FXcess-Live01",
      "FXcess-Live02",
      "FXcess-Live03",
      "FXcess-Real",
      "FXcess-Real01",
      "FXcess-Real02",
      "FXcess-Real03",
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
    servers: uniqServers([...VANTAGE_MT5_SERVERS]),
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
