/**
 * Client MetaAPI REST (trade + lecture positions)
 * - Plusieurs URLs régionales (comme execute-trades)
 * - HTTP 200 sur /trade peut contenir TRADE_RETCODE_REJECT → ne jamais traiter orderId seul comme succès
 */

export type MetaApiTradeBody = Record<string, unknown>;

export function metaApiTradeUrls(accountId: string): string[] {
  const id = encodeURIComponent(accountId);
  return [
    `https://mt-client-api-v1.london.agiliumtrade.ai/users/current/accounts/${id}/trade`,
    `https://mt-client-api-v1.new-york.agiliumtrade.ai/users/current/accounts/${id}/trade`,
    `https://mt-client-api-v1.singapore.agiliumtrade.ai/users/current/accounts/${id}/trade`,
    `https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${id}/trade`,
    `https://mt-client-api-v1.london.agiliumtrade.agiliumtrade.ai/users/current/accounts/${id}/trade`,
    `https://metaapi-api.london.agiliumtrade.agiliumtrade.ai/users/current/accounts/${id}/trade`,
  ];
}

/** Hôtes client REST pour GET positions (doit coller à la région du compte côté MetaAPI). */
export function metaApiPositionsUrls(accountId: string): string[] {
  const id = encodeURIComponent(accountId);
  return [
    `https://mt-client-api-v1.london.agiliumtrade.ai/users/current/accounts/${id}/positions`,
    `https://mt-client-api-v1.new-york.agiliumtrade.ai/users/current/accounts/${id}/positions`,
    `https://mt-client-api-v1.singapore.agiliumtrade.ai/users/current/accounts/${id}/positions`,
    `https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${id}/positions`,
    `https://mt-client-api-v1.london.agiliumtrade.agiliumtrade.ai/users/current/accounts/${id}/positions`,
  ];
}

/** Codes string de succès (MetatraderTradeResponse, doc MetaAPI). */
const META_API_TRADE_SUCCESS_STRING = new Set([
  "ERR_NO_ERROR",
  "TRADE_RETCODE_PLACED",
  "TRADE_RETCODE_DONE",
  "TRADE_RETCODE_DONE_PARTIAL",
  "TRADE_RETCODE_NO_CHANGES",
]);

function normalizeMetaApiTradePayload(
  data: unknown,
): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (
    typeof d.stringCode === "string" ||
    typeof d.numericCode === "number" ||
    typeof d.numericCode === "string"
  ) {
    return d;
  }
  const inner = d.response ?? d.result ?? d.data;
  if (inner && typeof inner === "object") {
    return inner as Record<string, unknown>;
  }
  return d;
}

function parseNumericCode(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Succès selon la doc MetaAPI (numeric 0, 10008–10010, 10025 + strings listées).
 * Ne pas inférer le succès depuis orderId seul (risque de faux positif).
 */
export function isMetaApiTradeSuccess(data: unknown): boolean {
  const d = normalizeMetaApiTradePayload(data);
  if (!d) return false;
  const sc = d.stringCode;
  if (typeof sc === "string" && META_API_TRADE_SUCCESS_STRING.has(sc)) {
    return true;
  }
  const nc = parseNumericCode(d.numericCode);
  if (nc == null) return false;
  if (nc === 0) return true;
  if (nc === 10025) return true;
  if (nc >= 10008 && nc <= 10010) return true;
  return false;
}

export function metaApiTradeFailureMessage(data: unknown): string {
  const d = normalizeMetaApiTradePayload(data);
  if (!d) return "Réponse MetaAPI invalide";
  const parts = [
    d.message,
    d.stringCode,
    d.numericCode != null ? String(d.numericCode) : null,
  ].filter(Boolean);
  return parts.join(" — ") || "Trade refusé par MetaTrader";
}

function sanitizeTradeBody(body: MetaApiTradeBody): MetaApiTradeBody {
  const out: MetaApiTradeBody = {};
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined || v === null) continue;
    if (k === "volume") {
      const n = typeof v === "number" ? v : parseFloat(String(v));
      if (!Number.isFinite(n) || n <= 0) continue;
      out[k] = Math.round(n * 1e8) / 1e8;
      continue;
    }
    if (k === "stopLoss" || k === "takeProfit" || k === "openPrice") {
      const n = typeof v === "number" ? v : parseFloat(String(v));
      if (!Number.isFinite(n)) continue;
      out[k] = n;
      continue;
    }
    out[k] = v;
  }
  return out;
}

export type PostMetaApiTradeResult = {
  ok: boolean;
  status: number;
  data: unknown;
  url?: string;
  error?: string;
};

const TRADE_FETCH_TIMEOUT_MS = 45_000;
const TRADE_FETCH_RETRIES = 2;

async function fetchMetaApiTradePost(
  url: string,
  init: RequestInit,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < TRADE_FETCH_RETRIES; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TRADE_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        ...init,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      return response;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (attempt < TRADE_FETCH_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(lastErr != null ? String(lastErr) : "fetch failed");
}

/**
 * POST trade : essaie les URLs jusqu’à une réponse JSON avec succès MT explicite.
 */
export async function postMetaApiTrade(
  accountId: string,
  body: MetaApiTradeBody,
  token: string,
): Promise<PostMetaApiTradeResult> {
  const payload = sanitizeTradeBody(body);
  if (
    payload.volume == null ||
    typeof payload.volume !== "number" ||
    !Number.isFinite(payload.volume) ||
    payload.volume <= 0
  ) {
    return {
      ok: false,
      status: 400,
      data: null,
      error: "Volume d’ordre invalide ou manquant",
    };
  }

  let lastStatus = 0;
  let lastData: unknown = null;
  let lastUrl: string | undefined;
  let lastText = "";

  for (const url of metaApiTradeUrls(accountId)) {
    lastUrl = url;
    try {
      const response = await fetchMetaApiTradePost(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "auth-token": token,
        },
        body: JSON.stringify(payload),
      });

      lastStatus = response.status;
      const ct = response.headers.get("content-type") || "";

      if (response.status === 404 && ct.includes("text/html")) {
        continue;
      }

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        lastText = await response.text().catch(() => "");
        continue;
      }
      lastData = data;

      if (!response.ok) {
        lastText = metaApiTradeFailureMessage(data);
        continue;
      }

      if (isMetaApiTradeSuccess(data)) {
        return { ok: true, status: response.status, data, url };
      }

      lastText = metaApiTradeFailureMessage(data);
      return {
        ok: false,
        status: response.status,
        data,
        url,
        error: lastText,
      };
    } catch (e: unknown) {
      lastText = e instanceof Error ? e.message : String(e);
    }
  }

  return {
    ok: false,
    status: lastStatus,
    data: lastData,
    url: lastUrl,
    error:
      lastText ||
      `MetaAPI trade impossible (HTTP ${lastStatus || "?"}) pour le compte`,
  };
}

const STOPS_RELATED =
  /invalid.?stops|stops.?level|invalid.?prices?|price.?distance|TRADE_RETCODE_INVALID_STOPS/i;

export async function postMetaApiTradeWithStopsFallback(
  accountId: string,
  body: MetaApiTradeBody,
  token: string,
): Promise<PostMetaApiTradeResult> {
  const hasSlTp = body.stopLoss != null || body.takeProfit != null;

  const first = await postMetaApiTrade(accountId, body, token);
  if (first.ok) return first;

  const err = (first.error || "").toString();
  if (
    hasSlTp &&
    STOPS_RELATED.test(err) &&
    (body.actionType === "ORDER_TYPE_BUY" ||
      body.actionType === "ORDER_TYPE_SELL")
  ) {
    const { stopLoss: _sl, takeProfit: _tp, ...rest } = body;
    const second = await postMetaApiTrade(accountId, rest, token);
    if (second.ok) return second;
    return {
      ...second,
      error: `${second.error || ""} (après retry sans SL/TP)`,
    };
  }

  return first;
}

/** POST .../positions/:id/close — mêmes bases que GET positions */
export function metaApiClosePositionUrls(
  accountId: string,
  positionId: string,
): string[] {
  const id = encodeURIComponent(accountId);
  const pid = encodeURIComponent(String(positionId));
  const roots = [
    "https://mt-client-api-v1.london.agiliumtrade.ai",
    "https://mt-client-api-v1.new-york.agiliumtrade.ai",
    "https://mt-client-api-v1.singapore.agiliumtrade.ai",
    "https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai",
    "https://mt-client-api-v1.london.agiliumtrade.agiliumtrade.ai",
  ];
  return roots.map(
    (r) =>
      `${r}/users/current/accounts/${id}/positions/${pid}/close`,
  );
}

export async function postMetaApiClosePosition(
  accountId: string,
  positionId: string,
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  let last = "";
  for (const url of metaApiClosePositionUrls(accountId, positionId)) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "auth-token": token },
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && isMetaApiTradeSuccess(data)) {
        return { ok: true };
      }
      last =
        metaApiTradeFailureMessage(data) ||
        `HTTP ${response.status}`;
    } catch (e: unknown) {
      last = e instanceof Error ? e.message : String(e);
    }
  }
  return { ok: false, error: last };
}

export async function fetchMetaApiPositionsJson(
  accountId: string,
  token: string,
): Promise<{ ok: true; positions: unknown[]; url: string } | { ok: false; error: string }> {
  let lastErr = "";
  for (const url of metaApiPositionsUrls(accountId)) {
    try {
      const response = await fetch(url, {
        headers: {
          "auth-token": token,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        const t = await response.text().catch(() => "");
        lastErr = `HTTP ${response.status}: ${t.slice(0, 200)}`;
        continue;
      }
      const data: unknown = await response.json();
      if (!Array.isArray(data)) {
        lastErr = "Réponse positions: JSON non tableau";
        continue;
      }
      return { ok: true, positions: data, url };
    } catch (e: unknown) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  return { ok: false, error: lastErr || "Aucun endpoint positions MetaAPI joignable" };
}
