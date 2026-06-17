import { NextResponse } from "next/server";
import { findBrokerByName } from "@/lib/metaapi-broker-servers";
import {
  listKnownServerNames,
  searchVantageKnownServers,
} from "@/lib/metaapi-known-servers";
import {
  canonicalServerOrResolved,
  filterServers,
  resolveServerName,
} from "@/lib/server-aliases";

function sortServersDemoFirst(names: string[]): string[] {
  return [...names].sort((a, b) => {
    const aDemo = /demo/i.test(a) ? 0 : 1;
    const bDemo = /demo/i.test(b) ? 0 : 1;
    if (aDemo !== bDemo) return aDemo - bDemo;
    return a.localeCompare(b);
  });
}

async function mergeVantageServers(staticServers: string[]): Promise<{
  servers: string[];
  source: string;
}> {
  const token = process.env.METAAPI_TOKEN;
  if (!token) {
    return { servers: sortServersDemoFirst(staticServers), source: "static" };
  }

  try {
    const known = await searchVantageKnownServers(token, "mt5");
    const fromApi = listKnownServerNames(known);
    const merged = sortServersDemoFirst([
      ...fromApi,
      ...staticServers,
    ]);
    const uniq = Array.from(
      new Set(merged.map((s) => s.trim()).filter(Boolean)),
    );
    return {
      servers: uniq,
      source: fromApi.length > 0 ? "metaapi+static" : "static",
    };
  } catch {
    return { servers: sortServersDemoFirst(staticServers), source: "static" };
  }
}

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
    let source = "static";

    if (/vantage/i.test(broker.name)) {
      const merged = await mergeVantageServers(broker.servers);
      serverNames = merged.servers;
      source = merged.source;
    } else {
      serverNames = sortServersDemoFirst(serverNames);
    }

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
      source,
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
