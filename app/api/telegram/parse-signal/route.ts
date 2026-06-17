import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isMetaApiTradeSuccess } from "@/lib/metaapi-trade-client";
import { resolveBrokerSymbol } from "@/lib/broker-symbol-resolver";
import {
  applyLotMultiplier,
  checkTradeRisk,
  volumeFromEquityPercent,
  type TradingRiskSettings,
} from "@/lib/trade-risk";
import { fetchMetaApiAccountEquity } from "@/lib/metaapi-trade-client";
import {
  effectiveUserVolumeForIndexSplit,
  lotStepForStandard,
  volumePerTpForStandard,
} from "@/lib/trade-volume";
import {
  lotSettingKeyForSymbol,
  normalizeSymbol,
} from "@/lib/symbol-normalizer";
import { parseLocaleNumber, parseLocaleNumberOr } from "@/lib/locale-number";
import { resolvePendingOrderKind } from "@/lib/order-type";
import { requireInternalSecret } from "@/lib/internal-auth";

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

    // Gérer les messages d'annulation
    const isCancelCommand = /annuler|cancel|effacer|supprimer|delete/i.test(
      messageText,
    );

    if (isCancelCommand) {
      console.log(
        `⚠️ Commande d'annulation détectée dans ${channel.username}: "${messageText}"`,
      );

      let signalIdToCancel = null;

      // Cas 1: Annulation par réponse à un message
      if (replyToMessageId) {
        console.log(
          `🔍 Recherche du signal à annuler (replyToMessageId: ${replyToMessageId})`,
        );
        const { data: originalSignal } = await supabase
          .from("telegram_signals")
          .select("id")
          .eq("channel_id", channel.id)
          .eq("message_id", replyToMessageId)
          .maybeSingle();

        if (originalSignal) {
          signalIdToCancel = originalSignal.id;
          console.log(`✅ Signal trouvé par reply_to: ${signalIdToCancel}`);
        }
      }

      // Cas 2: Annulation du dernier pending si pas de réponse ou signal non trouvé
      if (!signalIdToCancel) {
        console.log(
          `🔍 Recherche du dernier signal du canal avec des trades en attente...`,
        );
        // On cherche le dernier signal du canal qui a au moins un trade 'pending'
        const { data: lastPendingTrade } = await supabase
          .from("telegram_trades")
          .select("signal_id, telegram_signals!inner(id, channel_id)")
          .eq("status", "pending")
          .eq("telegram_signals.channel_id", channel.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastPendingTrade) {
          signalIdToCancel = lastPendingTrade.signal_id;
          console.log(
            `✅ Dernier signal en attente du canal trouvé: ${signalIdToCancel}`,
          );
        }
      }

      if (signalIdToCancel) {
        // Annuler tous les trades 'pending' pour ce signal
        const { data: cancelledTrades, error: cancelError } = await supabase
          .from("telegram_trades")
          .update({
            status: "failed",
            error_message: "Annulé par commande Telegram",
          })
          .eq("signal_id", signalIdToCancel)
          .eq("status", "pending")
          .select();

        if (cancelError) {
          console.error("❌ Erreur lors de l'annulation:", cancelError);
          return NextResponse.json(
            { error: "Erreur lors de l'annulation" },
            { status: 500 },
          );
        }

        console.log(
          `✅ ${cancelledTrades?.length || 0} trade(s) annulé(s) pour le signal ${signalIdToCancel}`,
        );

        return NextResponse.json({
          success: true,
          message: `${cancelledTrades?.length || 0} trade(s) annulé(s) avec succès`,
          cancelledCount: cancelledTrades?.length || 0,
        });
      } else {
        console.log("❌ Aucun trade en attente trouvé à annuler");
        return NextResponse.json({
          success: true,
          message: "Aucun trade en attente trouvé à annuler",
        });
      }
    }

    // Handle SL/TP updates sent as a separate Telegram message replying to the original signal
    // Examples: "BE", "break even", "SL: 2640", "TP1: 2670 TP2: 2680"
    const isBeUpdate =
      /\bBE\b/i.test(messageText) ||
      /break[-\s]?even/i.test(messageText) ||
      /move\s*sl\s*(to|=)\s*(be|break\s*even|break-even)/i.test(messageText) ||
      /sl\s*(to|=)\s*(be|break\s*even|break-even)/i.test(messageText);

    const slMatch =
      messageText.match(/\bS\/?L\b[:=\s]*([\d.]+)/i) ||
      messageText.match(/\bSL\b[:=\s]*([\d.]+)/i);
    const nextStopLoss = slMatch && slMatch[1] ? parseFloat(slMatch[1]) : null;

    const tpMatches = Array.from(
      messageText.matchAll(/\bTP\d*\b[:=\s]*([\d.]+)/gi) as any,
    )
      .map((m: any) => (m && m[1] ? parseFloat(m[1]) : null))
      .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));

    const hasUpdate = Boolean(
      isBeUpdate || nextStopLoss !== null || tpMatches.length > 0,
    );

    // Require replyToMessageId so we only update the intended original positions
    if (hasUpdate && replyToMessageId) {
      const { data: originalSignal } = await supabase
        .from("telegram_signals")
        .select("id")
        .eq("channel_id", channel.id)
        .eq("message_id", replyToMessageId)
        .maybeSingle();

      if (originalSignal?.id) {
        const signalIdToUpdate = originalSignal.id;

        // Fetch all executed trades for this original signal (1 trade per TP)
        const { data: executedTrades, error: tradesError } = await supabase
          .from("telegram_trades")
          .select(
            `
            id,
            user_id,
            mt5_account_id,
            position_id,
            entry_price,
            take_profit,
            stop_loss,
            error_message,
            mt5_accounts!inner(metaapi_account_id)
          `,
          )
          .eq("signal_id", signalIdToUpdate)
          .eq("status", "executed");

        if (tradesError) {
          console.error(
            "Error fetching executed trades for update:",
            tradesError,
          );
        } else if (executedTrades && executedTrades.length > 0) {
          // For TP updates: map sorted TPs to sorted existing trades (null take_profit goes last)
          const sortedTakeProfits = [...tpMatches].sort((a, b) => a - b);
          const sortedTradesByTp = [...executedTrades].sort((a, b) => {
            const aTp =
              a.take_profit === null
                ? Number.POSITIVE_INFINITY
                : Number(a.take_profit);
            const bTp =
              b.take_profit === null
                ? Number.POSITIVE_INFINITY
                : Number(b.take_profit);
            return aTp - bTp;
          });

          const metaToken = process.env.METAAPI_TOKEN;
          if (!metaToken) {
            return NextResponse.json(
              { success: false, error: "METAAPI_TOKEN non configuré" },
              { status: 500 },
            );
          }

          for (let i = 0; i < executedTrades.length; i++) {
            const trade = executedTrades[i] as any;
            const metaApiAccountId = trade.mt5_accounts?.metaapi_account_id;

            const rawPositionId =
              trade.position_id ??
              (trade.error_message &&
              !Number.isNaN(parseInt(trade.error_message, 10))
                ? parseInt(trade.error_message, 10)
                : null);

            if (
              !metaApiAccountId ||
              rawPositionId === null ||
              rawPositionId === undefined
            ) {
              console.log(
                `⏭️ Skip update trade ${trade.id}: missing metaapi_account_id or position_id`,
              );
              continue;
            }

            let updatedStopLoss: number | null = null;
            if (isBeUpdate) {
              if (
                trade.entry_price !== null &&
                trade.entry_price !== undefined
              ) {
                updatedStopLoss = parseFloat(trade.entry_price);
              }
            } else if (nextStopLoss !== null) {
              updatedStopLoss = nextStopLoss;
            }

            let updatedTakeProfit: number | null = null;
            if (sortedTakeProfits.length > 0) {
              const tpIndex = sortedTradesByTp.findIndex(
                (t) => t.id === trade.id,
              );
              // Map by index in the sorted order
              const mapped = sortedTakeProfits[tpIndex];
              // If the message doesn't specify enough TP values, don't wipe existing TP.
              updatedTakeProfit =
                mapped !== undefined ? mapped : (trade.take_profit ?? null);
            }

            // If nothing to change, skip
            if (updatedStopLoss === null && updatedTakeProfit === null) {
              continue;
            }

            const body: any = {
              actionType: "POSITION_MODIFY",
              positionId: rawPositionId.toString(),
              stopLossUnits: "ABSOLUTE_PRICE",
              takeProfitUnits: "ABSOLUTE_PRICE",
            };
            if (updatedStopLoss !== null) body.stopLoss = updatedStopLoss;
            if (updatedTakeProfit !== null) body.takeProfit = updatedTakeProfit;

            try {
              const modifyUrl = `https://mt-client-api-v1.london.agiliumtrade.ai/users/current/accounts/${metaApiAccountId}/trade`;
              const resp = await fetch(modifyUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "auth-token": metaToken,
                },
                body: JSON.stringify(body),
              });

              const respData = await resp.json().catch(() => ({}));
              if (!resp.ok || !isMetaApiTradeSuccess(respData)) {
                console.error(
                  `❌ POSITION_MODIFY failed for trade ${trade.id}:`,
                  resp.status,
                  respData,
                );
                continue;
              }
            } catch (e: any) {
              console.error(
                `❌ POSITION_MODIFY error for trade ${trade.id}:`,
                e.message,
              );
              continue;
            }

            // Update DB so subsequent updates know the last applied values
            await supabase
              .from("telegram_trades")
              .update({
                stop_loss:
                  updatedStopLoss !== null ? updatedStopLoss : trade.stop_loss,
                take_profit:
                  updatedTakeProfit !== null
                    ? updatedTakeProfit
                    : trade.take_profit,
              })
              .eq("id", trade.id);
          }
        } else {
          console.log(
            `⚠️ Aucune trade exécutée à mettre à jour pour signal ${signalIdToUpdate}`,
          );
        }

        return NextResponse.json({
          success: true,
          message: "Positions SL/TP mises à jour",
          signal_id: originalSignal.id,
          updated: true,
        });
      }
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

    // Déterminer order_type: MARKET si pas de entry_price, LIMIT si entry_price existe
    const orderType =
      (signal as { orderType?: string }).orderType ||
      (signal.entryPrice ? "LIMIT" : "MARKET");

    const takeProfitsForSave = dedupeTakeProfits(signal.takeProfits || []);

    // Sauvegarder le signal
    const { data: savedSignal, error } = await supabase
      .from("telegram_signals")
      .insert({
        channel_id: channel.id,
        message_id: messageId,
        signal_type: signal.type,
        symbol: signal.symbol,
        entry_price: signal.entryPrice, // Peut être null pour market orders
        stop_loss: signal.stopLoss,
        take_profit: signal.takeProfit,
        // Store all TP values so we can create one trade per TP later
        all_tp: takeProfitsForSave.length > 0 ? takeProfitsForSave : null,
        volume: signal.volume || 0.01,
        message_text: messageText,
        order_type: signal.orderType || orderType, // MARKET, LIMIT, ou STOP
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

    // Exécuter immédiatement les trades (double sécurité avec le worker Render)
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      await fetch(`${baseUrl}/api/telegram/execute-trades`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.INTERNAL_API_SECRET}` },
      });
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
        console.log("✅ Signal parsé avec AI:", aiParsed);
        return aiParsed;
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

      let orderType: string | undefined;
      if (/LIMIT|LIMITE/i.test(messageText)) orderType = "LIMIT";
      else if (/\bSTOP\b/i.test(messageText)) orderType = "STOP";

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

TYPE & ORDRE:
- type: "BUY" ou "SELL" (ACHAT/LONG/🟢 → BUY ; VENTE/SHORT/🔴 → SELL)
- orderType: "MARKET" | "LIMIT" | "STOP"
  - "Buy Limit" / "Sell Limit" / "limite" → LIMIT
  - "Buy Stop" / "Sell Stop" → STOP
  - Sans prix d'entrée explicite → MARKET
- Plage d'entrée "4832.5-4833" → entryPrice = premier nombre pour BUY LIMIT, dernier pour SELL LIMIT

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

JSON UNIQUEMENT (ou null si type+symbol impossibles):
{
  "type": "BUY",
  "orderType": "LIMIT",
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

    const orderTypeRaw = String(parsed.orderType || "MARKET").toUpperCase();
    let orderType = "MARKET";
    if (orderTypeRaw.includes("LIMIT")) orderType = "LIMIT";
    else if (orderTypeRaw.includes("STOP")) orderType = "STOP";

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
      .single();

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
      .in("status", ["executed", "pending", "pending_partial", "executing"]);
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
          entry_price: signal.entry_price,
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
        entry_price: signal.entry_price,
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
