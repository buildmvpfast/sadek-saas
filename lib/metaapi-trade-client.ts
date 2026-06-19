/**
 * Client MetaAPI REST (trade + lecture positions)
 */
import { formatFetchError, isTlsCertificateError } from "@/lib/metaapi-errors";
import {
  METAAPI_CLIENT_ROOTS,
  metaApiClientAccountPath,
} from "@/lib/metaapi-endpoints";
import {
  parseStopSide,
  sanitizeStopsForOpenPrice,
  isQuoteConsistentWithStops,
  clampStopsToBrokerMaxDistance,
} from "@/lib/metaapi-stops";

export type MetaApiTradeBody = Record<string, unknown>;

export function metaApiTradeUrls(accountId: string): string[] {
  return metaApiClientAccountPath(accountId, "/trade");
}

/** Hôtes client REST pour GET positions (doit coller à la région du compte côté MetaAPI). */
export function metaApiPositionsUrls(accountId: string): string[] {
  return metaApiClientAccountPath(accountId, "/positions");
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
    ? new Error(formatFetchError(lastErr))
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
  const actionType = String(payload.actionType ?? "");
  const isCloseById = actionType === "POSITION_CLOSE_ID";
  if (
    !isCloseById &&
    (payload.volume == null ||
      typeof payload.volume !== "number" ||
      !Number.isFinite(payload.volume) ||
      payload.volume <= 0)
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
  let lastTlsText = "";

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
      const err = formatFetchError(e);
      if (isTlsCertificateError(err)) lastTlsText = err;
      else lastText = err;
    }
  }

  return {
    ok: false,
    status: lastStatus,
    data: lastData,
    url: lastUrl,
    error:
      lastText ||
      lastTlsText ||
      `MetaAPI trade impossible (HTTP ${lastStatus || "?"}) pour le compte`,
  };
}

const STOPS_RELATED =
  /invalid.?stops|stops.?level|invalid.?prices?|price.?distance|validation failed|TRADE_RETCODE_INVALID_STOPS|TRADE_RETCODE_INVALID_PRICE|ERR_INVALID_STOPS|\b10015\b|\b130\b/i;

function stripStops(body: MetaApiTradeBody, sl: boolean, tp: boolean): MetaApiTradeBody {
  const next = { ...body };
  if (sl) delete next.stopLoss;
  if (tp) delete next.takeProfit;
  return next;
}

export async function postMetaApiTradeWithStopsFallback(
  accountId: string,
  body: MetaApiTradeBody,
  token: string,
): Promise<PostMetaApiTradeResult> {
  const hasSlTp = body.stopLoss != null || body.takeProfit != null;
  const attempts: MetaApiTradeBody[] = [body];
  if (hasSlTp) {
    attempts.push(stripStops(body, true, false));
    attempts.push(stripStops(body, false, true));
    attempts.push(stripStops(body, true, true));
  }

  const seen = new Set<string>();
  let last: PostMetaApiTradeResult = {
    ok: false,
    status: 0,
    data: null,
    error: "Aucune tentative",
  };

  for (const attempt of attempts) {
    const key = JSON.stringify(attempt);
    if (seen.has(key)) continue;
    seen.add(key);

    const result = await postMetaApiTrade(accountId, attempt, token);
    last = result;
    if (result.ok) return result;
    if (!hasSlTp || !STOPS_RELATED.test(result.error || "")) {
      return result;
    }
  }

  if (hasSlTp && last.error) {
    return { ...last, error: `${last.error} (après retry sans SL/TP)` };
  }
  return last;
}

export type MetaApiSymbolQuote = { bid: number; ask: number };

/** Prix live bid/ask pour valider SL/TP avant ordre MARKET. */
export async function fetchMetaApiSymbolQuote(
  accountId: string,
  symbol: string,
  token: string,
): Promise<MetaApiSymbolQuote | null> {
  const id = encodeURIComponent(accountId);
  const variants = [symbol];
  if (/\+/.test(symbol)) variants.push(symbol.replace(/\+$/i, ""));
  if (/-VIP/i.test(symbol)) variants.push(symbol.replace(/-VIP/i, ""));

  let lastErr = "";
  let lastTlsErr = "";

  for (const variant of Array.from(new Set(variants))) {
    const sym = encodeURIComponent(variant);
    for (const root of METAAPI_CLIENT_ROOTS) {
      const url = `${root}/users/current/accounts/${id}/symbols/${sym}/current-price`;
      try {
        const response = await fetch(url, { headers: { "auth-token": token } });
        if (!response.ok) {
          lastErr = `HTTP ${response.status}`;
          continue;
        }
        const data = (await response.json()) as Record<string, unknown>;
        const bid = parseFloat(String(data.bid ?? ""));
        const ask = parseFloat(String(data.ask ?? ""));
        if (Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask > 0) {
          return { bid, ask };
        }
        lastErr = "bid/ask invalides";
      } catch (e: unknown) {
        const err = e instanceof Error ? e.message : String(e);
        if (isTlsCertificateError(err)) lastTlsErr = err;
        else lastErr = err;
      }
    }
  }

  console.warn(`fetchMetaApiSymbolQuote ${symbol}: ${lastErr || lastTlsErr}`);
  return null;
}

function minStopDistance(refPrice: number): number {
  if (refPrice > 1000) return Math.max(refPrice * 0.00015, 1);
  if (refPrice > 10) return Math.max(refPrice * 0.0001, 0.01);
  return 0.00005;
}

type BuiltMarketOrderResult = { ok: true; order: MetaApiTradeBody };

function buildMarketOrderWithValidatedStops(
  body: MetaApiTradeBody,
  quote: MetaApiSymbolQuote | null,
): BuiltMarketOrderResult {
  const action = String(body.actionType ?? "");
  const side = parseStopSide(action);
  const refPrice = side === "BUY" ? quote?.ask : quote?.bid;
  const stopLoss = body.stopLoss as number | undefined;
  const takeProfit = body.takeProfit as number | undefined;

  if (stopLoss == null && takeProfit == null) {
    return { ok: true, order: { ...body } };
  }

  if (refPrice == null || !Number.isFinite(refPrice)) {
    return { ok: true, order: { ...body } };
  }

  const dist = minStopDistance(refPrice);
  const maxClamped = clampStopsToBrokerMaxDistance(
    side,
    refPrice,
    stopLoss,
    takeProfit,
  );
  const sanitized = sanitizeStopsForOpenPrice(
    side,
    refPrice,
    maxClamped.stopLoss ?? stopLoss,
    maxClamped.takeProfit ?? takeProfit,
    dist,
  );

  const order: MetaApiTradeBody = { ...body };
  if (sanitized.stopLoss != null) order.stopLoss = sanitized.stopLoss;
  else if (stopLoss != null) order.stopLoss = stopLoss;

  if (sanitized.takeProfit != null) order.takeProfit = sanitized.takeProfit;
  else if (takeProfit != null) order.takeProfit = takeProfit;

  return { ok: true, order };
}

/**
 * MARKET : SL/TP inclus dans l'ordre initial (1 seul POST MetaAPI).
 * Prix live vérifié avant envoi — pas d'ouverture nue.
 */
export async function postMetaApiMarketReliable(
  accountId: string,
  body: MetaApiTradeBody,
  token: string,
): Promise<PostMetaApiTradeResult> {
  const action = String(body.actionType ?? "");
  const isMarket =
    action === "ORDER_TYPE_BUY" || action === "ORDER_TYPE_SELL";
  if (!isMarket) {
    return postMetaApiTradeWithStopsFallback(accountId, body, token);
  }

  const symbol = String(body.symbol ?? "");
  const side = parseStopSide(action);
  const stopLoss = body.stopLoss as number | undefined;
  const takeProfit = body.takeProfit as number | undefined;
  const quote =
    stopLoss != null || takeProfit != null
      ? await fetchMetaApiSymbolQuote(accountId, symbol, token)
      : null;

  if (quote) {
    const refPrice = side === "BUY" ? quote.ask : quote.bid;
    if (
      !isQuoteConsistentWithStops(refPrice, side, stopLoss, takeProfit)
    ) {
      return {
        ok: false,
        status: 400,
        data: null,
        error: `ERR_QUOTE_SYMBOL_MISMATCH: prix ${refPrice} incohérent avec SL/TP pour ${symbol}`,
      };
    }
  }

  const built = buildMarketOrderWithValidatedStops(body, quote);

  const result = await postMetaApiTrade(accountId, built.order, token);
  if (result.ok) return result;

  if (STOPS_RELATED.test(result.error || "") && quote) {
    const ref = side === "BUY" ? quote.ask : quote.bid;
    const clamped = clampStopsToBrokerMaxDistance(
      side,
      ref,
      body.stopLoss as number,
      body.takeProfit as number,
      0.03,
    );
    const clampOrder: MetaApiTradeBody = {
      ...body,
      ...(clamped.stopLoss != null ? { stopLoss: clamped.stopLoss } : {}),
      ...(clamped.takeProfit != null ? { takeProfit: clamped.takeProfit } : {}),
    };
    const clampedResult = await postMetaApiTrade(accountId, clampOrder, token);
    if (clampedResult.ok) return clampedResult;

    const wider = sanitizeStopsForOpenPrice(
      side,
      ref,
      clamped.stopLoss,
      clamped.takeProfit,
      minStopDistance(ref) * 3,
    );
    const widerOrder: MetaApiTradeBody = {
      ...body,
      ...(wider.stopLoss != null ? { stopLoss: wider.stopLoss } : {}),
      ...(wider.takeProfit != null ? { takeProfit: wider.takeProfit } : {}),
    };
    const second = await postMetaApiTrade(accountId, widerOrder, token);
    if (second.ok) return second;

    const naked = { ...body };
    delete naked.stopLoss;
    delete naked.takeProfit;
    const third = await postMetaApiTrade(accountId, naked, token);
    if (third.ok) return third;
  }

  return result;
}

/** POST .../positions/:id/close — mêmes bases que GET positions */
export function metaApiClosePositionUrls(
  accountId: string,
  positionId: string,
): string[] {
  const id = encodeURIComponent(accountId);
  const pid = encodeURIComponent(String(positionId));
  const roots = [...METAAPI_CLIENT_ROOTS];
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

export function metaApiSymbolsUrls(accountId: string): string[] {
  return metaApiClientAccountPath(accountId, "/symbols");
}

export async function fetchMetaApiSymbolNames(
  accountId: string,
  token: string,
): Promise<{ ok: true; symbols: Set<string> } | { ok: false; error: string }> {
  let lastErr = "";
  for (const url of metaApiSymbolsUrls(accountId)) {
    try {
      const response = await fetch(url, {
        headers: { "auth-token": token },
      });
      if (!response.ok) {
        lastErr = `HTTP ${response.status}`;
        continue;
      }
      const data: unknown = await response.json();
      if (!Array.isArray(data)) {
        lastErr = "symbols: not array";
        continue;
      }
      const symbols = new Set<string>();
      for (const row of data) {
        if (typeof row === "string" && row.trim()) {
          symbols.add(row.trim());
          continue;
        }
        if (row && typeof row === "object" && "symbol" in row) {
          const sym = String((row as { symbol: string }).symbol).trim();
          if (sym) symbols.add(sym);
        }
      }
      if (symbols.size === 0) {
        lastErr = "symbols: empty";
        continue;
      }
      return { ok: true, symbols };
    } catch (e: unknown) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  return { ok: false, error: lastErr || "symbols unavailable" };
}

export async function fetchMetaApiAccountInfo(
  accountId: string,
  token: string,
): Promise<Record<string, unknown> | null> {
  for (const root of METAAPI_CLIENT_ROOTS) {
    try {
      const url = `${root}/users/current/accounts/${encodeURIComponent(accountId)}/account-information`;
      const response = await fetch(url, { headers: { "auth-token": token } });
      if (!response.ok) continue;
      const data = (await response.json()) as Record<string, unknown>;
      if (data && typeof data === "object") return data;
    } catch {
      /* next */
    }
  }
  return null;
}

export async function fetchMetaApiAccountEquity(
  accountId: string,
  token: string,
): Promise<number | null> {
  const info = await fetchMetaApiAccountInfo(accountId, token);
  const equity = info?.equity;
  if (typeof equity === "number" && Number.isFinite(equity)) return equity;
  return null;
}

/** Fermeture partielle ou totale d'une position. */
export async function postMetaApiClosePositionVolume(
  accountId: string,
  positionId: string,
  token: string,
  volume?: number,
): Promise<PostMetaApiTradeResult> {
  const body: MetaApiTradeBody = {
    actionType: "POSITION_CLOSE_ID",
    positionId: String(positionId),
  };
  if (volume != null && Number.isFinite(volume) && volume > 0) {
    body.volume = volume;
  }
  return postMetaApiTrade(accountId, body, token);
}

function metaApiClientRoots(): string[] {
  return [...METAAPI_CLIENT_ROOTS];
}

export function metaApiOrdersUrls(accountId: string): string[] {
  const id = encodeURIComponent(accountId);
  return metaApiClientRoots().map(
    (r) => `${r}/users/current/accounts/${id}/orders`,
  );
}

export async function fetchMetaApiOrdersJson(
  accountId: string,
  token: string,
): Promise<{ ok: true; orders: unknown[] } | { ok: false; error: string }> {
  let lastErr = "";
  for (const url of metaApiOrdersUrls(accountId)) {
    try {
      const response = await fetch(url, {
        headers: { "auth-token": token },
      });
      if (!response.ok) {
        lastErr = `HTTP ${response.status}`;
        continue;
      }
      const data: unknown = await response.json();
      if (!Array.isArray(data)) {
        lastErr = "orders: not array";
        continue;
      }
      return { ok: true, orders: data };
    } catch (e: unknown) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  return { ok: false, error: lastErr || "orders unavailable" };
}

export async function postMetaApiCancelOrder(
  accountId: string,
  orderId: string,
  token: string,
): Promise<PostMetaApiTradeResult> {
  return postMetaApiTrade(
    accountId,
    { actionType: "ORDER_CANCEL", orderId: String(orderId) },
    token,
  );
}
