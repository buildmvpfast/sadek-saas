import { NextResponse } from "next/server";

// Cache simple en mémoire (5 minutes)
let brokersCache: any = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  try {
    // Vérifier le cache
    const now = Date.now();
    if (brokersCache && now - cacheTimestamp < CACHE_DURATION) {
      return NextResponse.json({
        ...brokersCache,
        cached: true,
      });
    }

    // Pour l'instant, on utilise les brokers statiques
    // TODO: Implémenter l'intégration MetaApi quand l'API sera clarifiée
    const brokers = getStaticBrokers();

    const result = {
      success: true,
      brokers,
      total: brokers.length,
      source: "static",
    };

    // Mettre en cache
    brokersCache = result;
    cacheTimestamp = now;

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error fetching brokers:", error);
    return NextResponse.json(
      {
        success: true,
        brokers: getStaticBrokers(),
        total: getStaticBrokers().length,
        source: "static",
      },
      { status: 200 }
    );
  }
}

function extractBrokerName(profileName: string): string | null {
  // Extraire le nom du broker depuis le nom du profil
  const brokerKeywords = [
    "VT Markets",
    "Raise FX",
    "Raise Global",
    "Raise Globale",
    "FXcess",
    "Axi",
    "AxiTrader",
  ];

  for (const keyword of brokerKeywords) {
    if (profileName.toLowerCase().includes(keyword.toLowerCase())) {
      return keyword;
    }
  }

  return null;
}

function getStaticBrokers() {
  return [
    {
      id: "vtmarkets",
      name: "VT Markets",
      servers: [
        "VT Markets-Live",
        "VT Markets-Demo",
        "VT Markets-Live01",
        "VT Markets-Live02",
        "VT Markets-Real",
        "VT Markets-Real01",
        "VT Markets-Real02",
      ],
    },
    {
      id: "raisefx",
      name: "Raise FX",
      servers: [
        "RaiseFX-Live",
        "RaiseFX-Demo",
        "RaiseFX-Live01",
        "RaiseFX-Live02",
        "RaiseFX-Real",
        "RaiseFX-Real01",
        "RaiseFX-Real02",
        "RaiseFX-MT5-Live",
        "RaiseFX-MT5-Demo",
      ],
    },
    {
      id: "raiseglobal",
      name: "Raise Global",
      servers: [
        "RaiseGlobal-Live",
        "RaiseGlobal-Demo",
        "RaiseGlobal-Live01",
        "RaiseGlobal-Live02",
        "RaiseGlobal-Real",
        "RaiseGlobal-Real01",
        "RaiseGlobal-Real02",
      ],
    },
    {
      id: "fxcess",
      name: "FXcess",
      servers: [
        "FXcess-Live",
        "FXcess-Demo",
        "FXcess-Live01",
        "FXcess-Live02",
        "FXcess-Real",
        "FXcess-Real01",
        "FXcess-Real02",
        "FXcess-MT5-Live",
        "FXcess-MT5-Demo",
      ],
    },
    {
      id: "axi",
      name: "Axi",
      servers: [
        "Axi-Live",
        "Axi-Demo",
        "Axi-Live01",
        "Axi-Live02",
        "Axi-Real",
        "Axi-Real01",
        "Axi-Real02",
        "Axi-MT5-Live",
        "Axi-MT5-Demo",
        "AxiTrader-Live",
        "AxiTrader-Demo",
      ],
    },
  ];
}

// Ancienne version avec MetaApi SDK (garde pour référence)
/*
export async function GET() {
  try {
    const metaApi = new MetaApi(process.env.METAAPI_TOKEN!)
    
    // Récupérer les provisions (infos sur les brokers disponibles)
    const provisioningProfileApi = metaApi.provisioningProfileApi
    const profiles = await provisioningProfileApi.getProvisioningProfiles()

*/
