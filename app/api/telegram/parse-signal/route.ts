import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { channelUsername, messageText, messageId } = await request.json()

    if (!channelUsername || !messageText || !messageId) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Trouver le canal
    const { data: channel } = await supabase
      .from('telegram_channels')
      .select('id')
      .eq('username', channelUsername)
      .single()

    if (!channel) {
      return NextResponse.json({ error: 'Canal non trouvé' }, { status: 404 })
    }

    // Parser le signal
    const signal = await parseSignal(messageText)
    
    if (!signal) {
      return NextResponse.json({ success: true, message: 'Pas de signal détecté' })
    }

    // Sauvegarder le signal
    const { data: savedSignal, error } = await supabase
      .from('telegram_signals')
      .insert({
        channel_id: channel.id,
        message_id: messageId,
        signal_type: signal.type,
        symbol: signal.symbol,
        entry_price: signal.entryPrice,
        stop_loss: signal.stopLoss,
        take_profit: signal.takeProfit,
        volume: signal.volume,
        message_text: messageText
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving signal:', error)
      return NextResponse.json({ error: 'Erreur sauvegarde' }, { status: 500 })
    }

    // Exécuter les trades pour tous les utilisateurs abonnés
    await executeTradesForSignal(savedSignal.id)
    
    // Exécuter immédiatement les trades (double sécurité avec le worker Render)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      await fetch(`${baseUrl}/api/telegram/execute-trades`, {
        method: 'POST',
      })
    } catch (error) {
      console.error('Error triggering trade execution:', error)
      // On continue même si ça échoue, le worker Render s'en chargera dans les 5 secondes
    }

    return NextResponse.json({ 
      success: true, 
      signal: savedSignal,
      message: 'Signal traité avec succès'
    })

  } catch (error: any) {
    console.error('Error parsing signal:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function parseSignal(messageText: string) {
  // Essayer d'abord avec OpenAI si disponible (plus robuste)
  if (process.env.OPENAI_API_KEY) {
    try {
      const aiParsed = await parseSignalWithAI(messageText)
      if (aiParsed) {
        return aiParsed
      }
    } catch (error) {
      console.warn('Erreur parsing AI, fallback sur regex:', error)
    }
  }

  // Fallback: Patterns regex pour détecter les signaux
  const patterns = [
    // Pattern 1: BUY XAUUSD @ 2650.50 SL: 2640 TP: 2670
    /(BUY|SELL)\s+([A-Z0-9.]+)\s+@\s+([\d.]+)\s+SL:\s*([\d.]+)\s+TP:\s*([\d.]+)/i,
    // Pattern 2: 🟢 BUY GOLD 2650.50 SL 2640 TP 2670
    /🟢\s*(BUY|SELL)\s+([A-Z0-9.]+)\s+([\d.]+)\s+SL\s+([\d.]+)\s+TP\s+([\d.]+)/i,
    // Pattern 3: Signal: BUY EURUSD Entry: 1.0850 SL: 1.0800 TP: 1.0900
    /Signal:\s*(BUY|SELL)\s+([A-Z0-9.]+)\s+Entry:\s*([\d.]+)\s+SL:\s*([\d.]+)\s+TP:\s*([\d.]+)/i,
    // Pattern 4: BUY XAUUSD 2650.50 SL 2640 TP 2670 (sans @)
    /(BUY|SELL)\s+([A-Z0-9.]+)\s+([\d.]+)\s+SL\s+([\d.]+)\s+TP\s+([\d.]+)/i,
    // Pattern 5: XAUUSD BUY @2650.50 SL:2640 TP:2670
    /([A-Z0-9.]+)\s+(BUY|SELL)\s+@?\s*([\d.]+)\s+SL:?\s*([\d.]+)\s+TP:?\s*([\d.]+)/i
  ]

  for (const pattern of patterns) {
    const match = messageText.match(pattern)
    if (match) {
      // Détecter l'ordre des groupes selon le pattern
      let type, symbol, entryPrice, stopLoss, takeProfit
      
      if (match[1].match(/^(BUY|SELL)$/i)) {
        // Format: BUY/SELL en premier
        type = match[1].toUpperCase()
        symbol = match[2]
        entryPrice = parseFloat(match[3])
        stopLoss = parseFloat(match[4])
        takeProfit = parseFloat(match[5])
      } else {
        // Format: Symbole en premier
        symbol = match[1]
        type = match[2].toUpperCase()
        entryPrice = parseFloat(match[3])
        stopLoss = parseFloat(match[4])
        takeProfit = parseFloat(match[5])
      }

      if (type && symbol && entryPrice && stopLoss && takeProfit) {
        return {
          type,
          symbol,
          entryPrice,
          stopLoss,
          takeProfit,
          volume: 0.01 // Volume par défaut
        }
      }
    }
  }

  return null
}

/**
 * Parse un signal avec OpenAI pour une meilleure compréhension du contexte
 */
async function parseSignalWithAI(messageText: string): Promise<any | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Modèle rapide et économique
        messages: [
          {
            role: 'system',
            content: `Tu es un expert en parsing de signaux de trading. Extrais les informations suivantes d'un message Telegram de trading:
- Type: BUY ou SELL
- Symbole: Le symbole de trading (XAUUSD, GOLD, XAUUSD.I, EURUSD, etc.)
- Prix d'entrée (Entry Price)
- Stop Loss (SL)
- Take Profit (TP)

Réponds UNIQUEMENT avec un JSON valide dans ce format:
{
  "type": "BUY" ou "SELL",
  "symbol": "XAUUSD",
  "entryPrice": 2650.50,
  "stopLoss": 2640,
  "takeProfit": 2670
}

Si tu ne peux pas extraire toutes les informations, retourne null.`
          },
          {
            role: 'user',
            content: messageText
          }
        ],
        temperature: 0.1, // Faible pour plus de précision
        max_tokens: 200
      })
    })

    const data = await response.json()
    
    if (!response.ok) {
      console.error('OpenAI API error:', data)
      return null
    }

    const content = data.choices[0]?.message?.content
    if (!content) {
      return null
    }

    // Parser le JSON de la réponse
    const parsed = JSON.parse(content.trim())
    
    if (parsed && parsed.type && parsed.symbol && parsed.entryPrice && parsed.stopLoss && parsed.takeProfit) {
      return {
        type: parsed.type.toUpperCase(),
        symbol: parsed.symbol.toUpperCase(),
        entryPrice: parseFloat(parsed.entryPrice),
        stopLoss: parseFloat(parsed.stopLoss),
        takeProfit: parseFloat(parsed.takeProfit),
        volume: 0.01
      }
    }

    return null
  } catch (error) {
    console.error('Error parsing with AI:', error)
    return null
  }
}

/**
 * Normalise un symbole (XAUUSD -> GOLD, XAUUSD.I -> GOLD, GOLD -> GOLD, etc.)
 * Gère tous les formats: XAUUSD, XAUUSD.I, GOLD, GOLDUSD, etc.
 */
function normalizeSymbol(symbol: string): string {
  const upperSymbol = symbol.toUpperCase().trim()
  
  // GOLD variations: XAUUSD, XAUUSD.I, GOLD, GOLDUSD, XAU/USD, etc.
  if (upperSymbol.includes('XAU') || upperSymbol.includes('GOLD')) {
    return 'GOLD'
  }
  
  // SOL variations: SOL, SOL30, SOLUSDT, etc.
  if (upperSymbol.includes('SOL')) {
    return 'SOL30'
  }
  
  // BTC variations: BTC, BTCUSD, BITCOIN, etc.
  if (upperSymbol.includes('BTC') || upperSymbol.includes('BITCOIN')) {
    return 'BTC'
  }
  
  // Par défaut, retourner le symbole tel quel (sans les points/underscores pour compatibilité)
  return upperSymbol.replace(/[._]/g, '')
}

async function executeTradesForSignal(signalId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Récupérer les données du signal
  const { data: signal } = await supabase
    .from('telegram_signals')
    .select('id, channel_id, signal_type, symbol, entry_price, stop_loss, take_profit, volume')
    .eq('id', signalId)
    .single()

  if (!signal) {
    console.error('Signal non trouvé:', signalId)
    return
  }

  // Récupérer tous les utilisateurs abonnés à ce canal spécifique
  const { data: subscriptions } = await supabase
    .from('user_telegram_subscriptions')
    .select('user_id')
    .eq('channel_id', signal.channel_id)
    .eq('is_active', true)

  if (!subscriptions || subscriptions.length === 0) {
    console.log('Aucun utilisateur abonné à ce canal')
    return
  }

  // Vérifier les abonnements actifs des utilisateurs
  const { data: activeSubscriptions } = await supabase
    .from('subscriptions')
    .select('user_id')
    .in('user_id', subscriptions.map(s => s.user_id))
    .eq('status', 'active')

  const activeUserIds = new Set(activeSubscriptions?.map(s => s.user_id) || [])

  // Normaliser le symbole du signal (XAUUSD -> GOLD, etc.)
  const normalizedSymbol = normalizeSymbol(signal.symbol)

  // Pour chaque utilisateur, créer un trade
  for (const subscription of subscriptions) {
    // Vérifier que l'utilisateur a un abonnement actif
    if (!activeUserIds.has(subscription.user_id)) {
      console.log(`Utilisateur ${subscription.user_id} n'a pas d'abonnement actif`)
      continue
    }

    // Récupérer le compte MT5 et les paramètres de trading de l'utilisateur
    const { data: mt5Account } = await supabase
      .from('mt5_accounts')
      .select('id, metaapi_account_id, broker_name')
      .eq('user_id', subscription.user_id)
      .eq('is_active', true)
      .single()

    if (!mt5Account?.metaapi_account_id) {
      console.log(`Pas de compte MT5 actif pour l'utilisateur ${subscription.user_id}`)
      continue
    }

    // Récupérer les paramètres de trading de l'utilisateur
    const { data: tradingSettings } = await supabase
      .from('trading_settings')
      .select('*')
      .eq('user_id', subscription.user_id)
      .single()

    // Calculer le volume selon les paramètres utilisateur
    let userVolume = signal.volume || 0.01 // Défaut

    if (tradingSettings) {
      if (tradingSettings.position_sizing_type === 'lot') {
        // Utiliser les lots fixes selon l'instrument
        if (normalizedSymbol === 'GOLD') {
          userVolume = parseFloat(tradingSettings.gold_lot_size) || 0.01
        } else if (normalizedSymbol === 'SOL30') {
          userVolume = parseFloat(tradingSettings.sol_lot_size) || 0.01
        } else if (normalizedSymbol === 'BTC') {
          userVolume = parseFloat(tradingSettings.btc_lot_size) || 0.01
        }
      } else if (tradingSettings.position_sizing_type === 'percentage') {
        // Pourcentage: utiliser le pourcentage du signal comme base
        // TODO: améliorer avec le capital réel du compte
        userVolume = (signal.volume || 0.01) * (parseFloat(tradingSettings.position_percentage) || 1.0) / 100
        if (userVolume < 0.01) userVolume = 0.01 // Minimum
      }
    }

    // Mapper le symbole au broker de l'utilisateur
    // Seulement pour les brokers configurés: VTmarker, Raise FX, Raise Globale, FXcess, Axi
    let brokerSymbol = signal.symbol // Par défaut, utiliser le symbole du signal
    
    if (mt5Account.broker_name) {
      // Liste des brokers supportés
      const supportedBrokers = ['VTmarker', 'Raise FX', 'Raise Globale', 'FXcess', 'Axi']
      
      // Vérifier que le broker est dans la liste supportée
      if (supportedBrokers.includes(mt5Account.broker_name)) {
        const { data: symbolMapping } = await supabase
          .from('symbol_mappings')
          .select('broker_symbol')
          .eq('broker_name', mt5Account.broker_name)
          .eq('standard_symbol', normalizedSymbol)
          .single()

        if (symbolMapping) {
          brokerSymbol = symbolMapping.broker_symbol
          console.log(`✅ Mapping: ${normalizedSymbol} → ${brokerSymbol} pour ${mt5Account.broker_name}`)
        } else {
          console.log(`⚠️ Pas de mapping trouvé pour ${normalizedSymbol} sur ${mt5Account.broker_name}, utilisation du symbole original`)
        }
      } else {
        console.log(`⚠️ Broker ${mt5Account.broker_name} non supporté, utilisation du symbole original`)
      }
    }

    // Créer l'entrée de trade avec les données du signal et les paramètres utilisateur
    const { error } = await supabase
      .from('telegram_trades')
      .insert({
        user_id: subscription.user_id,
        signal_id: signalId,
        mt5_account_id: mt5Account.id,
        symbol: brokerSymbol, // Symbole du broker
        signal_type: signal.signal_type,
        volume: userVolume, // Volume calculé selon les paramètres utilisateur
        entry_price: signal.entry_price,
        stop_loss: signal.stop_loss,
        take_profit: signal.take_profit,
        status: 'pending'
      })

    if (error) {
      console.error('Erreur création trade:', error)
    } else {
      console.log(`✅ Trade créé pour user ${subscription.user_id}: ${brokerSymbol} ${userVolume} lots`)
    }
  }
}
