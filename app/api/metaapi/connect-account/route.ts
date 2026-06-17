import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from "@supabase/supabase-js";
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
import {
  buildConnectAttempts,
  isFxcessConnectContext,
  resolveBrokerConnectConfig,
  type ConnectAttempt,
} from "@/lib/broker-connect-config";
import { extractSuggestedServersFromMetaApiError } from "@/lib/metaapi-known-servers";
import {
  buildMetaApiAccountLabel,
  persistMt5AccountRow,
} from "@/lib/mt5-account-persist";

/** Garde du temps pour deploy + JSON ; doit rester aligné avec `maxDuration` (littéral requis par Next.js). */
const CONNECT_ROUTE_MAX_DURATION_SEC = 120;
/** Marge avant le kill Vercel pour toujours renvoyer du JSON (évite 504 + message Safari). */
const CONNECT_ROUTE_SAFETY_MS = 10_000;

function connectRouteDeadlineAt(startedAt = Date.now()): number {
  return startedAt + CONNECT_ROUTE_MAX_DURATION_SEC * 1000 - CONNECT_ROUTE_SAFETY_MS;
}

function remainingConnectRouteMs(deadlineAt: number): number {
  return Math.max(deadlineAt - Date.now(), 0);
}

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
      " FXCess = MT4 — serveur demo : FXcess-Demo (copier depuis MT4).";
  }
  if (
    /validation failed/i.test(message) &&
    /fxcess/i.test(`${server} ${brokerHint}`)
  ) {
    out +=
      " MetaAPI ne reconnaît pas ce serveur — utilisez FXcess-Demo exactement.";
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

function parseRetryAfterMs(header: string | null, capMs = 15_000): number {
  if (!header) return Math.min(8_000, capMs);
  const asNum = Number.parseInt(header, 10);
  if (!Number.isNaN(asNum)) return Math.min(asNum * 1000, capMs);
  const asDate = Date.parse(header);
  if (!Number.isNaN(asDate)) return Math.min(Math.max(asDate - Date.now(), 3000), capMs);
  return Math.min(8_000, capMs);
}

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

  const transactionId = randomBytes(16).toString("hex");

  for (let poll = 0; poll < 3; poll++) {
    const response = await fetch(METAAPI_PROVISIONING_ACCOUNTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "auth-token": token,
        "transaction-id": transactionId,
      },
      body: JSON.stringify(createBody),
    });

    const data = (await response.json()) as Record<string, unknown> & {
      id?: string;
    };

    if (response.status === 202) {
      if (poll < 2) {
        await sleep(parseRetryAfterMs(response.headers.get("Retry-After")));
        continue;
      }
      return {
        ok: false,
        validation: false,
        error:
          "MetaAPI détecte encore les paramètres broker — réessayez dans 1 minute.",
        data,
      };
    }

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

  return {
    ok: false,
    validation: false,
    error: "MetaAPI n'a pas répondu à temps.",
  };
}

/**
 * Attend DEPLOYED + CONNECTED avant insert Supabase.
 */
async function waitForBrokerConnected(
  accountId: string,
  token: string,
  options?: {
    routeDeadlineAt?: number;
    platform?: "mt4" | "mt5";
  },
): Promise<{
  ok: boolean;
  last?: Record<string, unknown>;
  errorFr?: string;
}> {
  const platformLabel = options?.platform === "mt4" ? "MT4" : "MT5";
  const routeCapMs = Math.max(CONNECT_ROUTE_MAX_DURATION_SEC * 1000 - 25_000, 20_000);
  let maxWaitMs = Math.min(
    Math.max(
      Number.parseInt(process.env.METAAPI_CONNECT_MAX_WAIT_MS || "75000", 10),
      8000,
    ),
    routeCapMs,
  );
  if (options?.routeDeadlineAt) {
    maxWaitMs = Math.min(
      maxWaitMs,
      Math.max(remainingConnectRouteMs(options.routeDeadlineAt) - 1500, 8000),
    );
  }
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
            `Échec côté MetaAPI (état: ${state}, connexion: ${conn}). Vérifiez le serveur ${platformLabel}, le login et le mot de passe.${connectionBrokerHint(conn)}`,
        };
      }

      // Déployé mais pas encore CONNECTED : laisser plus de cycles (serveur manuel / latence broker)
      if (
        state === "DEPLOYED" &&
        (conn === "DISCONNECTED" || conn === "DISCONNECTED_FROM_BROKER")
      ) {
        deployedDisconnectedStreak += 1;
        if (deployedDisconnectedStreak >= 10) {
          return {
            ok: false,
            last: acc,
            errorFr:
              `${platformLabel} reste déconnecté après déploiement (serveur, numéro de compte ou mot de passe incorrect). Vérifiez le nom du serveur exactement comme dans ${platformLabel}.` +
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
      ? `Délai dépassé sans connexion ${platformLabel} (dernier état: ${String(last.state)}, connexion: ${String(last.connectionStatus)}). Vérifiez serveur FXcess-Demo, login et mot de passe MT4, puis réessayez.${connectionBrokerHint(String(last.connectionStatus ?? ""))}`
      : `Délai dépassé — MetaAPI n'a pas connecté le compte ${platformLabel} à temps. Réessayez dans 1 minute.`,
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

    if (!/^\d+$/.test(login)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Numéro de compte invalide — uniquement des chiffres (login MT4/MT5).",
        },
        { status: 400 },
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

    const routeStartedAt = Date.now();
    const routeDeadlineAt = connectRouteDeadlineAt(routeStartedAt);

    const initialAttempts = await buildConnectAttempts(
      normalizeServer(String(rawServer ?? "")),
      brokerHint,
      token,
    );

    const fxcessOnly = isFxcessConnectContext(brokerHint, displayServer);
    const queue: ConnectAttempt[] = initialAttempts.map((a) =>
      fxcessOnly ? { ...a, platform: "mt4" as const } : a,
    );
    const triedServers = new Set<string>();

    let accountId: string | undefined;
    let connectedServer = displayServer;
    let lastCreateError = "Échec de la création du compte MetaAPI";
    let lastCreateData: Record<string, unknown> | undefined;
    const triedList: string[] = [];

    while (
      queue.length > 0 &&
      !accountId &&
      remainingConnectRouteMs(routeDeadlineAt) > 12_000
    ) {
      const attempt = queue.shift()!;
      const attemptKey = attempt.server.toLowerCase();
      if (triedServers.has(attemptKey)) continue;
      triedServers.add(attemptKey);
      triedList.push(attempt.server);

      await removeDuplicateProvisioningAccounts(
        token,
        login,
        attempt.server,
      );

      const created = await createMetaApiAccount(token, {
        name:
          name ||
          buildMetaApiAccountLabel(user.id, brokerHint || "broker", login),
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
        attempt.platform,
        created.ok ? "OK" : created.error,
      );

      if (created.ok) {
        accountId = created.accountId;
        connectedServer = created.server;
        break;
      }

      lastCreateError = created.error;
      lastCreateData = created.data;

      if (created.validation && created.data) {
        for (const sug of extractSuggestedServersFromMetaApiError(
          created.data,
        )) {
          const sugKey = sug.server.toLowerCase();
          if (!triedServers.has(sugKey)) {
            queue.push({
              server: sug.server,
              platform: fxcessOnly ? "mt4" : attempt.platform,
              keywords: sug.keywords,
            });
          }
        }
        continue;
      }

      break;
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
          triedServers: triedList,
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

    const wait = await waitForBrokerConnected(accountId, token, {
      routeDeadlineAt,
      platform: fxcessOnly ? "mt4" : connectCfg.platform,
    });

    const lastState = String(wait.last?.state ?? "");
    const lastConn = String(wait.last?.connectionStatus ?? "");
    const isConnected =
      lastState === "DEPLOYED" && lastConn === "CONNECTED";

    if (!wait.ok && !isConnected) {
      const recoverable = lastState === "DEPLOYED";
      if (!recoverable) {
        await deleteProvisioningAccount(accountId, token);
      }
      return NextResponse.json({
        success: false,
        error: appendBrokerConnectHint(
          wait.errorFr ||
            "Connexion broker impossible. Vérifiez serveur, login et mot de passe.",
          connectedServer,
          brokerHint,
        ),
        state: wait.last?.state,
        connectionStatus: wait.last?.connectionStatus,
        recoverable,
        accountId: recoverable ? accountId : undefined,
      });
    }

    const adminSupabase = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        )
      : null;
    if (adminSupabase) {
      const persisted = await persistMt5AccountRow(adminSupabase, {
        userId: user.id,
        metaApiAccountId: accountId,
        brokerName: brokerHint || (fxcessOnly ? "FXcess" : "Unknown"),
        serverName: connectedServer,
        login,
        symbolProfile: "auto",
      });
      if (!persisted.ok) {
        console.warn("persistMt5AccountRow:", persisted.error);
      }
    }

    return NextResponse.json({
      success: true,
      accountId,
      server: connectedServer,
      state: wait.last?.state ?? lastState,
      connectionStatus: wait.last?.connectionStatus ?? lastConn,
      persisted: !!adminSupabase,
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
