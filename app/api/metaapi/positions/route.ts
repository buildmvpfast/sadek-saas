import { NextRequest, NextResponse } from "next/server";
import { fetchMetaApiPositionsJson } from "@/lib/metaapi-trade-client";

export async function GET(request: NextRequest) {
  try {
    const accountId = request.nextUrl.searchParams.get('accountId')

    if (!accountId) {
      return NextResponse.json({ error: 'accountId requis' }, { status: 400 })
    }

    const token = process.env.METAAPI_TOKEN

    if (!token) {
      return NextResponse.json({ error: 'Token MetaApi manquant' }, { status: 500 })
    }

    // Validate that accountId looks like a MetaApi UUID, not an MT5 login number
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(accountId)) {
      return NextResponse.json(
        {
          success: false,
          error: `"${accountId}" n'est pas un ID MetaApi valide. Le compte MT5 doit être reconecté via la plateforme.`,
          positions: [],
        },
        { status: 400 }
      )
    }

    const result = await fetchMetaApiPositionsJson(accountId, token);

    if (!result.ok) {
      console.error("MetaApi positions error:", result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          positions: [],
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      positions: result.positions || [],
      source: result.url,
    });
  } catch (error: any) {
    console.error('Error fetching positions:', error)
    return NextResponse.json({ success: false, error: error.message, positions: [] }, { status: 500 })
  }
}

