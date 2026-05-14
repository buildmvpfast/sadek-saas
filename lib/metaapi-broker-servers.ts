/**
 * Source unique pour les listes broker + serveurs (UI + /api/metaapi/servers + /api/metaapi/brokers).
 * Le nom du serveur doit correspondre exactement à MT5 / MetaAPI.
 */
export type BrokerServersEntry = { name: string; servers: string[] };

function uniqServers(servers: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of servers) {
    const t = s.trim().replace(/\s+/g, " ");
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export const METAAPI_BROKER_SERVERS: BrokerServersEntry[] = [
  {
    name: "VT Markets",
    servers: uniqServers([
      // Variantes « VT Markets » et « VTMarkets » (selon broker / région)
      "VT Markets-Live",
      "VT Markets-Demo",
      "VTMarkets-Demo",
      "VTMarkets-Live 2",
      "VTMarkets-Live 3",
      "VTMarkets-Live 4",
      "VTMarkets-Live 5",
      "VTMarkets-Live 6",
      "VTMarkets-Live7",
      "VT Markets-Live01",
      "VT Markets-Live02",
      "VT Markets-Real",
      "VT Markets-Real01",
      "VT Markets-Real02",
    ]),
  },
  {
    name: "Raise FX",
    servers: [
      "RaiseFX-Live",
      "RaiseFX-Demo",
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
    ],
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
  },
  {
    name: "FXcess",
    servers: [
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
    ],
  },
  {
    name: "Axi",
    servers: [
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
    ],
  },
  {
    name: "Vantage",
    servers: uniqServers([
      "VantageFX-Live",
      "VantageFX-Demo",
      "VantageFXInternational-Live",
      "VantageInternational-Demo",
      "VantageInternational-Live",
      "VantageGlobalPrimeLLP-Live",
      "VantageGlobalPrimeLLP-Live 2",
      "VantagePrimeLimited-Live",
      "VantageInternational-Live 3",
      "VantageInternational-Live 4",
      "VantageInternational-Live 5",
      "VantageInternational-Live 6",
      "VantageInternational-Live 7",
      "VantageInternational-Live 8",
      "VantagePrimeLimited-Demo",
      "VantageInternational-Live 10",
      "VantageInternational-Live 11",
      "VantageInternational-Live 13",
      "VantageGlobalPrimeAU-Live",
      "VantageInternational-Live 14",
      "VantageInternational-Live 15",
      "VantageInternational-Live 19",
      "VantageInternational-Live21",
      "VantageInternational-Live 21",
      // Autres nœuds souvent listés par MetaAPI / anciens presets
      "VantageInternational-Live 1",
      "VantageInternational-Live 2",
      "VantageInternational-Live 9",
      "VantageInternational-Live 12",
      "VantageInternational-Live 16",
      "VantageInternational-Live 18",
    ]),
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
  }));
}
