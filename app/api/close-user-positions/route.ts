import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { postMetaApiClosePosition } from '@/lib/metaapi-trade-client'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { user_id } = await req.json()

    if (!user_id) {
      return NextResponse.json({ error: 'user_id requis' }, { status: 400 })
    }

    console.log(`🔴 Fermeture des positions pour user ${user_id} (abonnement inactif)`)

    // Get all open copy trades for this user
    const { data: openTrades, error } = await supabase
      .from('copy_trades')
      .select(`
        id,
        follower_ticket,
        follower_mt5_account_id,
        mt5_accounts!copy_trades_follower_mt5_account_id_fkey(
          metaapi_account_id
        )
      `)
      .eq('follower_user_id', user_id)
      .eq('status', 'opened')

    if (error) {
      console.error('Erreur récupération trades:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!openTrades || openTrades.length === 0) {
      console.log(`ℹ️ Aucune position ouverte pour user ${user_id}`)
      return NextResponse.json({ success: true, closed: 0 })
    }

    console.log(`📤 ${openTrades.length} position(s) à fermer pour user ${user_id}`)

    const token = process.env.METAAPI_TOKEN!
    let closedCount = 0
    const errors: string[] = []

    for (const trade of openTrades) {
      try {
        const metaApiAccountId = (trade.mt5_accounts as any)?.metaapi_account_id

        if (metaApiAccountId && trade.follower_ticket) {
          const closeResult = await postMetaApiClosePosition(
            metaApiAccountId,
            String(trade.follower_ticket),
            token,
          )

          if (!closeResult.ok) {
            console.error(`Erreur fermeture position ${trade.follower_ticket}:`, closeResult.error)
            errors.push(`Trade ${trade.id}: ${closeResult.error || 'close failed'}`)
          } else {
            closedCount++
          }
        }

        // Mark as closed in DB regardless (subscription is gone, don't track anymore)
        await supabase
          .from('copy_trades')
          .update({
            status: 'closed',
            closed_at: new Date().toISOString(),
            error_message: closedCount === 0 ? 'Closed due to subscription cancellation' : null,
          })
          .eq('id', trade.id)
      } catch (err: any) {
        console.error(`Erreur trade ${trade.id}:`, err)
        errors.push(err.message)
      }
    }

    console.log(`✅ ${closedCount}/${openTrades.length} positions fermées pour user ${user_id}`)

    return NextResponse.json({
      success: true,
      closed: closedCount,
      total: openTrades.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err: any) {
    console.error('Erreur close-user-positions:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
