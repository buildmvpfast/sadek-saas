import { NextResponse } from "next/server";

// Liste de fallback si MetaAPI ne répond pas
const BROKERS_DATA = [
  {
    name: "VT Markets",
    servers: [
      "VTMarkets-Live",
      "VTMarkets-Live 2",
      "VTMarkets-Live 3",
      "VTMarkets-Live 4",
      "VTMarkets-Demo",
    ],
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
    servers: [
      "RaiseGlobal-Live",
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
    ],
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
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brokerName = searchParams.get("broker");

    if (!brokerName) {
      return NextResponse.json(
        { success: false, error: "Broker name required" },
        { status: 400 }
      );
    }

    // Essayer d'abord avec MetaAPI
    if (process.env.METAAPI_TOKEN) {
      try {
        // MetaAPI n'a pas d'API directe pour lister les serveurs d'un broker
        // Mais on peut essayer de récupérer les serveurs depuis les comptes existants
        // ou utiliser l'API de provisioning profiles
        // Pour l'instant, on utilise la liste statique comme fallback
        // MetaAPI ne fournit pas directement la liste des serveurs par broker
        // Il faut les connaître à l'avance ou les récupérer depuis les comptes connectés
      } catch (metaApiError) {
        console.warn("MetaAPI error, using static list:", metaApiError);
      }
    }

    // Utiliser la liste statique (fallback)
    const broker = BROKERS_DATA.find(
      (b) =>
        b.name.toLowerCase().includes(brokerName.toLowerCase()) ||
        brokerName.toLowerCase().includes(b.name.toLowerCase())
    );

    if (!broker) {
      return NextResponse.json({
        success: true,
        broker: brokerName,
        servers: [],
        source: "static",
        message:
          "Broker non trouvé dans la liste. Utilisez la saisie manuelle.",
      });
    }

    // Formater les serveurs
    const servers = broker.servers.map((server) => ({
      name: server,
      type:
        server.includes("Demo") || server.includes("demo") ? "demo" : "live",
    }));

    return NextResponse.json({
      success: true,
      broker: broker.name,
      servers,
      source: "static",
    });
  } catch (error: any) {
    console.error("Error fetching servers:", error);
    return NextResponse.json(
      { success: false, error: error.message, servers: [] },
      { status: 500 }
    );
  }
}
