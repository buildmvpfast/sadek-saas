import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Link from 'next/link'

export default async function DashboardPage() {
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

  if (profile?.is_admin) {
    redirect('/admin/dashboard')
  }

  const { data: mt5Accounts } = await supabase
    .from('mt5_accounts')
    .select('*, brokers(*)')
    .eq('user_id', session.user.id)
    .eq('is_active', true)

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', session.user.id)
    .single()

  const { data: copyTrades } = await supabase
    .from('copy_trades')
    .select('*')
    .eq('follower_user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Bienvenue, {profile?.full_name || 'Utilisateur'}
          </h1>
          <p className="text-gray-600 mt-2">
            Gérez vos comptes MT5 et suivez vos trades
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <h3 className="text-sm font-medium text-gray-500">Statut Abonnement</h3>
            <p className="text-2xl font-bold mt-2">
              {subscription?.status === 'active' ? (
                <span className="text-green-600">Actif</span>
              ) : subscription?.status === 'trialing' ? (
                <span className="text-blue-600">Essai</span>
              ) : (
                <span className="text-red-600">Inactif</span>
              )}
            </p>
          </div>

          <div className="card">
            <h3 className="text-sm font-medium text-gray-500">Comptes MT5 Actifs</h3>
            <p className="text-2xl font-bold mt-2">{mt5Accounts?.length || 0}</p>
          </div>

          <div className="card">
            <h3 className="text-sm font-medium text-gray-500">Trades Copiés</h3>
            <p className="text-2xl font-bold mt-2">{copyTrades?.length || 0}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Comptes MT5</h2>
              <Link href="/mt5-accounts" className="btn btn-primary">
                Gérer
              </Link>
            </div>
            
            {mt5Accounts && mt5Accounts.length > 0 ? (
              <div className="space-y-3">
                {mt5Accounts.map((account: any) => (
                  <div key={account.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold">{account.brokers.name}</p>
                        <p className="text-sm text-gray-600">#{account.account_number}</p>
                      </div>
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                        Actif
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>Aucun compte MT5 connecté</p>
                <Link href="/mt5-accounts" className="text-primary-600 hover:underline mt-2 inline-block">
                  Ajouter un compte
                </Link>
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="text-xl font-bold mb-4">Derniers Trades</h2>
            
            {copyTrades && copyTrades.length > 0 ? (
              <div className="space-y-3">
                {copyTrades.slice(0, 5).map((trade: any) => (
                  <div key={trade.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold">{trade.symbol}</p>
                        <p className="text-sm text-gray-600">{trade.order_type} • {trade.volume} lots</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm ${
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
                <p>Aucun trade pour le moment</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

