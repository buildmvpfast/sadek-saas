import { NextResponse } from "next/server";
import {
  findBrokerByName,
  METAAPI_BROKER_SERVERS,
} from "@/lib/metaapi-broker-servers";
import {
  canonicalServerOrResolved,
  filterServers,
  resolveServerName,
} from "@/lib/server-aliases";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brokerName = searchParams.get("broker");
    const search = searchParams.get("search")?.trim() ?? "";
    const resolve = searchParams.get("resolve")?.trim() ?? "";

    if (resolve) {
      const broker = brokerName ? findBrokerByName(brokerName) : undefined;
      const known = broker?.servers ?? [];
      return NextResponse.json({
        success: true,
        input: resolve,
        resolved: canonicalServerOrResolved(resolve, known),
      });
    }

    if (!brokerName) {
      return NextResponse.json(
        { success: false, error: "Broker name required" },
        { status: 400 },
      );
    }

    const broker = findBrokerByName(brokerName);

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

    let serverNames = broker.servers;
    if (search) {
      serverNames = filterServers(search, serverNames);
    }

    const servers = serverNames.map((server) => ({
      name: server.trim(),
      type:
        server.includes("Demo") || server.includes("demo") ? "demo" : "live",
      canonical: resolveServerName(server),
    }));

    return NextResponse.json({
      success: true,
      broker: broker.name,
      platform: broker.platform ?? "mt5",
      servers,
      total: servers.length,
      source: "static",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching servers:", error);
    return NextResponse.json(
      { success: false, error: message, servers: [] },
      { status: 500 },
    );
  }
}

/** Export pour tests — liste complète brokers. */
export { METAAPI_BROKER_SERVERS };
