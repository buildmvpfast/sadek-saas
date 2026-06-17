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
import { buildConnectAttempts, resolveBrokerConnectConfig } from "@/lib/broker-connect-config";

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

function appendBrokerConnectHint(
  message: string,
  server: string,
  brokerHint: string,
): string {
  let out = appendVtMarketsServerHint(message, server);
  const cfg = resolveBrokerConnectConfig(server, brokerHint);
  if (cfg.hint && !out.includes(cfg.hint.slice(0, 40))) {
    out += ` ${cfg.hint}`;
  }
  if (cfg.platform === "mt4" && !out.toLowerCase().includes("mt4")) {
    out +=
      " FXCess = MT4 uniquement — serveur demo typique : FXCESS-Demo01 (copier depuis MT4).";
  }
  if (
    /vantage/i.test(server) &&
    /vantagemarkets-demo/i.test(server.replace(/\s+/g, "")) &&
    !out.includes("VantageInternational-Demo")
  ) {
    out +=
      " Si échec : essayez VantageInternational-Demo (nom exact dans MT5 → Fichier → Ouvrir un compte).";
  }
  return out;
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

function isServerValidationError(
  status: number,
  data: Record<string, unknown>,
): boolean {
  const msg = String(data.message ?? data.error ?? "").toLowerCase();
  const details = data.details as Record<string, unknown> | undefined;
  const code = String(details?.code ?? "").toUpperCase();
  return (
    status === 400 ||
    msg.includes("validation failed") ||
    msg.includes("srv_not_found") ||
    msg.includes("server file") ||
    msg.includes("not found") ||
    code.includes("SRV_NOT_FOUND")
  );
}

type CreateResult =
  | { ok: true; accountId: string; server: string; data: Record<string, unknown> }
  | { ok: false; validation: boolean; error: string; data?: Record<string, unknown> };

async function createMetaApiAccount(
  token: string,
  params: {
    name: string;
    login: string;
    password: string;
    server: string;
    platform: string;
    magic: number;
    keywords: string[];
    accountType: string;
    region: string;
  },
): Promise<CreateResult> {
  const createBody: Record<string, unknown> = {
    name: params.name,
    type: params.accountType,
    login: params.login,
    password: params.password,
    server: params.server,
    platform: params.platform,
    magic: params.magic || 0,
    application: "MetaApi",
    region: params.region,
    reliability: "high",
  };
  if (params.keywords.length > 0) {
    createBody.keywords = params.keywords;
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

  if (!response.ok) {
    const msg =
      (data.message as string) ||
      (data.error as string) ||
      "Échec de la création du compte MetaAPI";
    return {
      ok: false,
      validation: isServerValidationError(response.status, data),
      error: msg,
      data,
    };
  }

  if (!data.id) {
    return {
      ok: false,
      validation: false,
      error: "MetaApi n'a pas retourné d'ID de compte.",
      data,
    };
  }

  return {
    ok: true,
    accountId: data.id as string,
    server: params.server,
    data,
  };
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
    const brokerHint =
      typeof body.broker_name === "string" ? body.broker_name.trim() : "";
    const connectCfg = resolveBrokerConnectConfig(
      normalizeServer(String(rawServer ?? "")),
      brokerHint,
    );
    const magic = body.magic ?? 0;
    const login = normalizeLogin(rawLogin);
    const password = String(rawPassword ?? "").trim();
    const displayServer = connectCfg.server;

    if (!displayServer || !login || !password) {
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

    const accountTypeRaw =
      process.env.METAAPI_ACCOUNT_TYPE?.trim().toLowerCase() ?? "";
    const accountType =
      accountTypeRaw === "cloud-g1" ? "cloud-g1" : "cloud-g2";

    const attempts = await buildConnectAttempts(
      normalizeServer(String(rawServer ?? "")),
      brokerHint,
      token,
    );

    let accountId: string | undefined;
    let connectedServer = displayServer;
    let lastCreateError = "Échec de la création du compte MetaAPI";
    let lastCreateData: Record<string, unknown> | undefined;

    for (const attempt of attempts) {
      await removeDuplicateProvisioningAccounts(
        token,
        login,
        attempt.server,
      );

      const created = await createMetaApiAccount(token, {
        name: name || `${attempt.platform.toUpperCase()} ${login}`,
        login,
        password,
        server: attempt.server,
        platform: attempt.platform,
        magic,
        keywords: attempt.keywords,
        accountType,
        region: provisioningRegion,
      });

      console.log(
        "MetaApi create attempt:",
        attempt.server,
        created.ok ? "OK" : created.error,
      );

      if (created.ok) {
        accountId = created.accountId;
        connectedServer = created.server;
        break;
      }

      lastCreateError = created.error;
      lastCreateData = created.data;
      if (!created.validation) break;
    }

    if (!accountId) {
      return NextResponse.json(
        {
          success: false,
          error: appendBrokerConnectHint(
            lastCreateError,
            connectedServer,
            brokerHint,
          ),
          details: lastCreateData,
          triedServers: attempts.map((a) => a.server),
        },
        { status: 200 },
      );
    }

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
        error: appendBrokerConnectHint(full, connectedServer, brokerHint),
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
        error: appendBrokerConnectHint(baseErr, connectedServer, brokerHint),
        state: wait.last?.state,
        connectionStatus: wait.last?.connectionStatus,
      });
    }

    return NextResponse.json({
      success: true,
      accountId,
      server: connectedServer,
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
