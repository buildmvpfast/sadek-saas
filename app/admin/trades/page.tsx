import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'

export default async function AdminTradesPage() {
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

  const { data: trades } = await supabase
    .from('copy_trades')
    .select(`
      *,
      follower:profiles!copy_trades_follower_user_id_fkey(full_name, email)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar isAdmin={true} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Historique des Trades</h1>

        <div className="card">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-left py-3 px-4">Utilisateur</th>
                  <th className="text-left py-3 px-4">Symbole</th>
                  <th className="text-left py-3 px-4">Type</th>
                  <th className="text-left py-3 px-4">Volume</th>
                  <th className="text-left py-3 px-4">Prix</th>
                  <th className="text-left py-3 px-4">Statut</th>
                </tr>
              </thead>
              <tbody>
                {trades && trades.length > 0 ? (
                  trades.map((trade: any) => (
                    <tr key={trade.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(trade.created_at).toLocaleString('fr-FR')}
                      </td>
                      <td className="py-3 px-4">
                        {trade.follower?.full_name || trade.follower?.email}
                      </td>
                      <td className="py-3 px-4 font-semibold">{trade.symbol}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          trade.order_type.includes('BUY')
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {trade.order_type}
                        </span>
                      </td>
                      <td className="py-3 px-4">{trade.volume}</td>
                      <td className="py-3 px-4">{trade.open_price.toFixed(5)}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          trade.status === 'opened' ? 'bg-blue-100 text-blue-800' :
                          trade.status === 'closed' ? 'bg-green-100 text-green-800' :
                          trade.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {trade.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      Aucun trade pour le moment
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

