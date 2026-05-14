import { NextResponse } from "next/server";

/** Vercel / hébergeur : augmente la limite pour laisser MT5 se connecter (MetaAPI). */
export const maxDuration = 60;

const PROVISIONING_BASE =
  "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts";

function normalizeServer(server: string): string {
  return server.trim().replace(/\s+/g, " ");
}

function normalizeLogin(login: string | number): string {
  const s = String(login).trim().replace(/\s/g, "");
  if (/^\d+\.0+$/.test(s)) return s.replace(/\.\d+$/, "");
  return s;
}

/** Serveur saisi ressemble à VT Markets / Vantage Markets (MT5). */
function looksLikeVtMarketsServer(server: string): boolean {
  const n = server.toLowerCase().replace(/\s+/g, " ");
  return n.includes("vtmarket") || n.includes("vt markets");
}

function appendVtMarketsServerHint(message: string, server: string): string {
  if (!looksLikeVtMarketsServer(server)) return message;
  return (
    message +
    " Pour VT Markets : dans MT5 le serveur est souvent « VTMarkets-Live », « VTMarkets-Demo » ou « VTMarkets-Live N » (sans espace entre VT et Markets ; parfois un espace avant le numéro du nœud). Copiez-collez depuis Fichier → Ouvrir un compte de trading."
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchProvisioningAccount(
  accountId: string,
  token: string,
): Promise<Record<string, unknown> | null> {
  const r = await fetch(`${PROVISIONING_BASE}/${accountId}`, {
    headers: { "auth-token": token },
  });
  if (!r.ok) return null;
  return (await r.json()) as Record<string, unknown>;
}

async function deleteProvisioningAccount(
  accountId: string,
  token: string,
): Promise<void> {
  try {
    await fetch(`${PROVISIONING_BASE}/${accountId}`, {
      method: "DELETE",
      headers: { "auth-token": token },
    });
  } catch {
    // best-effort cleanup
  }
}

/**
 * Attend que MetaAPI signale DEPLOYED + CONNECTED (sinon pas d’insert Supabase).
 */
async function waitForMt5Connected(
  accountId: string,
  token: string,
): Promise<{
  ok: boolean;
  last?: Record<string, unknown>;
  errorFr?: string;
}> {
  // Connexion MT5 : les serveurs saisis à la main peuvent mettre 60–120 s (MetaAPI + broker).
  // Sur Vercel Hobby (~10 s max route), définir METAAPI_CONNECT_MAX_WAIT_MS=9000 pour éviter 504.
  const maxWaitMs = Math.min(
    Math.max(
      Number.parseInt(process.env.METAAPI_CONNECT_MAX_WAIT_MS || "90000", 10),
      8000,
    ),
    180000,
  );
  const deadline = Date.now() + maxWaitMs;
  let last: Record<string, unknown> | undefined;
  let deployedDisconnectedStreak = 0;

  while (Date.now() < deadline) {
    const acc = await fetchProvisioningAccount(accountId, token);
    if (acc) {
      last = acc;
      const state = String(acc.state ?? "");
      const conn = String(acc.connectionStatus ?? "");

      if (state === "DEPLOYED" && conn === "CONNECTED") {
        return { ok: true, last: acc };
      }

      if (state === "DEPLOY_FAILED" || state === "UNDEPLOYED") {
        return {
          ok: false,
          last: acc,
          errorFr: `Échec côté MetaAPI (état: ${state}, connexion: ${conn}). Vérifiez le serveur MT5, le login et le mot de passe.`,
        };
      }

      // Déployé mais pas encore CONNECTED : laisser plus de cycles (serveur manuel / latence broker)
      if (state === "DEPLOYED" && conn === "DISCONNECTED") {
        deployedDisconnectedStreak += 1;
        if (deployedDisconnectedStreak >= 22) {
          return {
            ok: false,
            last: acc,
            errorFr:
              "MT5 reste déconnecté après déploiement (serveur, numéro de compte ou mot de passe incorrect). Vérifiez le nom du serveur exactement comme dans MT5 (Fichier → Ouvrir un compte).",
          };
        }
      } else {
        deployedDisconnectedStreak = 0;
      }
    }

    await sleep(2000);
  }

  return {
    ok: false,
    last,
    errorFr: last
      ? `Délai dépassé sans connexion MT5 (dernier état: ${String(last.state)}, connexion: ${String(last.connectionStatus)}). Vérifiez le nom du serveur (exactement comme dans MT5) et les identifiants.`
      : "Délai dépassé — impossible de lire l’état du compte MetaAPI. Réessayez.",
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawLogin = body.login;
    const rawPassword = body.password;
    const rawServer = body.server;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const platform = body.platform || "mt5";
    const magic = body.magic ?? 0;

    const server = normalizeServer(String(rawServer ?? ""));
    const login = normalizeLogin(rawLogin);
    const password = String(rawPassword ?? "").trim();

    if (!server || !login || !password) {
      return NextResponse.json(
        {
          success: false,
          error: "Serveur, login et mot de passe sont requis.",
        },
        { status: 400 },
      );
    }

    if (!process.env.METAAPI_TOKEN) {
      return NextResponse.json(
        { success: false, error: "MetaApi token not configured" },
        { status: 500 },
      );
    }

    const token = process.env.METAAPI_TOKEN;
    const provisioningRegion =
      typeof process.env.METAAPI_PROVISIONING_REGION === "string" &&
      process.env.METAAPI_PROVISIONING_REGION.trim().length > 0
        ? process.env.METAAPI_PROVISIONING_REGION.trim()
        : "london";

    const response = await fetch(PROVISIONING_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "auth-token": token,
      },
      body: JSON.stringify({
        name: name || `MT5 ${login}`,
        type: "cloud",
        login,
        password,
        server,
        platform,
        magic: magic || 0,
        application: "MetaApi",
        region: provisioningRegion,
      }),
    });

    const data = (await response.json()) as Record<string, unknown> & {
      id?: string;
    };

    console.log(
      "MetaApi create account response:",
      response.status,
      JSON.stringify(data),
    );

    if (!response.ok) {
      const msg =
        (data.message as string) ||
        (data.error as string) ||
        "Échec de la création du compte MetaAPI";
      return NextResponse.json(
        {
          success: false,
          error: appendVtMarketsServerHint(msg, server),
          details: data,
        },
        { status: 200 },
      );
    }

    if (!data.id) {
      return NextResponse.json(
        {
          success: false,
          error:
            "MetaApi n'a pas retourné d'ID de compte. " +
            JSON.stringify(data),
        },
        { status: 500 },
      );
    }

    const accountId = data.id as string;

    const deployResponse = await fetch(
      `${PROVISIONING_BASE}/${accountId}/deploy`,
      {
        method: "POST",
        headers: { "auth-token": token },
      },
    );

    if (!deployResponse.ok) {
      const deployError = await deployResponse.json().catch(() => ({}));
      console.warn("MetaAPI deploy non OK:", deployError);
    }

    const wait = await waitForMt5Connected(accountId, token);

    if (!wait.ok) {
      await deleteProvisioningAccount(accountId, token);
      const baseErr =
        wait.errorFr ||
        "Connexion MT5 impossible. Vérifiez serveur, numéro de compte et mot de passe.";
      return NextResponse.json({
        success: false,
        error: appendVtMarketsServerHint(baseErr, server),
        state: wait.last?.state,
        connectionStatus: wait.last?.connectionStatus,
      });
    }

    return NextResponse.json({
      success: true,
      accountId,
      state: wait.last?.state,
      connectionStatus: wait.last?.connectionStatus,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error connecting account:", error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
