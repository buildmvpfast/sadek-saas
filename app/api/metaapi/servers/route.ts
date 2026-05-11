import { NextResponse } from "next/server";
import { METAAPI_BROKER_SERVERS } from "@/lib/metaapi-broker-servers";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brokerName = searchParams.get("broker");

    if (!brokerName) {
      return NextResponse.json(
        { success: false, error: "Broker name required" },
        { status: 400 },
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
    const broker = METAAPI_BROKER_SERVERS.find(
      (b) =>
        b.name.toLowerCase().includes(brokerName.toLowerCase()) ||
        brokerName.toLowerCase().includes(b.name.toLowerCase()),
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
      name: server.trim(),
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
      { status: 500 },
    );
  }
}
