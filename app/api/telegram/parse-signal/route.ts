import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const { channelUsername, messageText, messageId } = await request.json();

    if (!channelUsername || !messageText || !messageId) {
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
    const { data: channel } = await supabase
      .from("telegram_channels")
      .select(
        `
        id,
        telegram_bot_tokens!inner(bot_token, is_active)
      `
      )
      .eq("username", channelUsername)
      .eq("telegram_bot_tokens.is_active", true)
      .eq("is_active", true)
      .single();

    if (!channel) {
      return NextResponse.json(
        { error: "Canal non trouvé ou sans token actif" },
        { status: 404 }
      );
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
      // On continue même si ça échoue, le worker Render s'en chargera dans les 5 secondes
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

      // Pattern avec multiple TP (TP1, TP2, TP3)
      if (pattern.source.includes("TP\\d")) {
        type = normalizeType(match[1]);
        symbol = match[2].toUpperCase().replace(/[\/_]/g, "");
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
        symbol = match[2].toUpperCase().replace(/[\/_]/g, "");
        entryPrice = match[3] ? parseFloat(match[3]) : null;
        stopLoss = match[4] ? parseFloat(match[4]) : null;
        takeProfit = match[5] ? parseFloat(match[5]) : null;
      } else {
        // Format: Symbole en premier
        symbol = match[1].toUpperCase().replace(/[\/_]/g, "");
        type = normalizeType(match[2]);
        entryPrice = match[3] ? parseFloat(match[3]) : null;
        stopLoss = match[4] ? parseFloat(match[4]) : null;
        takeProfit = match[5] ? parseFloat(match[5]) : null;
      }

      // Validation minimale: type et symbol requis
      if (type && symbol) {
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

RÈGLES CRITIQUES:
1. Type d'ordre: Cherche "BUY", "SELL", "ACHAT", "VENTE", "LONG", "SHORT", emojis 🟢/🔴, ou tout indicateur d'achat/vente
2. Symbole: Peut être écrit de n'importe quelle façon (XAUUSD, XAU/USD, GOLD, GOLDUSD, EURUSD, EUR/USD, etc.)
3. Prix d'entrée: Cherche "ENTRY", "@", "AT", "PRICE", ou juste un nombre après le symbole
4. Stop Loss: Cherche "SL", "STOP", "STOP LOSS", "S/L", ou tout indicateur de stop
5. Take Profit: Cherche "TP", "TAKE PROFIT", "T/P", "PROFIT", ou tout indicateur de profit
6. ⚠️ MULTIPLE TP: Si plusieurs TP (TP1, TP2, TP3, ou liste séparée par virgules), TOUJOURS prendre le DERNIER/PLUS ÉLEVÉ
7. MULTIPLE SL: Si plusieurs SL, prendre le PREMIER
8. Format flexible: Accepte les formats avec/sans ":", "@", virgules, tirets, espaces multiples, etc.

FORMATS ACCEPTÉS (exemples):
- "BUY XAUUSD" → market order
- "🟢 BUY GOLD @2650 SL 2640 TP 2670"
- "SELL EURUSD 1.0850 SL:1.0900 TP:1.0800"
- "ACHAT XAUUSD ENTRY 2650 STOP 2640 PROFIT 2670"
- "BUY GOLD TP1:2670 TP2:2680 TP3:2690" → TP = 2690
- "SELL BTC @50000 SL 51000 TP 48000, 47000, 46000" → TP = 46000 (dernier)
- "LONG XAUUSD"
- "SHORT EURUSD @1.0850"
- Formats avec emojis, emojis, formats français/anglais, etc.

INFORMATIONS À EXTRAIRE:
- type: "BUY" ou "SELL" (OBLIGATOIRE - détecte même si écrit différemment)
- symbol: Le symbole en majuscules (OBLIGATOIRE)
- entryPrice: Prix d'entrée si trouvé, sinon null
- stopLoss: Stop Loss si trouvé (premier si plusieurs), sinon null
- takeProfit: Take Profit si trouvé (DERNIER si plusieurs), sinon null
- volume: Volume si mentionné, sinon null

Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans code blocks, sans explications):
{
  "type": "BUY",
  "symbol": "XAUUSD",
  "entryPrice": null,
  "stopLoss": null,
  "takeProfit": null,
  "volume": null
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
      takeProfit: parsed.takeProfit ? parseFloat(parsed.takeProfit) : null,
      orderType: parsed.orderType || "MARKET",
      volume: parsed.volume ? parseFloat(parsed.volume) : 0.01,
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

  // SOL variations: SOL, SOL30, SOLUSDT, etc.
  if (upperSymbol.includes("SOL")) {
    return "SOL30";
  }

  // BTC variations: BTC, BTCUSD, BITCOIN, etc.
  if (upperSymbol.includes("BTC") || upperSymbol.includes("BITCOIN")) {
    return "BTC";
  }

  // Par défaut, retourner le symbole tel quel (sans les points/underscores pour compatibilité)
  return upperSymbol.replace(/[._]/g, "");
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
      "VT Markets": "XAUUSD",
      "Raise FX": "XAUUSD",
      "Raise Global": "XAUUSD",
      "Raise Globale": "XAUUSD",
      FXcess: "XAUUSD",
      Axi: "XAUUSD",
      // Certains brokers utilisent "GOLD" directement
      // Ajoute ici si tu connais des brokers qui utilisent "GOLD"
    },
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
      subscriptions.map((s) => s.user_id)
    )
    .eq("status", "active");

  const activeUserIds = new Set(
    activeSubscriptions?.map((s) => s.user_id) || []
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
        // Utiliser les lots fixes selon l'instrument
        if (normalizedSymbol === "GOLD") {
          userVolume = parseFloat(tradingSettings.gold_lot_size) || 0.01;
        } else if (normalizedSymbol === "SOL30") {
          userVolume = parseFloat(tradingSettings.sol_lot_size) || 0.01;
        } else if (normalizedSymbol === "BTC") {
          userVolume = parseFloat(tradingSettings.btc_lot_size) || 0.01;
        }
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
