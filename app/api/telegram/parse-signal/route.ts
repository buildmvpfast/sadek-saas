import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { channelUsername, messageText, messageId } = await request.json()

    if (!channelUsername || !messageText || !messageId) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    const supabase = createClient()

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
    const signal = parseSignal(messageText)
    
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

function parseSignal(messageText: string) {
  // Patterns pour détecter les signaux
  const patterns = [
    // Pattern 1: BUY XAUUSD @ 2650.50 SL: 2640 TP: 2670
    /(BUY|SELL)\s+([A-Z]+)\s+@\s+([\d.]+)\s+SL:\s*([\d.]+)\s+TP:\s*([\d.]+)/i,
    // Pattern 2: 🟢 BUY GOLD 2650.50 SL 2640 TP 2670
    /🟢\s*(BUY|SELL)\s+([A-Z]+)\s+([\d.]+)\s+SL\s+([\d.]+)\s+TP\s+([\d.]+)/i,
    // Pattern 3: Signal: BUY EURUSD Entry: 1.0850 SL: 1.0800 TP: 1.0900
    /Signal:\s*(BUY|SELL)\s+([A-Z]+)\s+Entry:\s*([\d.]+)\s+SL:\s*([\d.]+)\s+TP:\s*([\d.]+)/i
  ]

  for (const pattern of patterns) {
    const match = messageText.match(pattern)
    if (match) {
      return {
        type: match[1].toUpperCase(),
        symbol: match[2],
        entryPrice: parseFloat(match[3]),
        stopLoss: parseFloat(match[4]),
        takeProfit: parseFloat(match[5]),
        volume: 0.01 // Volume par défaut
      }
    }
  }

  return null
}

async function executeTradesForSignal(signalId: string) {
  const supabase = createClient()

  // Récupérer tous les utilisateurs abonnés à ce canal
  const { data: subscriptions } = await supabase
    .from('user_telegram_subscriptions')
    .select(`
      user_id,
      telegram_channels!inner(id)
    `)
    .eq('is_active', true)

  if (!subscriptions) return

  // Pour chaque utilisateur, créer un trade
  for (const subscription of subscriptions) {
    // Récupérer le compte MT5 de l'utilisateur
    const { data: mt5Account } = await supabase
      .from('mt5_accounts')
      .select('id, metaapi_account_id')
      .eq('user_id', subscription.user_id)
      .eq('is_active', true)
      .single()

    if (!mt5Account?.metaapi_account_id) continue

    // Créer l'entrée de trade
    await supabase
      .from('telegram_trades')
      .insert({
        user_id: subscription.user_id,
        signal_id: signalId,
        mt5_account_id: mt5Account.id,
        symbol: 'XAUUSD', // À récupérer du signal
        signal_type: 'BUY', // À récupérer du signal
        volume: 0.01,
        status: 'pending'
      })
  }
}
