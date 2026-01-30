import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'

export default async function AdminDashboardPage() {
  const supabase = createServerClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (!profile?.is_admin) {
    redirect('/dashboard')
  }

  const { data: users, count: usersCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .eq('is_admin', false)

  const { data: activeSubscriptions, count: activeSubsCount } = await supabase
    .from('subscriptions')
    .select('*', { count: 'exact' })
    .in('status', ['active', 'trialing'])

  const { data: mt5Accounts, count: mt5Count } = await supabase
    .from('mt5_accounts')
    .select('*', { count: 'exact' })
    .eq('is_active', true)

  // Récupérer les derniers trades des deux sources
  const [copyTradesResult, telegramTradesResult] = await Promise.all([
    supabase
      .from('copy_trades')
      .select('*, profiles!copy_trades_follower_user_id_fkey(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('telegram_trades')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
  ]);

  const copyTradesRaw = copyTradesResult.data || [];
  const telegramTradesRaw = telegramTradesResult.data || [];

  // Récupérer les profils pour les trades Telegram
  const telegramUserIds = Array.from(new Set(telegramTradesRaw.map((t: any) => t.user_id)));
  const { data: telegramProfiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', telegramUserIds);
  
  const telegramProfileMap = Object.fromEntries(
    (telegramProfiles || []).map((p: any) => [p.id, p])
  );

  const recentTrades = [
    ...copyTradesRaw.map((t: any) => ({ ...t, source: 'copy' })),
    ...telegramTradesRaw.map((t: any) => ({
      ...t,
      source: 'telegram',
      profiles: telegramProfileMap[t.user_id],
      order_type: `${t.signal_type} ${t.order_type || 'MARKET'}`,
      status: t.status === 'executed' ? 'opened' : t.status
    }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const { data: adminMt5Account } = await supabase
    .from('mt5_accounts')
    .select('id, account_number, broker_name, server_name, is_active, metaapi_account_id')
    .eq('user_id', session.user.id)
    .eq('is_active', true)
    .single()

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar isAdmin={true} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Admin</h1>
          <p className="text-gray-600 mt-2">Gérez vos utilisateurs et surveillez l'activité</p>
        </div>

        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <h3 className="text-sm font-medium text-gray-500">Utilisateurs Total</h3>
            <p className="text-3xl font-bold mt-2 text-primary-600">{usersCount || 0}</p>
          </div>

          <div className="card">
            <h3 className="text-sm font-medium text-gray-500">Abonnements Actifs</h3>
            <p className="text-3xl font-bold mt-2 text-green-600">{activeSubsCount || 0}</p>
          </div>

          <div className="card">
            <h3 className="text-sm font-medium text-gray-500">Comptes MT5 Actifs</h3>
            <p className="text-3xl font-bold mt-2 text-blue-600">{mt5Count || 0}</p>
          </div>

          <div className="card">
            <h3 className="text-sm font-medium text-gray-500">Revenus Mensuel</h3>
            <p className="text-3xl font-bold mt-2 text-purple-600">
              {((activeSubsCount || 0) * 49).toFixed(0)}€
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Votre Compte MT5 (Master)</h2>
            
            {adminMt5Account ? (
              <div className="border rounded-lg p-4 bg-green-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-lg">{adminMt5Account.broker_name || 'N/A'}</p>
                    <p className="text-gray-600">Compte #{adminMt5Account.account_number}</p>
                    {adminMt5Account.server_name && (
                      <p className="text-sm text-gray-500">{adminMt5Account.server_name}</p>
                    )}
                    <p className="text-sm text-green-600 mt-2">✓ Actif - Copie en cours</p>
                  </div>
                  <span className="px-4 py-2 bg-green-600 text-white rounded-full font-semibold">
                    MASTER
                  </span>
                </div>
              </div>
            ) : (
              <div className="border rounded-lg p-6 text-center">
                <p className="text-gray-500 mb-4">Aucun compte MT5 configuré</p>
                <a href="/mt5-accounts" className="btn btn-primary">
                  Configurer le compte master
                </a>
              </div>
            )}

            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Les positions prises sur ce compte seront automatiquement copiées 
                sur tous les comptes utilisateurs avec abonnement actif.
              </p>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-bold mb-4">Derniers Trades Copiés</h2>
            
            {recentTrades && recentTrades.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {recentTrades.map((trade: any) => (
                  <div key={trade.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{trade.symbol}</p>
                        <p className="text-sm text-gray-600">
                          {trade.profiles?.full_name || trade.profiles?.email}
                        </p>
                        <p className="text-xs text-gray-500">
                          {trade.order_type} • {trade.volume} lots
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${
                        trade.status === 'opened' ? 'bg-blue-100 text-blue-800' :
                        trade.status === 'closed' ? 'bg-green-100 text-green-800' :
                        trade.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {trade.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>Aucun trade copié pour le moment</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

