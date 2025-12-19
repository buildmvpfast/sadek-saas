#!/usr/bin/env node

/**
 * Script de vérification complète du flow Telegram
 * Usage: node check-telegram-flow.js
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkTelegramFlow() {
  console.log('🔍 Vérification complète du flow Telegram...\n')

  // 1. Vérifier le canal
  console.log('1️⃣ Vérification du canal Telegram...')
  const { data: channels, error: channelError } = await supabase
    .from('telegram_channels')
    .select(`
      id,
      name,
      username,
      is_active,
      telegram_bot_tokens!inner(is_active)
    `)
    .eq('is_active', true)
    .eq('telegram_bot_tokens.is_active', true)

  if (channelError) {
    console.error('❌ Erreur:', channelError)
    return
  }

  if (!channels || channels.length === 0) {
    console.log('❌ Aucun canal configuré avec token actif')
    return
  }

  console.log(`✅ ${channels.length} canal(x) configuré(s):`)
  channels.forEach(c => {
    console.log(`   - ${c.name} (@${c.username})`)
  })
  console.log()

  // 2. Vérifier les signaux
  console.log('2️⃣ Vérification des signaux reçus...')
  const { data: signals, error: signalsError } = await supabase
    .from('telegram_signals')
    .select('id, channel_id, signal_type, symbol, parsed_at')
    .order('parsed_at', { ascending: false })
    .limit(10)

  if (signalsError) {
    console.error('❌ Erreur:', signalsError)
    return
  }

  if (!signals || signals.length === 0) {
    console.log('⚠️  Aucun signal reçu pour le moment')
    console.log('   → Envoie un message dans le canal Telegram pour tester')
  } else {
    console.log(`✅ ${signals.length} signal(x) reçu(s):`)
    signals.forEach(s => {
      console.log(`   - ${s.signal_type} ${s.symbol} (${new Date(s.parsed_at).toLocaleString()})`)
    })
  }
  console.log()

  // 3. Vérifier les abonnements utilisateurs
  console.log('3️⃣ Vérification des abonnements utilisateurs...')
  const { data: subscriptions, error: subsError } = await supabase
    .from('user_telegram_subscriptions')
    .select(`
      user_id,
      channel_id,
      is_active,
      telegram_channels!inner(name, username)
    `)
    .eq('is_active', true)

  if (subsError) {
    console.error('❌ Erreur:', subsError)
    return
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log('⚠️  Aucun utilisateur abonné aux canaux')
  } else {
    console.log(`✅ ${subscriptions.length} utilisateur(s) abonné(s)`)
    const uniqueUsers = new Set(subscriptions.map(s => s.user_id))
    console.log(`   → ${uniqueUsers.size} utilisateur(s) unique(s)`)
  }
  console.log()

  // 4. Vérifier les abonnements Stripe actifs
  console.log('4️⃣ Vérification des abonnements Stripe actifs...')
  if (subscriptions && subscriptions.length > 0) {
    const userIds = [...new Set(subscriptions.map(s => s.user_id))]
    const { data: activeSubs, error: activeSubsError } = await supabase
      .from('subscriptions')
      .select('user_id, status')
      .in('user_id', userIds)
      .eq('status', 'active')

    if (activeSubsError) {
      console.error('❌ Erreur:', activeSubsError)
    } else {
      if (!activeSubs || activeSubs.length === 0) {
        console.log('⚠️  Aucun utilisateur avec abonnement Stripe actif')
      } else {
        console.log(`✅ ${activeSubs.length} utilisateur(s) avec abonnement actif`)
      }
    }
  }
  console.log()

  // 5. Vérifier les comptes MT5 actifs
  console.log('5️⃣ Vérification des comptes MT5 actifs...')
  if (subscriptions && subscriptions.length > 0) {
    const userIds = [...new Set(subscriptions.map(s => s.user_id))]
    const { data: mt5Accounts, error: mt5Error } = await supabase
      .from('mt5_accounts')
      .select('user_id, broker_name, is_active, metaapi_account_id')
      .in('user_id', userIds)
      .eq('is_active', true)

    if (mt5Error) {
      console.error('❌ Erreur:', mt5Error)
    } else {
      if (!mt5Accounts || mt5Accounts.length === 0) {
        console.log('⚠️  Aucun compte MT5 actif pour les utilisateurs abonnés')
      } else {
        console.log(`✅ ${mt5Accounts.length} compte(s) MT5 actif(s):`)
        mt5Accounts.forEach(acc => {
          const hasMetaApi = acc.metaapi_account_id ? '✅' : '❌'
          console.log(`   - ${acc.broker_name} (MetaAPI: ${hasMetaApi})`)
        })
      }
    }
  }
  console.log()

  // 6. Vérifier les trades créés
  console.log('6️⃣ Vérification des trades créés...')
  const { data: trades, error: tradesError } = await supabase
    .from('telegram_trades')
    .select('id, user_id, symbol, signal_type, status, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  if (tradesError) {
    console.error('❌ Erreur:', tradesError)
    return
  }

  if (!trades || trades.length === 0) {
    console.log('⚠️  Aucun trade créé pour le moment')
    console.log('   → Les trades sont créés quand un signal arrive ET qu\'un utilisateur est abonné')
  } else {
    const pending = trades.filter(t => t.status === 'pending')
    const executed = trades.filter(t => t.status === 'executed')
    const failed = trades.filter(t => t.status === 'failed')

    console.log(`✅ ${trades.length} trade(s) total:`)
    console.log(`   - ${pending.length} en attente (pending)`)
    console.log(`   - ${executed.length} exécuté(s)`)
    console.log(`   - ${failed.length} échoué(s)`)
    
    if (pending.length > 0) {
      console.log('\n   📋 Trades en attente:')
      pending.forEach(t => {
        console.log(`      - ${t.signal_type} ${t.symbol} (${new Date(t.created_at).toLocaleString()})`)
      })
    }
  }
  console.log()

  // 7. Résumé
  console.log('📊 RÉSUMÉ:')
  console.log(`   - Canaux configurés: ${channels?.length || 0}`)
  console.log(`   - Signaux reçus: ${signals?.length || 0}`)
  console.log(`   - Utilisateurs abonnés: ${subscriptions ? new Set(subscriptions.map(s => s.user_id)).size : 0}`)
  console.log(`   - Trades créés: ${trades?.length || 0}`)
  console.log(`   - Trades en attente: ${trades?.filter(t => t.status === 'pending').length || 0}`)
  console.log()

  // 8. Diagnostic
  if (trades && trades.length > 0 && trades.filter(t => t.status === 'pending').length > 0) {
    console.log('✅ Le système fonctionne! Les trades en attente seront exécutés par le worker Render.')
  } else if (signals && signals.length > 0 && (!trades || trades.length === 0)) {
    console.log('⚠️  Des signaux arrivent mais aucun trade n\'est créé.')
    console.log('   → Vérifie que des utilisateurs sont abonnés au canal')
    console.log('   → Vérifie qu\'ils ont un abonnement Stripe actif')
    console.log('   → Vérifie qu\'ils ont un compte MT5 actif')
  } else if (!signals || signals.length === 0) {
    console.log('⚠️  Aucun signal reçu.')
    console.log('   → Vérifie que le webhook Telegram est configuré')
    console.log('   → Envoie un message dans le canal Telegram')
    console.log('   → Vérifie les logs Vercel pour voir si le webhook reçoit les messages')
  }
}

checkTelegramFlow().catch(console.error)

