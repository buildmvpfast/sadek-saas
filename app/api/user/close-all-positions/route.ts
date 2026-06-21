import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import {
  fetchMetaApiPositionsJson,
  postMetaApiClosePosition,
  parseMetaApiOpenPositions,
} from "@/lib/metaapi-trade-client";

/**
 * Ferme toutes les positions MetaAPI ouvertes sur les comptes MT4/MT5 de l'utilisateur connecté.
 */
export async function POST() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.METAAPI_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "MetaAPI non configuré" },
      { status: 500 },
    );
  }

  const { data: accounts, error: accErr } = await supabase
    .from("mt5_accounts")
    .select("id, broker_name, metaapi_account_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .not("metaapi_account_id", "is", null);

  if (accErr) {
    return NextResponse.json({ error: accErr.message }, { status: 500 });
  }

  if (!accounts?.length) {
    return NextResponse.json({
      success: true,
      closed: 0,
      total: 0,
      accounts: 0,
      message: "Aucun compte MT4/MT5 connecté",
    });
  }

  let closed = 0;
  let total = 0;
  const errors: string[] = [];

  for (const account of accounts) {
    const metaApiAccountId = account.metaapi_account_id as string;
    const label = account.broker_name || metaApiAccountId;

    const posRes = await fetchMetaApiPositionsJson(metaApiAccountId, token);
    if (!posRes.ok) {
      errors.push(`${label}: ${posRes.error}`);
      continue;
    }

    const positions = parseMetaApiOpenPositions(posRes.positions);
    total += positions.length;

    for (const pos of positions) {
      const result = await postMetaApiClosePosition(
        metaApiAccountId,
        pos.id,
        token,
      );
      if (result.ok) {
        closed++;
      } else {
        errors.push(`${label} #${pos.id} (${pos.symbol}): ${result.error}`);
      }
    }
  }

  return NextResponse.json({
    success: true,
    closed,
    total,
    accounts: accounts.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
