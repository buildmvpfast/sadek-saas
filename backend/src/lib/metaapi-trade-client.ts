/**
 * Client MetaAPI REST pour POST .../trade
 * - Plusieurs URLs (comme execute-trades) car l’hôte varie selon l’environnement
 * - HTTP 200 peut quand même signifier échec MT (stringCode TRADE_RETCODE_REJECT)
 */

export type MetaApiTradeBody = Record<string, unknown>;

export function metaApiTradeUrls(accountId: string): string[] {
  const id = encodeURIComponent(accountId);
  return [
    `https://mt-client-api-v1.london.agiliumtrade.ai/users/current/accounts/${id}/trade`,
    `https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${id}/trade`,
    `https://mt-client-api-v1.london.agiliumtrade.agiliumtrade.ai/users/current/accounts/${id}/trade`,
    `https://metaapi-api.london.agiliumtrade.agiliumtrade.ai/users/current/accounts/${id}/trade`,
  ];
}

/** Réponse doc MetaAPI : succès = TRADE_RETCODE_DONE / numericCode 10009 */
export function isMetaApiTradeSuccess(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (d.stringCode === "TRADE_RETCODE_DONE") return true;
  if (d.numericCode === 10009) return true;
  if (d.stringCode === "TRADE_RETCODE_REJECT") return false;
  if (d.numericCode === 10006) return false;
  // Anciennes réponses sans codes explicites mais avec id
  if (d.orderId != null || d.positionId != null) {
    if (d.numericCode != null && d.numericCode !== 10009) return false;
    if (
      typeof d.stringCode === "string" &&
      d.stringCode !== "" &&
      d.stringCode !== "TRADE_RETCODE_DONE"
    ) {
      return false;
    }
    return true;
  }
  return false;
}

export function metaApiTradeFailureMessage(data: unknown): string {
  if (!data || typeof data !== "object") return "Réponse MetaAPI invalide";
  const d = data as Record<string, unknown>;
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

/**
 * POST trade : essaie les URLs jusqu’à une réponse JSON exploitable.
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
  let lastData: unknown = null;
  let lastUrl: string | undefined;
  let lastText = "";

  for (const url of metaApiTradeUrls(accountId)) {
    lastUrl = url;
    try {
      const response = await fetch(url, {
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
      // 200 mais rejet MT : ne pas essayer d’autres URLs pour la même erreur métier
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
