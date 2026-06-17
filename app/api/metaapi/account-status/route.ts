import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { fetchProvisioningAccount } from "@/lib/metaapi-provisioning";

const METAAPI_PROVISIONING_ACCOUNTS_URL =
  "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts";

/** État connexion MetaAPI (FXcess MT4 — polling côté client). */
export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = request.nextUrl.searchParams.get("accountId");
  if (!accountId) {
    return NextResponse.json({ error: "accountId requis" }, { status: 400 });
  }

  const { data: row } = await supabase
    .from("mt5_accounts")
    .select("id, broker_name")
    .eq("metaapi_account_id", accountId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: "Compte non trouvé" }, { status: 403 });
  }

  const token = process.env.METAAPI_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "METAAPI_TOKEN manquant" }, { status: 500 });
  }

  let acc = await fetchProvisioningAccount(accountId, token);

  if (
    acc &&
    String(acc.state) === "DEPLOYED" &&
    String(acc.connectionStatus) !== "CONNECTED"
  ) {
    await fetch(`${METAAPI_PROVISIONING_ACCOUNTS_URL}/${accountId}/deploy`, {
      method: "POST",
      headers: { "auth-token": token },
    }).catch(() => null);
    await new Promise((r) => setTimeout(r, 3000));
    acc = await fetchProvisioningAccount(accountId, token);
  }

  if (!acc) {
    return NextResponse.json({ success: false, error: "MetaAPI introuvable" });
  }

  return NextResponse.json({
    success: true,
    state: acc.state,
    connectionStatus: acc.connectionStatus,
    platform: acc.platform,
    server: acc.server,
    connected:
      String(acc.state) === "DEPLOYED" &&
      String(acc.connectionStatus) === "CONNECTED",
  });
}
