'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function Navbar({ isAdmin = false }: { isAdmin?: boolean }) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href={isAdmin ? '/admin/dashboard' : '/dashboard'} className="text-xl font-bold text-primary-600">
              MT5 Copy Trading
            </Link>
          </div>
          
          <div className="flex items-center space-x-4">
            {isAdmin ? (
              <>
                <Link href="/admin/dashboard" className="text-gray-700 hover:text-primary-600">
                  Dashboard
                </Link>
                <Link href="/admin/users" className="text-gray-700 hover:text-primary-600">
                  Utilisateurs
                </Link>
                <Link href="/admin/trades" className="text-gray-700 hover:text-primary-600">
                  Trades
                </Link>
              </>
            ) : (
              <>
                <Link href="/dashboard" className="text-gray-700 hover:text-primary-600">
                  Dashboard
                </Link>
                <Link href="/mt5-accounts" className="text-gray-700 hover:text-primary-600">
                  Comptes MT5
                </Link>
                <Link href="/settings" className="text-gray-700 hover:text-primary-600">
                  Paramètres
                </Link>
                <Link href="/subscription" className="text-gray-700 hover:text-primary-600">
                  Abonnement
                </Link>
              </>
            )}
            <button
              onClick={handleLogout}
              className="btn btn-secondary"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

