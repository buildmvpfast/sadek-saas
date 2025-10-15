// Script pour tester le paywall
// Exécute ce script dans la console du navigateur (F12) sur localhost:3000

async function testPaywall() {
  const { createClient } = await import('@supabase/supabase-js')
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'
  )

  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    console.log('❌ Pas de session. Connecte-toi d\'abord.')
    return
  }

  console.log('✅ User ID:', session.user.id)

  // Vérifier l'abonnement actuel
  const { data: currentSub } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', session.user.id)
    .single()

  console.log('📊 Abonnement actuel:', currentSub)

  if (!currentSub) {
    // Créer un abonnement inactif
    const { data, error } = await supabase
      .from('subscriptions')
      .insert({
        user_id: session.user.id,
        status: 'inactive',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date().toISOString(),
      })

    if (error) {
      console.log('❌ Erreur création abonnement:', error)
    } else {
      console.log('✅ Abonnement inactif créé:', data)
      console.log('🔄 Rafraîchis la page pour voir le paywall!')
    }
  } else if (currentSub.status === 'active') {
    // Désactiver l'abonnement
    const { error } = await supabase
      .from('subscriptions')
      .update({ status: 'inactive' })
      .eq('user_id', session.user.id)

    if (error) {
      console.log('❌ Erreur désactivation:', error)
    } else {
      console.log('✅ Abonnement désactivé')
      console.log('🔄 Rafraîchis la page pour voir le paywall!')
    }
  }
}

testPaywall()
