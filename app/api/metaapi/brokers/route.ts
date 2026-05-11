import { NextResponse } from "next/server";
import { getStaticBrokersWithServers } from "@/lib/metaapi-broker-servers";

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
    const brokers = getStaticBrokersWithServers();

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
        brokers: getStaticBrokersWithServers(),
        total: getStaticBrokersWithServers().length,
        source: "static",
      },
      { status: 200 },
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
    // Matches "Vantage International", "VantageMarkets-...", etc. (must stay one token)
    "Vantage",
  ];

  for (const keyword of brokerKeywords) {
    if (profileName.toLowerCase().includes(keyword.toLowerCase())) {
      return keyword;
    }
  }

  return null;
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
