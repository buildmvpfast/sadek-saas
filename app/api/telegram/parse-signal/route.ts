import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const { channelId, channelUsername, messageText, messageId, replyToMessageId } = await request.json();

    if ((!channelId && !channelUsername) || !messageText || !messageId) {
      return NextResponse.json(
        { error: "Paramètres manquants" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Trouver le canal avec un token actif
    let query = supabase
      .from("telegram_channels")
      .select(
        `
        id,
        username,
        telegram_bot_tokens!inner(bot_token, is_active)
      `
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
        { status: 404 }
      );
    }

    // Gérer les messages d'annulation
    const isCancelCommand = /annuler|cancel|effacer|supprimer|delete/i.test(messageText);
    
    if (isCancelCommand) {
      console.log(`⚠️ Commande d'annulation détectée dans ${channel.username}: "${messageText}"`);
      
      let signalIdToCancel = null;

      // Cas 1: Annulation par réponse à un message
      if (replyToMessageId) {
        console.log(`🔍 Recherche du signal à annuler (replyToMessageId: ${replyToMessageId})`);
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
        console.log(`🔍 Recherche du dernier signal du canal avec des trades en attente...`);
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
          console.log(`✅ Dernier signal en attente du canal trouvé: ${signalIdToCancel}`);
        }
      }

      if (signalIdToCancel) {
        // Annuler tous les trades 'pending' pour ce signal
        const { data: cancelledTrades, error: cancelError } = await supabase
          .from("telegram_trades")
          .update({
            status: "failed",
            error_message: "Annulé par commande Telegram"
          })
          .eq("signal_id", signalIdToCancel)
          .eq("status", "pending")
          .select();

        if (cancelError) {
          console.error("❌ Erreur lors de l'annulation:", cancelError);
          return NextResponse.json({ error: "Erreur lors de l'annulation" }, { status: 500 });
        }

        console.log(`✅ ${cancelledTrades?.length || 0} trade(s) annulé(s) pour le signal ${signalIdToCancel}`);
        
        return NextResponse.json({
          success: true,
          message: `${cancelledTrades?.length || 0} trade(s) annulé(s) avec succès`,
          cancelledCount: cancelledTrades?.length || 0
        });
      } else {
        console.log("❌ Aucun trade en attente trouvé à annuler");
        return NextResponse.json({
          success: true,
          message: "Aucun trade en attente trouvé à annuler"
        });
      }
    }

    // Parser le signal
    console.log(
      `📨 Parsing signal from ${channelUsername}:`,
      messageText.substring(0, 100)
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
      console.log(`📉 Commande de fermeture partielle détectée (${signal.closePercent}%)`);
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
        const { data: tradesToPartial, error: partialError } = await supabase
          .from("telegram_trades")
          .update({
            status: "pending_partial",
            error_message: `Fermeture partielle ${signal.closePercent}% demandée`,
            // On stocke le pourcentage dans un champ temporaire ou via error_message pour l'instant
            // Car la structure de table est fixe
          })
          .eq("signal_id", signalIdToClose)
          .eq("status", "executed")
          .select();

        return NextResponse.json({
          success: true,
          message: `${tradesToPartial?.length || 0} trade(s) en attente de fermeture partielle (${signal.closePercent}%)`
        });
      }
    }

    // Déterminer order_type: MARKET si pas de entry_price, LIMIT si entry_price existe
    const orderType = signal.entryPrice ? "LIMIT" : "MARKET";

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
        volume: signal.volume || 0.01,
        message_text: messageText,
        order_type: signal.orderType || orderType, // MARKET, LIMIT, ou STOP
      })
      .select()
      .single();

    if (error) {
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
    return NextResponse.json({ error: error.message }, { status: 500 });
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
      "⚠️ OPENAI_API_KEY non configuré, utilisation du parsing regex basique"
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
    /(BUY|SELL|ACHAT|VENTE|LONG|SHORT)\s+([A-Z0-9./]+).*?TP\d*:?\s*([\d.]+).*?TP\d*:?\s*([\d.]+).*?TP\d*:?\s*([\d.]+)/i,
  ];

  for (const pattern of patterns) {
    const match = messageText.match(pattern);
    if (match) {
      // Détecter l'ordre des groupes selon le pattern
      let type, symbol, entryPrice, stopLoss, takeProfit;

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
          const potentialSymbol = words.find(w => 
            w.length >= 3 && 
            w.length <= 8 && 
            !['BUY', 'SELL', 'LIMIT', 'STOP', 'ACHAT', 'VENTE'].includes(w.toUpperCase())
          );
          if (potentialSymbol) sym = potentialSymbol.toUpperCase();
        }
        return sym.replace(/[\/_]/g, "");
      };

      // Pattern avec multiple TP (TP1, TP2, TP3)
      if (pattern.source.includes("TP\\d")) {
        type = normalizeType(match[1]);
        symbol = cleanSymbol(match[2]);
        entryPrice = match[3] ? parseFloat(match[3]) : null;
        stopLoss = match[4] ? parseFloat(match[4]) : null;
        // Prendre le dernier TP (match[5] ou match[6] selon le pattern)
        takeProfit = match[5]
          ? parseFloat(match[5])
          : match[4]
            ? parseFloat(match[4])
            : null;
      } else if (
        match[1].match(/^(BUY|SELL|ACHAT|VENTE|LONG|SHORT|🟢|🔴|✅|❌)$/i)
      ) {
        // Format: BUY/SELL en premier
        type = normalizeType(match[1]);
        symbol = cleanSymbol(match[2]);
        entryPrice = match[3] ? parseFloat(match[3]) : null;
        stopLoss = match[4] ? parseFloat(match[4]) : null;
        takeProfit = match[5] ? parseFloat(match[5]) : null;
      } else {
        // Format: Symbole en premier
        symbol = cleanSymbol(match[1]);
        type = normalizeType(match[2]);
        entryPrice = match[3] ? parseFloat(match[3]) : null;
        stopLoss = match[4] ? parseFloat(match[4]) : null;
        takeProfit = match[5] ? parseFloat(match[5]) : null;
      }

      // Validation minimale: type et symbol requis
      if (type && symbol && symbol !== "LIMIT" && symbol !== "STOP") {
        return {
          type,
          symbol,
          entryPrice: entryPrice || null,
          stopLoss: stopLoss || null,
          takeProfit: takeProfit || null,
          volume: 0.01, // Volume par défaut
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
            content: `Tu es un expert en parsing de signaux de trading MT5. Ton rôle est d'extraire les informations d'un message Telegram de trading, PEU IMPORTE le format utilisé.

8. Gestion des TP multiples: Si plusieurs TP sont listés (TP1, TP2...), EXTRAIS-LES TOUS dans un tableau "takeProfits". Le système choisira automatiquement le meilleur (le plus haut pour BUY, le plus bas pour SELL).
9. Fermetures Partielles / TP Hit: Si le message mentionne "TP HIT", "TAKE PROFIT TOUCHÉ", "PRENDRE DES PROFITS", "SÉCURISER", "CLOSE HALF", "PRENDRE UNE PARTIE", indique "isPartialClose": true. 
   - Cherche un pourcentage (ex: "50%", "CLOSE HALF" -> 50). Par défaut "closePercent": 50.

RÈGLES CRITIQUES:
1. Type d'ordre: Cherche "BUY", "SELL", "ACHAT", "VENTE", "LONG", "SHORT", emojis 🟢/🔴.
2. Mode d'exécution: Détermine s'il s'agit de "MARKET" (exécuté maintenant), "LIMIT" (souvent écrit "Buy Limit", "Sell Limit" ou avec "@") ou "STOP".

INFORMATIONS À EXTRAIRE:
- type: "BUY", "SELL" ou "CLOSE" (si fermeture partielle)
- symbol: Le symbole
- entryPrice: Nombre
- stopLoss: Nombre
- takeProfits: Tableau de nombres [2670, 2680, 2690]
- isPartialClose: Boolean
- closePercent: Nombre (ex: 50)

Réponds UNIQUEMENT avec un JSON valide:
{
  "type": "BUY",
  "orderType": "MARKET",
  "symbol": "GOLD",
  "entryPrice": null,
  "stopLoss": 2640,
  "takeProfits": [2670, 2680, 2690],
  "isPartialClose": false,
  "closePercent": null
}

Si tu ne peux PAS extraire type ET symbol de manière fiable, retourne null.`,
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

    return {
      type: parsed.type.toUpperCase(),
      symbol: parsed.symbol.toUpperCase(),
      entryPrice: parsed.entryPrice ? parseFloat(parsed.entryPrice) : null,
      stopLoss: parsed.stopLoss ? parseFloat(parsed.stopLoss) : null,
      takeProfit: parsed.takeProfit ? parseFloat(parsed.takeProfit) : 
                (Array.isArray(parsed.takeProfits) && parsed.takeProfits.length > 0) ?
                (() => {
                  const sorted = parsed.takeProfits.sort((a: number, b: number) => a - b);
                  return parsed.type.toUpperCase() === "BUY" ? sorted[sorted.length - 1] : sorted[0];
                })() : null,
      orderType: parsed.orderType || "MARKET",
      volume: parsed.volume ? parseFloat(parsed.volume) : 0.01,
      isPartialClose: parsed.isPartialClose || false,
      closePercent: parsed.closePercent || 50
    };
  } catch (error) {
    console.error("Error parsing with AI:", error);
    return null;
  }
}

/**
 * Normalise un symbole (XAUUSD -> GOLD, XAUUSD.I -> GOLD, GOLD -> GOLD, etc.)
 * Gère tous les formats: XAUUSD, XAUUSD.I, GOLD, GOLDUSD, etc.
 */
function normalizeSymbol(symbol: string): string {
  const upperSymbol = symbol.toUpperCase().trim();

  // GOLD variations: XAUUSD, XAUUSD.I, GOLD, GOLDUSD, XAU/USD, etc.
  if (upperSymbol.includes("XAU") || upperSymbol.includes("GOLD")) {
    return "GOLD";
  }

  // Indices variations
  if (upperSymbol.includes("US30") || upperSymbol.includes("DJ30") || upperSymbol.includes("WS30") || upperSymbol.includes("DOW")) {
    return "US30";
  }
  if (upperSymbol.includes("NAS100") || upperSymbol.includes("US100") || upperSymbol.includes("USTEC") || upperSymbol.includes("NASDAQ")) {
    return "NAS100";
  }
  if (upperSymbol.includes("GER40") || upperSymbol.includes("DAX") || upperSymbol.includes("DE40") || upperSymbol.includes("GER30")) {
    return "GER40";
  }

  // SOL variations: SOL, SOL30, SOLUSDT, etc.
  if (upperSymbol.includes("SOL")) {
    return "SOL30";
  }

  // BTC variations: BTC, BTCUSD, BITCOIN, etc.
  if (upperSymbol.includes("BTC") || upperSymbol.includes("BITCOIN")) {
    return "BTC";
  }

  // Par défaut, retourner le symbole tel quel (sans les points/underscores/slashes pour compatibilité)
  return upperSymbol.replace(/[._\/]/g, "");
}

/**
 * Mappe un symbole normalisé au symbole utilisé par un broker spécifique
 * Exemple: GOLD → XAUUSD pour certains brokers, GOLD pour d'autres
 */
async function mapSymbolToBroker(
  normalizedSymbol: string,
  brokerName: string | null,
  supabase: any
): Promise<string> {
  if (!brokerName) {
    return normalizedSymbol;
  }

  // Liste des brokers supportés
  const supportedBrokers = [
    "VT Markets",
    "Raise FX",
    "Raise Global",
    "Raise Globale",
    "FXcess",
    "Axi",
  ];

  // Normaliser le nom du broker (gérer les variations)
  const normalizedBrokerName = brokerName.trim();

  // Si le broker n'est pas supporté, retourner le symbole tel quel
  if (!supportedBrokers.includes(normalizedBrokerName)) {
    console.log(
      `⚠️ Broker ${normalizedBrokerName} non supporté, utilisation du symbole original: ${normalizedSymbol}`
    );
    return normalizedSymbol;
  }

  // 1. Essayer de récupérer depuis la table symbol_mappings
  try {
    const { data: symbolMapping, error } = await supabase
      .from("symbol_mappings")
      .select("broker_symbol")
      .eq("broker_name", normalizedBrokerName)
      .eq("standard_symbol", normalizedSymbol)
      .single();

    if (!error && symbolMapping?.broker_symbol) {
      console.log(
        `✅ Mapping DB: ${normalizedSymbol} → ${symbolMapping.broker_symbol} pour ${normalizedBrokerName}`
      );
      return symbolMapping.broker_symbol;
    }
  } catch (error) {
    console.warn(
      `⚠️ Erreur lecture symbol_mappings, utilisation du fallback:`,
      error
    );
  }

  // 2. Fallback: Mapping intelligent basé sur les conventions courantes
  const fallbackMapping: Record<string, Record<string, string>> = {
    GOLD: {
      "VT Markets": "XAUUSD-ECN",
      "Raise FX": "XAUUSD",
      "Raise Global": "XAUUSD",
      "Raise Globale": "XAUUSD",
      FXcess: "XAUUSD",
      Axi: "XAUUSD",
    },
    EURUSD: { "VT Markets": "EURUSD-ECN" },
    GBPUSD: { "VT Markets": "GBPUSD-ECN" },
    EURGBP: { "VT Markets": "EURGBP-ECN" },
    EURJPY: { "VT Markets": "EURJPY-ECN" },
    GBPJPY: { "VT Markets": "GBPJPY-ECN" },
    US30: { "VT Markets": "US30.cash-ECN" },
    NAS100: { "VT Markets": "NAS100.cash-ECN" },
    GER40: { "VT Markets": "GER40.cash-ECN" },
    SOL30: {
      "VT Markets": "SOL30",
      "Raise FX": "SOL30",
      "Raise Global": "SOL30",
      "Raise Globale": "SOL30",
      FXcess: "SOL30",
      Axi: "SOL30",
    },
    BTC: {
      "VT Markets": "BTCUSD",
      "Raise FX": "BTCUSD",
      "Raise Global": "BTCUSD",
      "Raise Globale": "BTCUSD",
      FXcess: "BTCUSD",
      Axi: "BTCUSD",
    },
  };

  // Vérifier si on a un mapping fallback
  if (
    fallbackMapping[normalizedSymbol] &&
    fallbackMapping[normalizedSymbol][normalizedBrokerName]
  ) {
    const mappedSymbol =
      fallbackMapping[normalizedSymbol][normalizedBrokerName];
    console.log(
      `✅ Mapping fallback: ${normalizedSymbol} → ${mappedSymbol} pour ${normalizedBrokerName}`
    );
    return mappedSymbol;
  }

  // 3. Si aucun mapping trouvé, retourner le symbole normalisé
  console.log(
    `⚠️ Pas de mapping pour ${normalizedSymbol} sur ${normalizedBrokerName}, utilisation du symbole normalisé`
  );
  return normalizedSymbol;
}

async function executeTradesForSignal(signalId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Récupérer les données du signal
  const { data: signal } = await supabase
    .from("telegram_signals")
    .select(
      "id, channel_id, signal_type, symbol, entry_price, stop_loss, take_profit, volume, order_type"
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
      subscriptions.map((s: any) => s.user_id)
    )
    .in("status", ["active", "trialing"]);

  const activeUserIds = new Set(
    activeSubscriptions?.map((s: any) => s.user_id) || []
  );

  // Normaliser le symbole du signal (XAUUSD -> GOLD, etc.)
  const normalizedSymbol = normalizeSymbol(signal.symbol);

  console.log(`✅ ${activeUserIds.size} utilisateur(s) avec abonnement actif`);

  // Pour chaque utilisateur, créer un trade
  for (const subscription of subscriptions) {
    // Vérifier que l'utilisateur a un abonnement actif
    if (!activeUserIds.has(subscription.user_id)) {
      console.log(
        `⚠️ Utilisateur ${subscription.user_id} n'a pas d'abonnement actif`
      );
      continue;
    }

    // Récupérer le compte MT5 et les paramètres de trading de l'utilisateur
    const { data: mt5Account } = await supabase
      .from("mt5_accounts")
      .select("id, metaapi_account_id, broker_name")
      .eq("user_id", subscription.user_id)
      .eq("is_active", true)
      .single();

    if (!mt5Account?.metaapi_account_id) {
      console.log(
        `⚠️ Pas de compte MT5 actif pour l'utilisateur ${subscription.user_id}`
      );
      continue;
    }

    console.log(
      `✅ Compte MT5 trouvé pour user ${subscription.user_id}: ${mt5Account.broker_name}`
    );

    // Récupérer les paramètres de trading de l'utilisateur
    const { data: tradingSettings } = await supabase
      .from("trading_settings")
      .select("*")
      .eq("user_id", subscription.user_id)
      .single();

    // Calculer le volume selon les paramètres utilisateur
    let userVolume = signal.volume || 0.01; // Défaut

    if (tradingSettings) {
      if (tradingSettings.position_sizing_type === "lot") {
        const lotMap: Record<string, string> = {
          GOLD: 'gold_lot_size',
          BTC: 'btc_lot_size',
          ETH: 'eth_lot_size',
          SOL30: 'sol_lot_size',
          US30: 'us30_lot_size',
          NAS100: 'nas100_lot_size',
          GER40: 'ger40_lot_size',
          UK100: 'uk100_lot_size',
          SPX500: 'spx500_lot_size',
          EURUSD: 'eurusd_lot_size',
          GBPUSD: 'gbpusd_lot_size',
          USDJPY: 'usdjpy_lot_size',
          USDCHF: 'usdchf_lot_size',
          USDCAD: 'usdcad_lot_size',
          AUDUSD: 'audusd_lot_size',
          NZDUSD: 'nzdusd_lot_size',
          EURGBP: 'eurgbp_lot_size',
          EURJPY: 'eurjpy_lot_size',
          GBPJPY: 'gbpjpy_lot_size',
        }
        const key = lotMap[normalizedSymbol]
        userVolume = key ? parseFloat(tradingSettings[key]) || 0.01 : 0.01
      } else if (tradingSettings.position_sizing_type === "percentage") {
        // Pourcentage: utiliser le pourcentage du signal comme base
        // TODO: améliorer avec le capital réel du compte
        userVolume =
          ((signal.volume || 0.01) *
            (parseFloat(tradingSettings.position_percentage) || 1.0)) /
          100;
        if (userVolume < 0.01) userVolume = 0.01; // Minimum
      }
    }

    // Mapper le symbole au broker de l'utilisateur
    // Convertit automatiquement selon le broker (ex: GOLD → XAUUSD pour certains brokers)
    let brokerSymbol = await mapSymbolToBroker(
      normalizedSymbol,
      mt5Account.broker_name,
      supabase
    );

    console.log(
      `✅ Symbole mappé: ${signal.symbol} → ${normalizedSymbol} → ${brokerSymbol} pour ${mt5Account.broker_name}`
    );

    // Créer l'entrée de trade avec les données du signal et les paramètres utilisateur
    // Note: entry_price peut être null pour market orders
    const { error } = await supabase.from("telegram_trades").insert({
      user_id: subscription.user_id,
      signal_id: signalId,
      mt5_account_id: mt5Account.id,
      symbol: brokerSymbol, // Symbole du broker (mappé automatiquement)
      signal_type: signal.signal_type,
      order_type:
        signal.order_type || (signal.entry_price ? "LIMIT" : "MARKET"),
      volume: userVolume, // Volume calculé selon les paramètres utilisateur
      entry_price: signal.entry_price, // null pour market orders
      stop_loss: signal.stop_loss,
      take_profit: signal.take_profit,
      status: "pending",
    });

    if (error) {
      console.error(
        `❌ Erreur création trade pour user ${subscription.user_id}:`,
        error
      );
    } else {
      console.log(
        `✅ Trade créé pour user ${subscription.user_id}: ${brokerSymbol} ${userVolume} lots (status: pending)`
      );
    }
  }
}
