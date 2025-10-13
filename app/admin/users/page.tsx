import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'

export default async function AdminUsersPage() {
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

  const { data: users } = await supabase
    .from('profiles')
    .select(`
      *,
      subscriptions(*),
      mt5_accounts(count)
    `)
    .eq('is_admin', false)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar isAdmin={true} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Gestion des Utilisateurs</h1>

        <div className="card">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Utilisateur</th>
                  <th className="text-left py-3 px-4">Email</th>
                  <th className="text-left py-3 px-4">Abonnement</th>
                  <th className="text-left py-3 px-4">Comptes MT5</th>
                  <th className="text-left py-3 px-4">Inscrit le</th>
                </tr>
              </thead>
              <tbody>
                {users && users.length > 0 ? (
                  users.map((user: any) => (
                    <tr key={user.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">
                        {user.full_name || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-gray-600">{user.email}</td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-sm ${
                          user.subscriptions?.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : user.subscriptions?.status === 'trialing'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.subscriptions?.status || 'inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {user.mt5_accounts?.[0]?.count || 0}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {new Date(user.created_at).toLocaleDateString('fr-FR')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      Aucun utilisateur pour le moment
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

