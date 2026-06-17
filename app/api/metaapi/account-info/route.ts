import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { fetchMetaApiAccountInfo } from "@/lib/metaapi-trade-client";
import { fetchProvisioningAccount } from "@/lib/metaapi-provisioning";

export async function GET(request: NextRequest) {
  // Verify authenticated user and ownership
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = request.nextUrl.searchParams.get("accountId");

  // Verify ownership before hitting MetaAPI
  if (accountId) {
    const { data: mt5Account } = await supabase
      .from("mt5_accounts")
      .select("id")
      .eq("metaapi_account_id", accountId)
      .eq("user_id", user.id)
      .single();
    if (!mt5Account) {
      return NextResponse.json({ error: "Compte non trouvé" }, { status: 403 });
    }
  }

  try {
    if (!accountId) {
      return NextResponse.json({ error: "accountId requis" }, { status: 400 });
    }

    const token = process.env.METAAPI_TOKEN;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: "Token MetaApi manquant",
        },
        { status: 200 }
      );
    }

    const accountData = await fetchProvisioningAccount(accountId, token);

    if (!accountData) {
      return NextResponse.json(
        {
          success: false,
          error: "Compte MetaAPI non trouvé ou non accessible",
          accountId,
        },
        { status: 200 },
      );
    }

    // Vérifier que le compte est déployé et connecté
    if (
      accountData.state !== "DEPLOYED" ||
      accountData.connectionStatus !== "CONNECTED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Compte en cours de connexion... (État: ${accountData.state}, Connexion: ${accountData.connectionStatus})`,
          accountId,
          state: accountData.state,
          connectionStatus: accountData.connectionStatus,
        },
        { status: 200 },
      );
    }

    const accountInfo = await fetchMetaApiAccountInfo(accountId, token);

    if (!accountInfo) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Impossible de lire le compte (essayez dans quelques secondes). MT4/MT5 : vérifiez la région MetaAPI.",
          accountId,
        },
        { status: 200 },
      );
    }

    const profit =
      (Number(accountInfo.equity) || 0) - (Number(accountInfo.balance) || 0);

    return NextResponse.json({
      success: true,
      accountInfo: {
        balance: Number(accountInfo.balance) || 0,
        equity: Number(accountInfo.equity) || 0,
        margin: Number(accountInfo.margin) || 0,
        freeMargin: Number(accountInfo.freeMargin) || 0,
        marginLevel: Number(accountInfo.marginLevel) || 0,
        currency: String(accountInfo.currency || "USD"),
        profit,
        server: String(accountInfo.server || ""),
        leverage: Number(accountInfo.leverage) || 0,
      },
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    const errCode = (error as { code?: string })?.code;
    console.error("Error fetching account info:", {
      accountId: accountId || "unknown",
      error: err.message,
      code: errCode,
    });

    if (
      errCode === "CERT_HAS_EXPIRED" ||
      err.message.includes("certificate")
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Erreur de connexion MetaAPI (certificat). Réessayez dans quelques instants.",
          accountId: accountId || null,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          err.message ||
          "Erreur lors de la récupération des informations du compte",
        accountId: accountId || null,
      },
      { status: 200 }
    ); // Retourner 200 pour ne pas casser l'UI
  }
}
