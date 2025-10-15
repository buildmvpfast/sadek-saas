// Script pour créer un abonnement inactif et tester le paywall
// Exécute ce script dans la console du navigateur (F12) sur localhost:3002

async function createInactiveSubscription() {
  // Récupérer les clés Supabase depuis les variables d'environnement
  const supabaseUrl = 'https://your-project.supabase.co' // Remplace par ton URL
  const supabaseKey = 'your-anon-key' // Remplace par ta clé anon
  
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    console.log('❌ Pas de session. Connecte-toi d\'abord sur localhost:3002')
    return
  }

  console.log('✅ User ID:', session.user.id)
  console.log('📧 Email:', session.user.email)

  // Vérifier si l'utilisateur a déjà un abonnement
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', session.user.id)
    .single()

  if (existingSub) {
    console.log('📊 Abonnement existant:', existingSub)
    
    // Désactiver l'abonnement existant
    const { error } = await supabase
      .from('subscriptions')
      .update({ 
        status: 'inactive',
        current_period_end: new Date().toISOString()
      })
      .eq('user_id', session.user.id)

    if (error) {
      console.log('❌ Erreur désactivation:', error)
    } else {
      console.log('✅ Abonnement désactivé!')
      console.log('🔄 Rafraîchis la page pour voir le paywall!')
    }
  } else {
    // Créer un nouvel abonnement inactif
    const { data, error } = await supabase
      .from('subscriptions')
      .insert({
        user_id: session.user.id,
        status: 'inactive',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (error) {
      console.log('❌ Erreur création abonnement:', error)
    } else {
      console.log('✅ Abonnement inactif créé:', data)
      console.log('🔄 Rafraîchis la page pour voir le paywall!')
    }
  }
}

createInactiveSubscription()
