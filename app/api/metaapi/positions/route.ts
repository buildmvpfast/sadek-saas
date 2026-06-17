import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { fetchMetaApiPositionsJson } from "@/lib/metaapi-trade-client";
import { normalizeMetaApiPositions } from "@/lib/metaapi-positions";

export async function GET(request: NextRequest) {
  // Verify authenticated user and ownership of the account
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const accountId = request.nextUrl.searchParams.get('accountId')

    if (!accountId) {
      return NextResponse.json({ error: 'accountId requis' }, { status: 400 })
    }

    // Verify the user owns this MetaAPI account
    const { data: mt5Account } = await supabase
      .from('mt5_accounts')
      .select('id')
      .eq('metaapi_account_id', accountId)
      .eq('user_id', user.id)
      .single();

    if (!mt5Account) {
      return NextResponse.json({ error: 'Compte non trouvé' }, { status: 403 });
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
          error: 'Erreur MetaAPI',
          positions: [],
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      positions: normalizeMetaApiPositions(result.positions as unknown[]),
      source: result.url,
      live: true,
    });
  } catch (error: any) {
    console.error('Error fetching positions:', error)
    return NextResponse.json({ success: false, error: 'Internal server error', positions: [] }, { status: 500 })
  }
}

