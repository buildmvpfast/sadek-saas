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
  const details = d.details;
  if (typeof d.message === "string" && /validation failed/i.test(d.message) && details) {
    parts.push(typeof details === "string" ? details : JSON.stringify(details));
  }
  return parts.join(" — ") || "Trade refusé par MetaTrader";
}

function sanitizeTradeBody(body: MetaApiTradeBody): MetaApiTradeBody {
  const out: MetaApiTradeBody = {};
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined || v === null) continue;
    if (k === "deviation") {
      const n = typeof v === "number" ? v : parseFloat(String(v));
      if (Number.isFinite(n) && n >= 0) out.slippage = Math.round(n);
      continue;
    }
    if (k === "volume") {
      const n = typeof v === "number" ? v : parseFloat(String(v));
      if (!Number.isFinite(n) || n <= 0) continue;
      out[k] = Math.round(n * 1e8) / 1e8;
      continue;
    }
    if (k === "stopLoss" || k === "takeProfit" || k === "openPrice" || k === "slippage") {
      const n = typeof v === "number" ? v : parseFloat(String(v));
      if (!Number.isFinite(n)) continue;
      out[k] = k === "slippage" ? Math.round(n) : n;
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
  const isPositionModify = actionType === "POSITION_MODIFY";
  if (
    !isCloseById &&
    !isPositionModify &&
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
  const actionType = String(body.actionType ?? "");
  if (isPendingOrderAction(actionType)) {
    return postMetaApiPendingReliable(accountId, body, token);
  }

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
  if (/^XAUUSD/i.test(symbol) && !/\+$/i.test(symbol)) {
    variants.push(`${symbol}+`, "XAUUSD+", "GOLD");
  }
  if (/^GOLD$/i.test(symbol)) {
    variants.push("XAUUSD", "XAUUSD+", "XAUUSD-VIP");
  }

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

function isGoldBrokerSymbol(symbol: string): boolean {
  const c = symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return c === "GOLD" || c.startsWith("XAUUSD") || c.startsWith("XAU");
}

function isIndexBrokerSymbol(symbol: string): boolean {
  const raw = symbol.toUpperCase();
  const c = symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return (
    /^(NAS100|USTEC|US100|US30|DJ30|WS30|GER40|DE40|DAX40|UK100|SPX500|US500)/.test(
      c,
    ) || /NAS|DJ30|US30|GER40|DE40|UK100|SPX500|USTEC|US100/i.test(raw)
  );
}

export function isPendingOrderAction(actionType: string): boolean {
  return /ORDER_TYPE_(?:BUY|SELL)_(?:STOP|LIMIT)/i.test(actionType);
}

function minStopDistance(refPrice: number, symbol?: string): number {
  if (symbol && isGoldBrokerSymbol(symbol)) {
    // Signaux canal : SL/TP souvent 3–20 $ — pas 50 pts imposés
    return Math.max(refPrice * 0.00002, 0.05);
  }
  if (symbol && isIndexBrokerSymbol(symbol)) {
    return Math.max(refPrice * 0.00003, 1);
  }
  if (refPrice > 2000) return Math.max(refPrice * 0.002, 5);
  if (refPrice > 1000) return Math.max(refPrice * 0.001, 2);
  if (refPrice > 10) return Math.max(refPrice * 0.0001, 0.01);
  return 0.00005;
}

function adjustStopToMinDistance(
  side: ReturnType<typeof parseStopSide>,
  refPrice: number,
  value: number,
  dist: number,
  kind: "sl" | "tp",
): number {
  const buy = side === "BUY";
  if (kind === "sl") {
    if (buy) return Math.min(value, refPrice - dist);
    return Math.max(value, refPrice + dist);
  }
  if (buy) return Math.max(value, refPrice + dist);
  return Math.min(value, refPrice - dist);
}

type BuiltMarketOrderResult = { ok: true; order: MetaApiTradeBody };

function buildMarketOrderWithValidatedStops(
  body: MetaApiTradeBody,
  quote: MetaApiSymbolQuote | null,
): BuiltMarketOrderResult {
  const action = String(body.actionType ?? "");
  const side = parseStopSide(action);
  const stopLoss = body.stopLoss as number | undefined;
  const takeProfit = body.takeProfit as number | undefined;

  if (stopLoss == null && takeProfit == null) {
    return { ok: true, order: { ...body } };
  }

  if (quote == null) {
    return { ok: true, order: { ...body } };
  }

  const refPrice = side === "BUY" ? quote.ask : quote.bid;
  if (refPrice == null || !Number.isFinite(refPrice)) {
    return { ok: true, order: { ...body } };
  }

  return {
    ok: true,
    order: applyStopsForReferencePrice(body, refPrice),
  };
}

function withAbsoluteStopUnits(body: MetaApiTradeBody): MetaApiTradeBody {
  const order: MetaApiTradeBody = { ...body };
  if (order.stopLoss != null) order.stopLossUnits = "ABSOLUTE_PRICE";
  if (order.takeProfit != null) order.takeProfitUnits = "ABSOLUTE_PRICE";
  return order;
}

function applyStopsForReferencePrice(
  body: MetaApiTradeBody,
  refPrice: number,
): MetaApiTradeBody {
  const action = String(body.actionType ?? "");
  const side = parseStopSide(action);
  const symbol = String(body.symbol ?? "");
  const stopLoss = body.stopLoss as number | undefined;
  const takeProfit = body.takeProfit as number | undefined;

  if (stopLoss == null && takeProfit == null) {
    return withAbsoluteStopUnits({ ...body });
  }

  const dist = minStopDistance(refPrice, symbol);
  const buy = side === "BUY";
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

  const order = withAbsoluteStopUnits({ ...body });

  if (stopLoss != null) {
    const slDirOk = buy ? stopLoss < refPrice : stopLoss > refPrice;
    if (sanitized.stopLoss != null) {
      order.stopLoss = sanitized.stopLoss;
    } else if (slDirOk) {
      order.stopLoss = maxClamped.stopLoss ?? stopLoss;
    } else {
      order.stopLoss = adjustStopToMinDistance(
        side,
        refPrice,
        stopLoss,
        dist,
        "sl",
      );
    }
  }

  if (takeProfit != null) {
    const tpDirOk = buy ? takeProfit > refPrice : takeProfit < refPrice;
    if (sanitized.takeProfit != null) {
      order.takeProfit = sanitized.takeProfit;
    } else if (tpDirOk) {
      order.takeProfit = maxClamped.takeProfit ?? takeProfit;
    } else {
      order.takeProfit = adjustStopToMinDistance(
        side,
        refPrice,
        takeProfit,
        dist,
        "tp",
      );
    }
  }

  return order;
}

function buildPendingOrderWithValidatedStops(
  body: MetaApiTradeBody,
): BuiltMarketOrderResult {
  const openPriceRaw = body.openPrice;
  const openPrice =
    typeof openPriceRaw === "number"
      ? openPriceRaw
      : parseFloat(String(openPriceRaw ?? ""));

  if (!Number.isFinite(openPrice) || openPrice <= 0) {
    return { ok: true, order: withAbsoluteStopUnits({ ...body }) };
  }

  return {
    ok: true,
    order: applyStopsForReferencePrice(body, openPrice),
  };
}

/**
 * LIMIT/STOP : SL/TP validés vs openPrice — jamais d'ordre pending sans SL/TP silencieux.
 */
export async function postMetaApiPendingReliable(
  accountId: string,
  body: MetaApiTradeBody,
  token: string,
): Promise<PostMetaApiTradeResult> {
  const built = buildPendingOrderWithValidatedStops(body);
  let result = await postMetaApiTrade(accountId, built.order, token);
  if (result.ok) return result;

  if (
    STOPS_RELATED.test(result.error || "") &&
    (body.stopLoss != null || body.takeProfit != null)
  ) {
    const openPrice =
      typeof body.openPrice === "number"
        ? body.openPrice
        : parseFloat(String(body.openPrice ?? ""));
    if (Number.isFinite(openPrice) && openPrice > 0) {
      const side = parseStopSide(String(body.actionType ?? ""));
      const clamped = clampStopsToBrokerMaxDistance(
        side,
        openPrice,
        body.stopLoss as number,
        body.takeProfit as number,
      );
      const retryOrder = applyStopsForReferencePrice(
        {
          ...body,
          stopLoss: clamped.stopLoss ?? body.stopLoss,
          takeProfit: clamped.takeProfit ?? body.takeProfit,
        },
        openPrice,
      );
      result = await postMetaApiTrade(accountId, retryOrder, token);
    }
  }

  return result;
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

  let result = await postMetaApiTrade(accountId, built.order, token);
  if (result.ok) return result;

  if (STOPS_RELATED.test(result.error || "")) {
    const naked = { ...body };
    delete naked.stopLoss;
    delete naked.takeProfit;
    const bare = await postMetaApiTrade(accountId, naked, token);
    if (bare.ok) return bare;

    const ref = quote
      ? side === "BUY"
        ? quote.ask
        : quote.bid
      : null;

    if (ref != null && Number.isFinite(ref)) {
      const clamped = clampStopsToBrokerMaxDistance(
        side,
        ref,
        body.stopLoss as number,
        body.takeProfit as number,
      );
      const clampOrder: MetaApiTradeBody = {
        ...body,
        ...(clamped.stopLoss != null ? { stopLoss: clamped.stopLoss } : {}),
        ...(clamped.takeProfit != null ? { takeProfit: clamped.takeProfit } : {}),
      };
      result = await postMetaApiTrade(accountId, clampOrder, token);
      if (result.ok) return result;
    }
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

export type MetaApiOpenPosition = {
  id: string;
  symbol: string;
  type: string;
  openPrice?: number;
  takeProfit?: number;
  stopLoss?: number;
  time?: string;
};

export function compactGoldSymbol(sym: string): string {
  const c = sym.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  if (c === "GOLD" || c.startsWith("XAUUSD")) return "XAUUSD";
  return c;
}

export function goldSymbolsEquivalent(a: string, b: string): boolean {
  return compactGoldSymbol(a) === "XAUUSD" && compactGoldSymbol(b) === "XAUUSD";
}

export function brokerSymbolsEquivalent(a: string, b: string): boolean {
  if (a === b) return true;
  if (goldSymbolsEquivalent(a, b)) return true;
  return (
    a.replace(/[^A-Z0-9]/gi, "").toUpperCase() ===
    b.replace(/[^A-Z0-9]/gi, "").toUpperCase()
  );
}

export function signalTypeMatchesPosition(
  signalType: string,
  positionType: string,
): boolean {
  const buy = signalType.toUpperCase() === "BUY";
  const t = positionType.toUpperCase();
  const posBuy = t.includes("BUY") && !t.includes("SELL");
  const posSell = t.includes("SELL");
  if (buy) return posBuy;
  return posSell;
}

export function parseMetaApiOpenPositions(raw: unknown[]): MetaApiOpenPosition[] {
  const out: MetaApiOpenPosition[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const p = row as Record<string, unknown>;
    const id = p.id ?? p.positionId ?? p.ticket;
    const symbol = p.symbol;
    const type = p.type ?? p.side;
    if (id == null || typeof symbol !== "string" || typeof type !== "string") {
      continue;
    }
    const tp = p.takeProfit ?? p.take_profit;
    const sl = p.stopLoss ?? p.stop_loss;
    const op = p.openPrice ?? p.price ?? p.open_price;
    const openPrice =
      typeof op === "number" && Number.isFinite(op)
        ? op
        : typeof op === "string"
          ? parseFloat(op)
          : NaN;
    out.push({
      id: String(id),
      symbol,
      type,
      openPrice: Number.isFinite(openPrice) ? openPrice : undefined,
      takeProfit:
        typeof tp === "number" && Number.isFinite(tp) ? tp : undefined,
      stopLoss:
        typeof sl === "number" && Number.isFinite(sl) ? sl : undefined,
      time:
        typeof p.time === "string"
          ? p.time
          : typeof p.openTime === "string"
            ? p.openTime
            : undefined,
    });
  }
  return out;
}

export function findMatchingOpenPosition(
  positions: MetaApiOpenPosition[],
  brokerSymbol: string,
  signalType: string,
  takeProfit?: number | null,
): MetaApiOpenPosition | null {
  const tp =
    takeProfit != null && Number.isFinite(Number(takeProfit))
      ? Number(takeProfit)
      : NaN;
  for (const p of positions) {
    if (!brokerSymbolsEquivalent(brokerSymbol, p.symbol)) continue;
    if (!signalTypeMatchesPosition(signalType, p.type)) continue;
    if (
      Number.isFinite(tp) &&
      p.takeProfit != null &&
      Number.isFinite(p.takeProfit) &&
      Math.abs(p.takeProfit - tp) >= 5
    ) {
      continue;
    }
    return p;
  }
  return null;
}

/** Modifie SL/TP d'une position ouverte (multi-région MetaAPI). */
export async function postMetaApiModifyPosition(
  accountId: string,
  positionId: string,
  token: string,
  stops: { stopLoss?: number; takeProfit?: number },
): Promise<PostMetaApiTradeResult> {
  const body: MetaApiTradeBody = {
    actionType: "POSITION_MODIFY",
    positionId: String(positionId),
    stopLossUnits: "ABSOLUTE_PRICE",
    takeProfitUnits: "ABSOLUTE_PRICE",
  };
  if (stops.stopLoss != null && Number.isFinite(stops.stopLoss)) {
    body.stopLoss = stops.stopLoss;
  }
  if (stops.takeProfit != null && Number.isFinite(stops.takeProfit)) {
    body.takeProfit = stops.takeProfit;
  }
  return postMetaApiTrade(accountId, body, token);
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
