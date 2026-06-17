import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  linkMetaApiAccountById,
  syncOrphanMetaApiAccount,
} from "@/lib/mt5-account-persist";

/**
 * Récupère un compte MetaAPI non enregistré dans Supabase (souvent après 504).
 * FXcess MT4 : accepte DEPLOYED + DISCONNECTED (connexion broker en cours).
 */
export async function POST(request: NextRequest) {
  const supabaseAuth = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.METAAPI_TOKEN || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { success: false, error: "Configuration serveur incomplète" },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    login?: string;
    server?: string;
    broker_name?: string;
    metaapi_account_id?: string;
  };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const token = process.env.METAAPI_TOKEN;

  if (body.metaapi_account_id) {
    const linked = await linkMetaApiAccountById(
      supabase,
      user.id,
      token,
      body.metaapi_account_id,
      {
        brokerName: body.broker_name,
        server: body.server,
        login: body.login,
      },
    );
    if (!linked.ok) {
      return NextResponse.json({ success: false, error: linked.error });
    }
    return NextResponse.json({ success: true, synced: true });
  }

  const result = await syncOrphanMetaApiAccount(supabase, user.id, token, {
    login: body.login,
    server: body.server,
    brokerName: body.broker_name,
  });

  if (!result.synced) {
    return NextResponse.json({
      success: false,
      error: result.error || "Aucun compte à récupérer",
    });
  }

  return NextResponse.json({
    success: true,
    synced: true,
    accountId: result.accountId,
  });
}
