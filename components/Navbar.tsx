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
    <nav className="shadow-2xl" style={{ backgroundColor: '#9b30a8' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          <div className="flex items-center">
            <Link href={isAdmin ? '/admin/dashboard' : '/dashboard'} className="text-2xl font-black text-white tracking-tight">
              L'IMPRIMANTE®
            </Link>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-4">
            {isAdmin ? (
              <>
                <Link href="/admin/dashboard" className="text-white hover:text-primary-200 font-semibold px-3 py-2 rounded-lg transition-colors">
                  Dashboard
                </Link>
                <Link href="/admin/mt5-accounts" className="text-white hover:text-primary-200 font-semibold px-3 py-2 rounded-lg transition-colors">
                  Comptes MT5
                </Link>
                <Link href="/admin/copy-trading" className="text-white hover:text-primary-200 font-semibold px-3 py-2 rounded-lg transition-colors">
                  Copy Trading
                </Link>
                <Link href="/admin/users" className="text-white hover:text-primary-200 font-semibold px-3 py-2 rounded-lg transition-colors hidden lg:block">
                  Users
                </Link>
                <Link href="/admin/trades" className="text-white hover:text-primary-200 font-semibold px-3 py-2 rounded-lg transition-colors hidden lg:block">
                  Trades
                </Link>
              </>
            ) : (
              <>
                <Link href="/dashboard" className="text-white hover:text-primary-200 font-semibold px-3 py-2 rounded-lg transition-colors hidden sm:block">
                  Dashboard
                </Link>
                <Link href="/mt5-accounts" className="text-white hover:text-primary-200 font-semibold px-3 py-2 rounded-lg transition-colors">
                  MT5
                </Link>
                <Link href="/telegram-channels" className="text-white hover:text-primary-200 font-semibold px-3 py-2 rounded-lg transition-colors">
                  Canaux
                </Link>
                <Link href="/settings" className="text-white hover:text-primary-200 font-semibold px-3 py-2 rounded-lg transition-colors hidden sm:block">
                  Paramètres
                </Link>
                <Link href="/subscription" className="text-white hover:text-primary-200 font-semibold px-3 py-2 rounded-lg transition-colors hidden sm:block">
                  Abo
                </Link>
              </>
            )}
            <button
              onClick={handleLogout}
              className="bg-white hover:bg-primary-100 font-bold px-4 py-2 rounded-full transition-all transform hover:scale-105"
              style={{ color: '#9b30a8' }}
            >
              Déco
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

