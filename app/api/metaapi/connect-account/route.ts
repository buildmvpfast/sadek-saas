import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { rateLimit } from '@/lib/rate-limit';
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  deleteProvisioningAccount,
  fetchProvisioningAccount,
  METAAPI_PROVISIONING_ACCOUNTS_URL,
  removeDuplicateProvisioningAccounts,
} from "@/lib/metaapi-provisioning";

/** Garde du temps pour deploy + JSON ; doit rester aligné avec `maxDuration` (littéral requis par Next.js). */
const CONNECT_ROUTE_MAX_DURATION_SEC = 120;

/** Vercel : littéral obligatoire (pas de référence à une autre constante). */
export const maxDuration = 120;

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
    " Pour VT Markets : serveur souvent « VTMarkets-Live » / « VTMarkets-Demo » (copier depuis MT5). Utilisez le mot de passe principal MT5, pas seulement le mot de passe investisseur, si la connexion échoue."
  );
}

function connectionBrokerHint(connectionStatus: string | undefined): string {
  if (connectionStatus === "DISCONNECTED_FROM_BROKER") {
    return " Le broker a refusé la session (login, mot de passe principal MT5, ou nom de serveur). Un mot de passe investisseur seul peut empêcher la connexion cloud.";
  }
  return "";
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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
  // Connexion MT5 : 60–120 s fréquent ; ne pas dépasser le budget route (sinon 504 Vercel).
  const routeCapMs = Math.max(CONNECT_ROUTE_MAX_DURATION_SEC * 1000 - 12_000, 15_000);
  const maxWaitMs = Math.min(
    Math.min(
      Math.max(
        Number.parseInt(
          process.env.METAAPI_CONNECT_MAX_WAIT_MS || "110000",
          10,
        ),
        8000,
      ),
      175000,
    ),
    routeCapMs,
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
          errorFr:
            `Échec côté MetaAPI (état: ${state}, connexion: ${conn}). Vérifiez le serveur MT5, le login et le mot de passe.${connectionBrokerHint(conn)}`,
        };
      }

      // Déployé mais pas encore CONNECTED : laisser plus de cycles (serveur manuel / latence broker)
      if (
        state === "DEPLOYED" &&
        (conn === "DISCONNECTED" || conn === "DISCONNECTED_FROM_BROKER")
      ) {
        deployedDisconnectedStreak += 1;
        if (deployedDisconnectedStreak >= 22) {
          return {
            ok: false,
            last: acc,
            errorFr:
              "MT5 reste déconnecté après déploiement (serveur, numéro de compte ou mot de passe incorrect). Vérifiez le nom du serveur exactement comme dans MT5 (Fichier → Ouvrir un compte)." +
              connectionBrokerHint(conn),
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
      ? `Délai dépassé sans connexion MT5 (dernier état: ${String(last.state)}, connexion: ${String(last.connectionStatus)}). Vérifiez le nom du serveur (exactement comme dans MT5) et les identifiants.${connectionBrokerHint(String(last.connectionStatus ?? ""))}`
      : "Délai dépassé — impossible de lire l’état du compte MetaAPI. Réessayez.",
  };
}

export async function POST(request: Request) {
  // Verify authenticated user
  const supabaseAuth = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: max 5 MetaAPI connections per IP per hour
  const rlError = rateLimit(request as any, "connect-account", { limit: 5, windowMs: 60 * 60 * 1000 });
  if (rlError) return rlError;

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

    await removeDuplicateProvisioningAccounts(token, login, server);

    const provisioningRegion =
      typeof process.env.METAAPI_PROVISIONING_REGION === "string" &&
      process.env.METAAPI_PROVISIONING_REGION.trim().length > 0
        ? process.env.METAAPI_PROVISIONING_REGION.trim()
        : "london";

    const accountTypeRaw =
      process.env.METAAPI_ACCOUNT_TYPE?.trim().toLowerCase() ?? "";
    const accountType =
      accountTypeRaw === "cloud-g1" ? "cloud-g1" : "cloud-g2";

    const createBody: Record<string, unknown> = {
      name: name || `MT5 ${login}`,
      type: accountType,
      login,
      password,
      server,
      platform,
      magic: magic || 0,
      application: "MetaApi",
      region: provisioningRegion,
      reliability: "high",
    };
    if (looksLikeVtMarketsServer(server)) {
      createBody.keywords = ["VT Markets", "VTMarkets", "Vantage"];
    }

    const response = await fetch(METAAPI_PROVISIONING_ACCOUNTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "auth-token": token,
        "transaction-id": randomBytes(16).toString("hex"),
      },
      body: JSON.stringify(createBody),
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
      `${METAAPI_PROVISIONING_ACCOUNTS_URL}/${accountId}/deploy`,
      {
        method: "POST",
        headers: { "auth-token": token },
      },
    );

    if (!deployResponse.ok) {
      const deployStatus = deployResponse.status;
      const deployError = (await deployResponse.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      console.warn("MetaAPI deploy non OK:", deployStatus, deployError);
      const deployMsg =
        (typeof deployError.message === "string" &&
          deployError.message.trim()) ||
        (deployStatus === 401
          ? "MetaAPI n'a pas pu authentifier le compte auprès du broker (serveur, login ou mot de passe)."
          : `Échec du déploiement MetaAPI (HTTP ${deployStatus}).`);
      const detail =
        typeof deployError.details === "string" ? deployError.details : "";
      const full = detail ? `${deployMsg} (${detail})` : deployMsg;
      await deleteProvisioningAccount(accountId, token);
      return NextResponse.json({
        success: false,
        error: appendVtMarketsServerHint(full, server),
        details: deployError,
      });
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
    console.error("Error connecting account:", error);
    return NextResponse.json(
      { success: false, error: "An error occurred. Please try again." },
      { status: 500 },
    );
  }
}
