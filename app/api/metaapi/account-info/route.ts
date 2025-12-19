import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get("accountId");

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

    // Vérifier d'abord l'état du compte
    const accountResponse = await fetch(
      `https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${accountId}`,
      {
        headers: {
          "auth-token": token,
        },
      }
    );

    if (!accountResponse.ok) {
      const errorText = await accountResponse.text();
      console.error("MetaAPI account check error:", {
        status: accountResponse.status,
        accountId,
        error: errorText,
      });

      return NextResponse.json(
        {
          success: false,
          error: "Compte MetaAPI non trouvé ou non accessible",
          accountId,
        },
        { status: 200 }
      );
    }

    const accountData = await accountResponse.json();

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
        { status: 200 }
      );
    }

    // Utiliser l'API REST de MetaAPI (compatible avec Node.js, pas besoin de window)
    const response = await fetch(
      `https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${accountId}/account-information`,
      {
        headers: {
          "auth-token": token,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText || "Unknown error" };
      }

      console.error("MetaAPI REST API error:", {
        status: response.status,
        accountId,
        error: errorData,
      });

      // Si le compte n'est pas encore déployé ou connecté
      if (response.status === 404 || response.status === 400) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Compte MetaAPI non trouvé ou non déployé. Le compte peut prendre quelques minutes pour se connecter.",
            accountId,
            status: response.status,
          },
          { status: 200 }
        ); // Retourner 200 pour ne pas casser l'UI
      }

      return NextResponse.json(
        {
          success: false,
          error:
            errorData.message ||
            errorData.error ||
            `Erreur MetaAPI: ${response.status}`,
          accountId,
          status: response.status,
        },
        { status: 200 }
      ); // Retourner 200 pour ne pas casser l'UI
    }

    const accountInfo = await response.json();

    // Calculer le profit comme equity - balance
    const profit = (accountInfo.equity || 0) - (accountInfo.balance || 0);

    return NextResponse.json({
      success: true,
      accountInfo: {
        balance: accountInfo.balance || 0,
        equity: accountInfo.equity || 0,
        margin: accountInfo.margin || 0,
        freeMargin: accountInfo.freeMargin || 0,
        marginLevel: accountInfo.marginLevel || 0,
        currency: accountInfo.currency || "USD",
        profit: profit,
        server: accountInfo.server || "",
        leverage: accountInfo.leverage || 0,
      },
    });
  } catch (error: any) {
    console.error("Error fetching account info:", {
      accountId: accountId || "unknown",
      error: error.message,
      code: error.code,
      stack: error.stack,
    });

    // Gérer les erreurs de certificat SSL
    if (
      error.code === "CERT_HAS_EXPIRED" ||
      error.message?.includes("certificate")
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
          error.message ||
          "Erreur lors de la récupération des informations du compte",
        accountId: accountId || null,
      },
      { status: 200 }
    ); // Retourner 200 pour ne pas casser l'UI
  }
}
