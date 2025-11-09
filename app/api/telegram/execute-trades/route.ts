import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Exécute les trades Telegram en attente via MetaAPI
 * Cette route peut être appelée manuellement ou via un cron job
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    if (!process.env.METAAPI_TOKEN) {
      return NextResponse.json({ error: 'METAAPI_TOKEN non configuré' }, { status: 500 })
    }

    // Récupérer tous les trades en attente
    const { data: pendingTrades, error: fetchError } = await supabase
      .from('telegram_trades')
      .select(`
        id,
        user_id,
        signal_id,
        mt5_account_id,
        symbol,
        signal_type,
        volume,
        entry_price,
        stop_loss,
        take_profit,
        mt5_accounts!inner(metaapi_account_id)
      `)
      .eq('status', 'pending')
      .limit(50) // Traiter par batch de 50

    if (fetchError) {
      console.error('Erreur récupération trades:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!pendingTrades || pendingTrades.length === 0) {
      return NextResponse.json({ success: true, message: 'Aucun trade en attente', executed: 0 })
    }

    let executed = 0
    let failed = 0

    // Exécuter chaque trade
    for (const trade of pendingTrades) {
      const mt5Account = trade.mt5_accounts as any
      
      if (!mt5Account?.metaapi_account_id) {
        console.log(`Pas de metaapi_account_id pour le trade ${trade.id}`)
        await supabase
          .from('telegram_trades')
          .update({ status: 'failed', error_message: 'Compte MT5 non configuré' })
          .eq('id', trade.id)
        failed++
        continue
      }

      // Préparer l'ordre MetaAPI
      const actionType = trade.signal_type === 'BUY' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL'
      
      const order: any = {
        symbol: trade.symbol,
        actionType,
        volume: trade.volume || 0.01,
      }

      if (trade.stop_loss) {
        order.stopLoss = trade.stop_loss
      }
      if (trade.take_profit) {
        order.takeProfit = trade.take_profit
      }

      // Exécuter le trade via MetaAPI
      try {
        const response = await fetch(
          `https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${mt5Account.metaapi_account_id}/trade`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'auth-token': process.env.METAAPI_TOKEN!,
            },
            body: JSON.stringify(order),
          }
        )

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.message || 'Trade failed')
        }

        // Mettre à jour le trade avec succès
        await supabase
          .from('telegram_trades')
          .update({
            status: 'executed',
            executed_at: new Date().toISOString(),
            entry_price: data.price || trade.entry_price,
          })
          .eq('id', trade.id)

        executed++
        console.log(`✅ Trade ${trade.id} exécuté avec succès`)
      } catch (error: any) {
        console.error(`❌ Erreur exécution trade ${trade.id}:`, error.message)
        
        // Mettre à jour le trade avec l'erreur
        await supabase
          .from('telegram_trades')
          .update({
            status: 'failed',
            error_message: error.message,
          })
          .eq('id', trade.id)

        failed++
      }
    }

    return NextResponse.json({
      success: true,
      executed,
      failed,
      total: pendingTrades.length,
    })
  } catch (error: any) {
    console.error('Error executing trades:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

