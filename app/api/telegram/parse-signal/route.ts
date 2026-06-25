import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireInternalSecret } from "@/lib/internal-auth";
import {
  cancelOrCloseSignalTrades,
  isCancelOrCutCommand,
  resolveSignalIdForCancel,
} from "@/lib/telegram-cancel-signal";
import { resolveBrokerSymbol } from "@/lib/broker-symbol-resolver";
import {
  applyLotMultiplier,
  checkTradeRisk,
  volumeFromEquityPercent,
  type TradingRiskSettings,
} from "@/lib/trade-risk";
import {
  applySlTpUpdatesForSignal,
  detectSlTpUpdateMessage,
  resolveSignalIdForPositionUpdate,
} from "@/lib/telegram-position-updates";
import { fetchMetaApiAccountEquity } from "@/lib/metaapi-trade-client";
import {
  effectiveUserVolumeForIndexSplit,
  lotStepForStandard,
  volumePerTpForStandard,
} from "@/lib/trade-volume";
import {
  lotSettingKeyForSymbol,
  normalizeSymbol,
  isKnownTradingSymbol,
} from "@/lib/symbol-normalizer";
import { parseLocaleNumber, parseLocaleNumberOr } from "@/lib/locale-number";
import { resolveOrderTypeFromMessage, resolvePendingOrderKind } from "@/lib/order-type";

/** Déduplique les TP (évite 9 positions si le parser renvoie des doublons). */
function dedupeTakeProfits(values: number[]): number[] {
  const seen = new Set<string>();
  const out: number[] = [];
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    const key = v.toFixed(5);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

export async function POST(request: NextRequest) {
  const authError = requireInternalSecret(request);
  if (authError) return authError;

  try {
    const {
      channelId,
      channelUsername,
      messageText,
      messageId,
      replyToMessageId,
    } = await request.json();

    if ((!channelId && !channelUsername) || !messageText || !messageId) {
      return NextResponse.json(
        { error: "Paramètres manquants" },
        { status: 400 },
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Trouver le canal avec un token actif
    let query = supabase
      .from("telegram_channels")
      .select(
        `
        id,
        username,
        telegram_bot_tokens!inner(bot_token, is_active)
      `,
      )
      .eq("telegram_bot_tokens.is_active", true)
      .eq("is_active", true);

    if (channelId) {
      query = query.eq("id", channelId);
    } else {
      query = query.eq("username", channelUsername);
    }

    const { data: channel } = await query.single();

    if (!channel) {
      return NextResponse.json(
        { error: "Canal non trouvé ou sans token actif" },
        { status: 404 },
      );
    }

    if (isCancelOrCutCommand(messageText)) {
      console.log(
        `⚠️ Fermeture / annulation détectée dans ${channel.username}: "${messageText}"${replyToMessageId ? ` (reply ${replyToMessageId})` : ""}`,
      );

      const metaToken = process.env.METAAPI_TOKEN;
      if (!metaToken) {
        return NextResponse.json(
          { success: false, error: "METAAPI_TOKEN non configuré" },
          { status: 500 },
        );
      }

      const signalIdToCancel = await resolveSignalIdForCancel(
        supabase,
        channel.id,
        replyToMessageId,
      );

      if (!signalIdToCancel) {
        console.log("❌ Aucun signal récent à annuler / couper");
        return NextResponse.json({
          success: true,
          message: "Aucun signal récent à annuler",
        });
      }

      const outcome = await cancelOrCloseSignalTrades(
        supabase,
        signalIdToCancel,
        metaToken,
      );

      console.log(
        `✅ Signal ${signalIdToCancel}: ${outcome.dbCancelled} DB annulé(s), ${outcome.positionsClosed} position(s) fermée(s), ${outcome.ordersCancelled} ordre(s) pending annulé(s)`,
      );
      if (outcome.errors.length) {
        console.warn("⚠️ Erreurs annulation:", outcome.errors.slice(0, 5));
      }

      return NextResponse.json({
        success: true,
        message: `${outcome.dbCancelled} trade(s) annulé(s), ${outcome.positionsClosed} position(s) fermée(s), ${outcome.ordersCancelled} ordre(s) retiré(s)`,
        signal_id: signalIdToCancel,
        ...outcome,
      });
    }

    // SL/TP/BE updates — reply au signal ou dernier signal exécuté (24h)
    const slTpUpdate = detectSlTpUpdateMessage(messageText);

    if (slTpUpdate.hasUpdate) {
      const signalIdToUpdate = await resolveSignalIdForPositionUpdate(
        supabase,
        channel.id,
        replyToMessageId,
      );

      if (!signalIdToUpdate) {
        console.log("⚠️ Mise à jour SL/TP/BE: aucun signal récent avec positions");
        return NextResponse.json({
          success: true,
          message: "Aucune position récente à mettre à jour",
        });
      }

      const metaToken = process.env.METAAPI_TOKEN;
      if (!metaToken) {
        return NextResponse.json(
          { success: false, error: "METAAPI_TOKEN non configuré" },
          { status: 500 },
        );
      }

      const { updated, skipped } = await applySlTpUpdatesForSignal(
        supabase,
        signalIdToUpdate,
        metaToken,
        slTpUpdate,
      );

      console.log(
        `✅ SL/TP/BE signal ${signalIdToUpdate}: ${updated} modifié(s), ${skipped} ignoré(s)${replyToMessageId ? "" : " (fallback dernier signal)"}`,
      );

      return NextResponse.json({
        success: true,
        message: `${updated} position(s) SL/TP mises à jour`,
        signal_id: signalIdToUpdate,
        updated,
        skipped,
      });
    }

    // Parser le signal
    console.log(
      `📨 Parsing signal from ${channelUsername}:`,
      messageText.substring(0, 100),
    );
    const signal = await parseSignal(messageText);

    if (!signal) {
      console.log(`❌ Pas de signal détecté dans le message`);
      return NextResponse.json({
        success: true,
        message: "Pas de signal détecté",
      });
    }

    if (!signal.isPartialClose && !isKnownTradingSymbol(signal.symbol)) {
      console.log(`❌ Symbole non tradable ignoré: ${signal.symbol}`);
      return NextResponse.json({
        success: true,
        message: `Symbole non tradable ignoré: ${signal.symbol}`,
      });
    }

    console.log(`✅ Signal parsé:`, signal);

    // GÉRER LES FERMETURES PARTIELLES (TP Hit, Prendre Profit)
    if (signal.isPartialClose) {
      console.log(
        `📉 Commande de fermeture partielle détectée (${signal.closePercent}%)`,
      );
      let signalIdToClose = null;

      if (replyToMessageId) {
        const { data: originalSignal } = await supabase
          .from("telegram_signals")
          .select("id")
          .eq("channel_id", channel.id)
          .eq("message_id", replyToMessageId)
          .maybeSingle();
        if (originalSignal) signalIdToClose = originalSignal.id;
      }

      if (!signalIdToClose) {
        const { data: lastExecutedTrade } = await supabase
          .from("telegram_trades")
          .select("signal_id")
          .eq("status", "executed")
          .order("executed_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastExecutedTrade) signalIdToClose = lastExecutedTrade.signal_id;
      }

      if (signalIdToClose) {
        // Marquer les trades pour fermeture partielle
        // Note: L'exécution réelle se fera via execute-trades
        const { data: tradesToPartial } = await supabase
          .from("telegram_trades")
          .update({
            status: "pending_partial",
            partial_close_percent: signal.closePercent ?? 50,
            error_message: `Fermeture partielle ${signal.closePercent ?? 50}% demandée`,
          })
          .eq("signal_id", signalIdToClose)
          .eq("status", "executed")
          .select();

        return NextResponse.json({
          success: true,
          message: `${tradesToPartial?.length || 0} trade(s) en attente de fermeture partielle (${signal.closePercent}%)`,
        });
      }
    }

    // Déduplication message Telegram (webhook retry / double POST)
    const { data: existingSignal } = await supabase
      .from("telegram_signals")
      .select("id")
      .eq("channel_id", channel.id)
      .eq("message_id", messageId)
      .maybeSingle();

    if (existingSignal?.id) {
      console.log(`⏭️ Signal déjà traité (message_id ${messageId})`);
      return NextResponse.json({
        success: true,
        message: "Signal déjà traité",
        signal_id: existingSignal.id,
      });
    }

    // order_type : MARKET sauf buy/sell limit|stop explicite dans le message
    const resolvedOrderType = resolveOrderTypeFromMessage(messageText);
    const isMarketOrder = resolvedOrderType === "MARKET";

    const takeProfitsForSave = dedupeTakeProfits(signal.takeProfits || []);

    // Évite double exécution si webhook/curl rejoué (même signal, message_id différent)
    const dedupSince = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    let recentDupQuery = supabase
      .from("telegram_signals")
      .select("id")
      .eq("channel_id", channel.id)
      .eq("signal_type", signal.type)
      .eq("symbol", signal.symbol)
      .gte("parsed_at", dedupSince)
      .limit(1);

    if (signal.entryPrice != null) {
      recentDupQuery = recentDupQuery.eq("entry_price", signal.entryPrice);
    } else {
      recentDupQuery = recentDupQuery.is("entry_price", null);
    }

    const { data: recentDup } = await recentDupQuery.maybeSingle();
    if (recentDup?.id) {
      console.log(
        `⏭️ Signal dupliqué ignoré (< 3 min): ${signal.type} ${signal.symbol}`,
      );
      return NextResponse.json({
        success: true,
        message: "Signal dupliqué ignoré",
        signal_id: recentDup.id,
      });
    }

    // Sauvegarder le signal
    const { data: savedSignal, error } = await supabase
      .from("telegram_signals")
      .insert({
        channel_id: channel.id,
        message_id: messageId,
        signal_type: signal.type,
        symbol: signal.symbol,
        entry_price: isMarketOrder ? null : signal.entryPrice,
        stop_loss: signal.stopLoss,
        take_profit: signal.takeProfit,
        // Store all TP values so we can create one trade per TP later
        all_tp: takeProfitsForSave.length > 0 ? takeProfitsForSave : null,
        volume: signal.volume || 0.01,
        message_text: messageText,
        order_type: resolvedOrderType,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({
          success: true,
          message: "Signal déjà traité",
        });
      }
      console.error("Error saving signal:", error);
      return NextResponse.json({ error: "Erreur sauvegarde" }, { status: 500 });
    }

    // Exécuter les trades pour tous les utilisateurs abonnés
    console.log(`🔄 Création des trades pour le signal ${savedSignal.id}`);
    await executeTradesForSignal(savedSignal.id);

    // Exécuter immédiatement (+ 2e passe si trades encore pending)
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const secret = process.env.INTERNAL_API_SECRET;
      if (secret) {
        for (let pass = 0; pass < 2; pass++) {
          await fetch(`${baseUrl}/api/telegram/execute-trades`, {
            method: "POST",
            headers: { Authorization: `Bearer ${secret}` },
          });
          if (pass === 0) {
            await new Promise((r) => setTimeout(r, 3500));
            const supabase = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!,
            );
            const { count } = await supabase
              .from("telegram_trades")
              .select("id", { count: "exact", head: true })
              .eq("signal_id", savedSignal.id)
              .in("status", ["pending", "pending_partial"]);
            if ((count ?? 0) === 0) break;
          }
        }
      }
    } catch (error) {
      console.error("Error triggering trade execution:", error);
    }

    return NextResponse.json({
      success: true,
      signal: savedSignal,
      message: "Signal traité avec succès",
    });
  } catch (error: any) {
    console.error("Error parsing signal:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function parseSignal(messageText: string) {
  // TOUJOURS utiliser OpenAI si disponible (beaucoup plus robuste)
  if (process.env.OPENAI_API_KEY) {
    try {
      const aiParsed = await parseSignalWithAI(messageText);
      if (aiParsed) {
        const orderType = resolveOrderTypeFromMessage(messageText);
        console.log("✅ Signal parsé avec AI:", { ...aiParsed, orderType });
        return { ...aiParsed, orderType };
      }
    } catch (error) {
      console.warn("⚠️ Erreur parsing AI, fallback sur regex:", error);
    }
  } else {
    console.warn(
      "⚠️ OPENAI_API_KEY non configuré, utilisation du parsing regex basique",
    );
  }

  // Fallback: Patterns regex pour détecter les signaux (moins robuste mais utile si pas d'AI)
  const patterns = [
    // Pattern 1: BUY XAUUSD @ 2650.50 SL: 2640 TP: 2670
    /(BUY|SELL|ACHAT|VENTE|LONG|SHORT)\s+([A-Z0-9./]+)\s+@\s*([\d.]+)\s+SL:?\s*([\d.]+)\s+TP:?\s*([\d.]+)/i,
    // Pattern 2: 🟢 BUY GOLD 2650.50 SL 2640 TP 2670
    /[🟢🔴✅❌]\s*(BUY|SELL|ACHAT|VENTE|LONG|SHORT)\s+([A-Z0-9./]+)\s+([\d.]+)\s+SL\s+([\d.]+)\s+TP\s+([\d.]+)/i,
    // Pattern 3: Signal: BUY EURUSD Entry: 1.0850 SL: 1.0800 TP: 1.0900
    /(?:Signal|SIGNAL):\s*(BUY|SELL|ACHAT|VENTE|LONG|SHORT)\s+([A-Z0-9./]+)\s+(?:Entry|ENTRY|@):\s*([\d.]+)\s+SL:?\s*([\d.]+)\s+TP:?\s*([\d.]+)/i,
    // Pattern 4: BUY XAUUSD 2650.50 SL 2640 TP 2670 (sans @)
    /(BUY|SELL|ACHAT|VENTE|LONG|SHORT)\s+([A-Z0-9./]+)\s+([\d.]+)\s+SL\s+([\d.]+)\s+TP\s+([\d.]+)/i,
    // Pattern 5: XAUUSD BUY @2650.50 SL:2640 TP:2670
    /([A-Z0-9./]+)\s+(BUY|SELL|ACHAT|VENTE|LONG|SHORT)\s+@?\s*([\d.]+)\s+SL:?\s*([\d.]+)\s+TP:?\s*([\d.]+)/i,
    // Pattern 6: BUY XAUUSD (sans prix, market order)
    /(BUY|SELL|ACHAT|VENTE|LONG|SHORT)\s+([A-Z0-9./]+)(?:\s|$)/i,
    // Pattern 7: BUY XAUUSD SL 2640 TP 2670 (sans entry price)
    /(BUY|SELL|ACHAT|VENTE|LONG|SHORT)\s+([A-Z0-9./]+)\s+SL\s+([\d.]+)\s+TP\s+([\d.]+)/i,
    // Pattern 8: Multiple TP - BUY XAUUSD TP1:2670 TP2:2680 TP3:2690
    /(BUY|SELL|ACHAT|VENTE|LONG|SHORT)\s+([A-Z0-9./]+).*?TP\d*:?\s*([\d.]+).*?TP\d*:?\s*([\d.]+)/i,
    // Pattern 9: Buy limit gold 4832.5-4833
    /(BUY|SELL|ACHAT|VENTE)\s+(?:LIMIT|LIMITE|STOP)\s+([A-Z0-9./]+)\s+([\d.,\s-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = messageText.match(pattern);
    if (match) {
      // Détecter l'ordre des groupes selon le pattern
      let type, symbol, entryPrice, stopLoss, takeProfit;
      let takeProfits: number[] = [];

      // Normaliser le type (BUY/SELL/ACHAT/LONG → BUY, VENTE/SHORT → SELL)
      const normalizeType = (t: string) => {
        const upper = t.toUpperCase();
        if (upper.match(/^(BUY|ACHAT|LONG|🟢|✅)$/)) return "BUY";
        if (upper.match(/^(SELL|VENTE|SHORT|🔴|❌)$/)) return "SELL";
        return upper;
      };

      // Si le symbole matché est "LIMIT" ou "STOP", c'est probablement une erreur de capture
      // On tente de nettoyer le symbole
      const cleanSymbol = (s: string) => {
        let sym = s.toUpperCase().trim();
        // Si le symbole capturé est un mot clé de type d'ordre, on essaie de trouver le vrai symbole après
        if (sym === "LIMIT" || sym === "STOP") {
          // On cherche un mot de 3 à 7 lettres qui ne soit pas un mot clé
          const words = messageText.split(/\s+/);
          const potentialSymbol = words.find(
            (w) =>
              w.length >= 3 &&
              w.length <= 8 &&
              !["BUY", "SELL", "LIMIT", "STOP", "ACHAT", "VENTE"].includes(
                w.toUpperCase(),
              ),
          );
          if (potentialSymbol) sym = potentialSymbol.toUpperCase();
        }
        return sym.replace(/[\/_]/g, "");
      };

      // Pattern avec multiple TP (TP1, TP2, TP3) ou format limit/stop
      if (pattern.source.includes("TP\\d")) {
        type = normalizeType(match[1]);
        symbol = cleanSymbol(match[2]);
        entryPrice = null;
      } else if (
        match[1].match(/^(BUY|SELL|ACHAT|VENTE|LONG|SHORT|🟢|🔴|✅|❌)$/i)
      ) {
        type = normalizeType(match[1]);
        symbol = cleanSymbol(match[2]);
        if (match[3] && /[\d]/.test(match[3])) {
          const parts = String(match[3])
            .split(/[-–—]/)
            .map((p) => parseLocaleNumber(p.trim()))
            .filter((n) => Number.isFinite(n));
          const isSell = type === "SELL";
          entryPrice =
            parts.length > 1
              ? isSell
                ? parts[parts.length - 1]
                : parts[0]
              : parts[0] ?? null;
        } else {
          entryPrice = match[3] ? parseFloat(match[3]) : null;
        }
        stopLoss = match[4] ? parseFloat(match[4]) : null;
        takeProfit = match[5] ? parseFloat(match[5]) : null;
        takeProfits = takeProfit ? [takeProfit] : [];
      } else {
        symbol = cleanSymbol(match[1]);
        type = normalizeType(match[2]);
        entryPrice = match[3] ? parseFloat(match[3]) : null;
        stopLoss = match[4] ? parseFloat(match[4]) : null;
        takeProfit = match[5] ? parseFloat(match[5]) : null;
        takeProfits = takeProfit ? [takeProfit] : [];
      }

      const slFromMsg =
        messageText.match(/\bS\/?L\b[:=\s]*([\d.,]+)/i) ||
        messageText.match(/\bSL\b[:=\s]*([\d.,]+)/i);
      if (slFromMsg?.[1]) {
        stopLoss = parseLocaleNumber(slFromMsg[1]);
      }

      const tpFromMsg = Array.from(
        messageText.matchAll(/\bTP\d*\b[:=\s]*([\d.,]+)/gi) as any,
      )
        .map((m: any) =>
          m?.[1] ? parseLocaleNumber(String(m[1])) : Number.NaN,
        )
        .filter((v: number) => Number.isFinite(v));

      if (tpFromMsg.length > 0) {
        takeProfits = dedupeTakeProfits(tpFromMsg);
        const sorted = [...takeProfits].sort((a, b) => a - b);
        takeProfit =
          sorted.length > 0
            ? type === "BUY"
              ? sorted[sorted.length - 1]
              : sorted[0]
            : null;
      } else if (!takeProfit) {
        const tpGeneric = messageText.match(/\bTP\b[:=\s]*([\d.,]+)/i);
        if (tpGeneric?.[1]) {
          takeProfit = parseLocaleNumber(tpGeneric[1]);
          takeProfits = [takeProfit];
        }
      }

      let orderType: string = resolveOrderTypeFromMessage(messageText);

      // Validation minimale: type et symbol requis
      if (type && symbol && symbol !== "LIMIT" && symbol !== "STOP") {
        return {
          type,
          symbol: normalizeSymbol(symbol),
          entryPrice: entryPrice || null,
          stopLoss: stopLoss || null,
          takeProfit: takeProfit || null,
          takeProfits: takeProfits || [],
          orderType,
          volume: 0.01,
        };
      }
    }
  }

  return null;
}

/**
 * Parse un signal avec OpenAI pour une meilleure compréhension du contexte
 * Gère tous les types d'ordres: Market, Limit, Stop, etc.
 */
async function parseSignalWithAI(messageText: string): Promise<any | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Tu es un expert en parsing de signaux de trading MT5/Telegram. Extrais les infos d'un message, PEU IMPORTE le format (FR/EN, emojis, lignes séparées).

RÈGLE TP MULTIPLES (CRITIQUE):
- Si plusieurs TP (TP1, TP2, Tp1, TP: 2670, etc.), EXTRAIS-TOUS dans "takeProfits" dans l'ordre du message.
- Chaque TP deviendra une position séparée côté exécution — ne fusionne jamais en un seul TP.

TYPE & ORDRE (CRITIQUE):
- type: "BUY" ou "SELL" (ACHAT/LONG/🟢 → BUY ; VENTE/SHORT/🔴 → SELL)
- orderType: presque toujours "MARKET"
- LIMIT ou STOP UNIQUEMENT si écrit explicitement : "buy limit", "sell limit", "buy stop", "sell stop" (ou achat/vente + limite/stop)
- Un prix d'entrée ("Entrée:", "Entry:", @ prix) NE change PAS le type → reste MARKET sauf limit/stop explicite
- Plage d'entrée "4832.5-4833" avec "buy limit" → entryPrice = premier pour BUY, dernier pour SELL

SYMBOLES — normalise vers ces clés:
- Or: GOLD (alias: XAUUSD, XAU/USD, GOLD, OR, gold)
- Crypto: BTC, ETH, SOL30 (alias: BTCUSD, ETHUSD, SOL, SOLUSD)
- Indices: US30 (Dow,DJ30), NAS100 (Nasdaq,USTEC), SPX500 (S&P500), GER40 (DAX), UK100 (FTSE)
- Forex: EURUSD, GBPUSD, USDJPY, USDCHF, USDCAD, AUDUSD, NZDUSD + croisées EURGBP, EURJPY, GBPJPY, EURCHF, GBPCHF, CHFJPY, CADJPY, AUDJPY, NZDJPY, AUDCAD, AUDCHF, AUDNZD, CADCHF, EURAUD, EURCAD, EURNZD, GBPAUD, GBPCAD, GBPNZD, NZDCAD, NZDCHF
- Exotiques si présents: USDTRY, EURTRY, USDZAR, GBPZAR, USDMXN, USDSGD, USDCNH, USDHKD, USDNOK, USDSEK, USDDKK, EURNOK, EURSEK, EURPLN
- Accepte EUR/USD, XAU/USD avec slash

SL / TP:
- SL, S/L, Sl, stop loss → stopLoss (nombre)
- TP, TP1, TP2, Tp1, take profit → takeProfits[] (tous les niveaux)
- Virgule ou point décimal acceptés

MISES À JOUR (si message de suivi — géré ailleurs, mais reconnais):
- BE, break even, SL to BE → pas un nouveau signal d'ouverture

FERMETURES PARTIELLES:
- "TP HIT", "PRENDRE PROFIT", "CLOSE HALF", "SÉCURISER" → isPartialClose: true
- closePercent: cherche 25%, 50%, 75% ; "CLOSE HALF" = 50 ; défaut 50

FERMETURE TOTALE (reply au signal — géré avant toi, réponds null):
- SORTER, SORTEZ, SORTIR, FERMER, CLOSE, COUPER, CUT, ANNULEZ
- "SORTER -10 Pips" = sortir / fermer la position (le "-10 Pips" est informatif, pas un %)

JSON UNIQUEMENT (ou null si type+symbol impossibles):
{
  "type": "BUY",
  "orderType": "MARKET",
  "symbol": "GOLD",
  "entryPrice": 4832.5,
  "stopLoss": 4828.5,
  "takeProfits": [4841, 4868.7],
  "isPartialClose": false,
  "closePercent": null
}`,
          },
          {
            role: "user",
            content: messageText,
          },
        ],
        temperature: 0.1,
        max_tokens: 300,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", data);
      return null;
    }

    const content = data.choices[0]?.message?.content;
    console.log("🤖 OpenAI Raw Response:", content);

    if (!content) {
      return null;
    }

    // Nettoyer le contenu (enlever markdown code blocks si présent)
    let cleanContent = content.trim();
    if (cleanContent.startsWith("```")) {
      cleanContent = cleanContent
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
    }

    // Parser le JSON
    let parsed;
    try {
      parsed = JSON.parse(cleanContent);
      console.log("📊 OpenAI Parsed JSON:", parsed);
    } catch (e) {
      console.error("Error parsing AI JSON:", e, "Content:", cleanContent);
      return null;
    }

    // Validation minimale: type et symbol requis
    if (!parsed || !parsed.type || !parsed.symbol) {
      return null;
    }

    // Normalize take profits:
    // - If AI returned `takeProfits` use that array
    // - If AI returned only `takeProfit`, convert it to an array of length 1
    const takeProfitsRaw = Array.isArray(parsed.takeProfits)
      ? parsed.takeProfits
      : parsed.takeProfit
        ? [parsed.takeProfit]
        : [];

    const takeProfits = dedupeTakeProfits(
      (takeProfitsRaw || [])
        .map((v: any) =>
          v !== null && v !== undefined ? parseLocaleNumber(v) : null,
        )
        .filter(
          (v: number | null): v is number =>
            typeof v === "number" && !Number.isNaN(v),
        ),
    );

    const sorted = [...takeProfits].sort((a: number, b: number) => a - b);
    const takeProfit =
      sorted.length > 0
        ? parsed.type.toUpperCase() === "BUY"
          ? sorted[sorted.length - 1]
          : sorted[0]
        : null;

    const entryPriceNorm = parsed.entryPrice
      ? parseLocaleNumber(parsed.entryPrice)
      : Number.NaN;
    const stopLossNorm = parsed.stopLoss
      ? parseLocaleNumber(parsed.stopLoss)
      : Number.NaN;

    const orderType = resolveOrderTypeFromMessage(messageText);

    return {
      type: parsed.type.toUpperCase(),
      symbol: normalizeSymbol(parsed.symbol),
      entryPrice: Number.isFinite(entryPriceNorm) ? entryPriceNorm : null,
      stopLoss: Number.isFinite(stopLossNorm) ? stopLossNorm : null,
      takeProfit,
      takeProfits,
      orderType,
      volume: parsed.volume ? parseLocaleNumberOr(parsed.volume, 0.01) : 0.01,
      isPartialClose: parsed.isPartialClose || false,
      closePercent: parsed.closePercent || 50,
    };
  } catch (error) {
    console.error("Error parsing with AI:", error);
    return null;
  }
}

async function executeTradesForSignal(signalId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Ne pas releaseStale ici : ça remettait des BUY en pending quand un SELL arrivait → doublons Vantage.

  // Récupérer les données du signal
  const { data: signal } = await supabase
    .from("telegram_signals")
    .select(
      "id, channel_id, signal_type, symbol, entry_price, stop_loss, take_profit, all_tp, volume, order_type",
    )
    .eq("id", signalId)
    .single();

  if (!signal) {
    console.error("Signal non trouvé:", signalId);
    return;
  }

  // Récupérer tous les utilisateurs abonnés à ce canal spécifique
  const { data: subscriptions } = await supabase
    .from("user_telegram_subscriptions")
    .select("user_id")
    .eq("channel_id", signal.channel_id)
    .eq("is_active", true);

  if (!subscriptions || subscriptions.length === 0) {
    console.log(`⚠️ Aucun utilisateur abonné au canal ${signal.channel_id}`);
    return;
  }

  console.log(`👥 ${subscriptions.length} utilisateur(s) abonné(s) au canal`);

  // Vérifier les abonnements actifs des utilisateurs
  const { data: activeSubscriptions } = await supabase
    .from("subscriptions")
    .select("user_id")
    .in(
      "user_id",
      subscriptions.map((s: any) => s.user_id),
    )
    .in("status", ["active", "trialing"]);

  const activeUserIds = new Set(
    activeSubscriptions?.map((s: any) => s.user_id) || [],
  );

  // Normaliser le symbole du signal (XAUUSD -> GOLD, etc.)
  const normalizedSymbol = normalizeSymbol(signal.symbol);

  // TP multiple support:
  // - If `all_tp` exists, use it as the TP list
  // - Otherwise fallback to the legacy single `take_profit`
  const rawAllTp = (signal as any).all_tp;
  const takeProfits = dedupeTakeProfits(
      (() => {
        if (Array.isArray(rawAllTp)) {
          return rawAllTp
            .map((v) =>
              v !== null && v !== undefined ? parseFloat(v as any) : NaN,
            )
            .filter((v) => !Number.isNaN(v));
        }
        if (typeof rawAllTp === "string") {
          try {
            const parsed = JSON.parse(rawAllTp);
            if (Array.isArray(parsed)) {
              return parsed
                .map((v) =>
                  v !== null && v !== undefined ? parseFloat(v) : NaN,
                )
                .filter((v) => !Number.isNaN(v));
            }
          } catch {
            // ignore
          }
        }
        const tp = signal.take_profit
          ? parseFloat(signal.take_profit as any)
          : NaN;
        return !Number.isNaN(tp) ? [tp] : [];
      })(),
  );

  // For market orders without TP, we still create exactly one trade (take_profit = null)
  const tpValues: Array<number | null> =
    takeProfits.length > 0
      ? takeProfits
      : [
          signal.take_profit
            ? parseFloat(signal.take_profit as any) || null
            : null,
        ];

  console.log(`✅ ${activeUserIds.size} utilisateur(s) avec abonnement actif`);

  // Pour chaque utilisateur, créer un trade
  for (const subscription of subscriptions) {
    // Vérifier que l'utilisateur a un abonnement actif
    if (!activeUserIds.has(subscription.user_id)) {
      console.log(
        `⚠️ Utilisateur ${subscription.user_id} n'a pas d'abonnement actif`,
      );
      continue;
    }

    // Récupérer le compte MT5 et les paramètres de trading de l'utilisateur
    const { data: mt5Account } = await supabase
      .from("mt5_accounts")
      .select("id, metaapi_account_id, broker_name, symbol_profile")
      .eq("user_id", subscription.user_id)
      .eq("is_active", true)
      .not("metaapi_account_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!mt5Account?.metaapi_account_id) {
      console.log(
        `⚠️ Pas de compte MT5 actif pour l'utilisateur ${subscription.user_id}`,
      );
      continue;
    }

    console.log(
      `✅ Compte MT5 trouvé pour user ${subscription.user_id}: ${mt5Account.broker_name}`,
    );

    // Récupérer les paramètres de trading de l'utilisateur
    const { data: tradingSettings } = await supabase
      .from("trading_settings")
      .select("*")
      .eq("user_id", subscription.user_id)
      .single();

    const riskSettings = (tradingSettings ?? null) as TradingRiskSettings | null;

    let userVolume = parseLocaleNumberOr(signal.volume, 0.01);

    if (tradingSettings) {
      if (tradingSettings.position_sizing_type === "lot") {
        const key = lotSettingKeyForSymbol(normalizedSymbol);
        userVolume = key
          ? parseLocaleNumberOr(tradingSettings[key], 0.01)
          : 0.01;
      } else if (tradingSettings.position_sizing_type === "percentage") {
        const token = process.env.METAAPI_TOKEN;
        let equity: number | null = null;
        if (token && mt5Account.metaapi_account_id) {
          equity = await fetchMetaApiAccountEquity(
            mt5Account.metaapi_account_id,
            token,
          );
        }
        const pct = parseLocaleNumberOr(
          tradingSettings.equity_risk_percent ??
            tradingSettings.position_percentage,
          1,
        );
        userVolume = volumeFromEquityPercent(equity ?? 10000, pct);
        const { min: minLot } = lotStepForStandard(normalizedSymbol);
        if (userVolume < minLot) userVolume = minLot;
      }
    }

    userVolume = applyLotMultiplier(userVolume, riskSettings);

    const brokerSymbol = await resolveBrokerSymbol(
      normalizedSymbol,
      mt5Account.broker_name,
      supabase,
      {
        metaApiAccountId: mt5Account.metaapi_account_id,
        metaApiToken: process.env.METAAPI_TOKEN ?? null,
        symbolProfile:
          (mt5Account.symbol_profile as "auto" | "ecn" | "stp") ?? "auto",
      },
    );

    console.log(
      `✅ Symbole: ${signal.symbol} → ${normalizedSymbol} → ${brokerSymbol}`,
    );

    const { count: existingForSignal } = await supabase
      .from("telegram_trades")
      .select("id", { count: "exact", head: true })
      .eq("user_id", subscription.user_id)
      .eq("signal_id", signalId)
      .eq("mt5_account_id", mt5Account.id)
      .in("status", [
        "pending",
        "pending_partial",
        "executed",
        "executing",
      ]);

    if ((existingForSignal ?? 0) >= tpValues.length) {
      console.log(
        `⏭️ ${existingForSignal} trade(s) déjà créés pour signal ${signalId} (user ${subscription.user_id})`,
      );
      continue;
    }

    const { count: openCount } = await supabase
      .from("telegram_trades")
      .select("id", { count: "exact", head: true })
      .eq("user_id", subscription.user_id)
      .eq("status", "executed");
    // Sinon : un trade par TP (forex / index en LIMIT, ou 1 seul TP).
    const tpCount = tpValues.length;
    const entryN = parseLocaleNumber(signal.entry_price);
    const orderTypeResolved = resolvePendingOrderKind(
      signal.order_type,
      signal.order_type,
      entryN,
    );

    const effectiveUserVolume = effectiveUserVolumeForIndexSplit(
      normalizedSymbol,
      userVolume,
      tpCount,
    );

    // 1 position MetaAPI par TP (forex, indices, métaux — tous types d'ordres)
    for (let i = 0; i < tpValues.length; i++) {
      const tpValue = tpValues[i];

      const volumeForTp = volumePerTpForStandard(
        normalizedSymbol,
        effectiveUserVolume,
        tpCount,
        i,
      );

      const risk = checkTradeRisk({
        standardSymbol: normalizedSymbol,
        volume: volumeForTp,
        openPositionCount: (openCount ?? 0) + i,
        settings: riskSettings,
      });
      if (!risk.allowed) {
        console.log(
          `⛔ Trade bloqué user ${subscription.user_id}: ${risk.reason}`,
        );
        await supabase.from("telegram_trades").insert({
          user_id: subscription.user_id,
          signal_id: signalId,
          mt5_account_id: mt5Account.id,
          symbol: brokerSymbol,
          signal_type: signal.signal_type,
          order_type: orderTypeResolved,
          volume: volumeForTp,
          entry_price: orderTypeResolved === "MARKET" ? null : signal.entry_price,
          stop_loss: signal.stop_loss,
          take_profit: tpValue,
          status: "failed",
          error_message: risk.reason,
        });
        continue;
      }

      let existingQuery: any = supabase
        .from("telegram_trades")
        .select("id")
        .eq("user_id", subscription.user_id)
        .eq("signal_id", signalId)
        .eq("mt5_account_id", mt5Account.id)
        .in("status", [
          "pending",
          "pending_partial",
          "executed",
          "executing",
        ]);

      existingQuery =
        tpValue === null
          ? existingQuery.is("take_profit", null)
          : existingQuery.eq("take_profit", tpValue);

      const { data: existingTrade } = await existingQuery
        .limit(1)
        .maybeSingle();
      if (existingTrade) {
        console.log(
          `⏭️ Trade déjà existant (user ${subscription.user_id}, TP ${tpValue ?? "null"})`,
        );
        continue;
      }

      const { error } = await supabase.from("telegram_trades").insert({
        user_id: subscription.user_id,
        signal_id: signalId,
        mt5_account_id: mt5Account.id,
        symbol: brokerSymbol,
        signal_type: signal.signal_type,
        order_type: orderTypeResolved,
        volume: volumeForTp,
        entry_price: orderTypeResolved === "MARKET" ? null : signal.entry_price,
        stop_loss: signal.stop_loss,
        take_profit: tpValue,
        status: "pending",
      });

      if (error) {
        console.error(
          `❌ Erreur création trade pour user ${subscription.user_id} (TP ${tpValue ?? "null"}):`,
          error,
        );
      } else {
        console.log(
          `✅ Trade créé pour user ${subscription.user_id}: ${brokerSymbol} ${volumeForTp} lots (TP ${tpValue ?? "null"})`,
        );
      }
    }
  }
}
