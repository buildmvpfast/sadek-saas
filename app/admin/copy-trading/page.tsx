'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

type CopyTrade = {
  id: string
  symbol: string
  order_type: string
  volume: number
  status: string
  opened_at: string
  closed_at: string | null
  follower_user_id: string
  profiles: {
    full_name: string
  }
}

export default function CopyTradingControlPage() {
  const [isRunning, setIsRunning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [recentTrades, setRecentTrades] = useState<CopyTrade[]>([])
  const [stats, setStats] = useState({
    totalCopied: 0,
    successRate: 0,
    activePositions: 0,
  })

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    checkAdmin()
    checkServiceStatus()
    fetchRecentTrades()
    
    // Rafraîchir toutes les 10 secondes
    const interval = setInterval(() => {
      fetchRecentTrades()
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  const checkAdmin = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      router.push('/auth/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single()

    if (!profile?.is_admin) {
      router.push('/dashboard')
    }
  }

  const checkServiceStatus = async () => {
    try {
      const response = await fetch('/api/start-copy-trading-v2')
      const data = await response.json()
      setIsRunning(data.running)
    } catch (error) {
      console.error('Error checking service status:', error)
    }
  }

  const fetchRecentTrades = async () => {
    const { data } = await supabase
      .from('copy_trades')
      .select(`
        *,
        profiles!copy_trades_follower_user_id_fkey(full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) {
      setRecentTrades(data as any)

      // Calculer les stats
      const total = data.length
      const successful = data.filter((t) => t.status === 'opened' || t.status === 'closed').length
      const active = data.filter((t) => t.status === 'opened').length

      setStats({
        totalCopied: total,
        successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
        activePositions: active,
      })
    }
  }

  const startService = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/start-copy-trading-v2', {
        method: 'POST',
      })
      const data = await response.json()

      if (data.success) {
        setIsRunning(true)
        alert('✅ Copy trading démarré!')
      } else {
        alert('❌ Erreur: ' + data.error)
      }
    } catch (error) {
      alert('❌ Erreur lors du démarrage')
    } finally {
      setLoading(false)
    }
  }

  const stopService = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/start-copy-trading-v2', {
        method: 'DELETE',
      })
      const data = await response.json()

      if (data.success) {
        setIsRunning(false)
        alert('⏸️ Copy trading arrêté')
      }
    } catch (error) {
      alert('❌ Erreur lors de l\'arrêt')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen pattern-bg">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-white mb-2">
            Copy Trading Control 🎛️
          </h1>
          <p className="text-white text-opacity-90 text-lg font-semibold">
            Gérez le service de copie automatique des trades
          </p>
        </div>

        {/* Status du service */}
        <div className="card-white mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black mb-2" style={{ color: '#9b30a8' }}>
                Statut du Service
              </h2>
              <div className="flex items-center gap-3">
                <span
                  className={`w-4 h-4 rounded-full ${
                    isRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                  }`}
                ></span>
                <span className="text-xl font-bold" style={{ color: '#9b30a8' }}>
                  {isRunning ? '🟢 En cours d\'exécution' : '🔴 Arrêté'}
                </span>
              </div>
            </div>

            {isRunning ? (
              <button
                onClick={stopService}
                disabled={loading}
                className="px-8 py-4 rounded-2xl font-black text-lg bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg hover:scale-105"
              >
                {loading ? '⏳ Arrêt...' : '⏸️ Arrêter'}
              </button>
            ) : (
              <button
                onClick={startService}
                disabled={loading}
                className="px-8 py-4 rounded-2xl font-black text-lg bg-green-500 text-white hover:bg-green-600 transition-all shadow-lg hover:scale-105"
              >
                {loading ? '⏳ Démarrage...' : '▶️ Démarrer'}
              </button>
            )}
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="card-white text-center">
            <h3 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: '#9b30a8' }}>
              Trades Copiés
            </h3>
            <p className="text-5xl font-black" style={{ color: '#9b30a8' }}>
              {stats.totalCopied}
            </p>
          </div>

          <div className="card-white text-center">
            <h3 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: '#9b30a8' }}>
              Taux de Succès
            </h3>
            <p className="text-5xl font-black" style={{ color: '#9b30a8' }}>
              {stats.successRate}%
            </p>
          </div>

          <div className="card-white text-center">
            <h3 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: '#9b30a8' }}>
              Positions Actives
            </h3>
            <p className="text-5xl font-black" style={{ color: '#9b30a8' }}>
              {stats.activePositions}
            </p>
          </div>
        </div>

        {/* Trades récents */}
        <div className="card-white">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black" style={{ color: '#9b30a8' }}>
              Trades Récents
            </h2>
            <button
              onClick={fetchRecentTrades}
              className="px-4 py-2 rounded-xl font-bold bg-blue-500 text-white hover:bg-blue-600 transition-all"
            >
              🔄 Rafraîchir
            </button>
          </div>

          {recentTrades.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-primary-200">
                    <th className="text-left py-3 px-4 font-black" style={{ color: '#9b30a8' }}>
                      Utilisateur
                    </th>
                    <th className="text-left py-3 px-4 font-black" style={{ color: '#9b30a8' }}>
                      Symbole
                    </th>
                    <th className="text-left py-3 px-4 font-black" style={{ color: '#9b30a8' }}>
                      Type
                    </th>
                    <th className="text-left py-3 px-4 font-black" style={{ color: '#9b30a8' }}>
                      Volume
                    </th>
                    <th className="text-left py-3 px-4 font-black" style={{ color: '#9b30a8' }}>
                      Statut
                    </th>
                    <th className="text-left py-3 px-4 font-black" style={{ color: '#9b30a8' }}>
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentTrades.map((trade) => (
                    <tr key={trade.id} className="border-b border-primary-100 hover:bg-primary-50 transition-all">
                      <td className="py-3 px-4 font-semibold" style={{ color: '#9b30a8' }}>
                        {trade.profiles?.full_name || 'N/A'}
                      </td>
                      <td className="py-3 px-4 font-bold" style={{ color: '#9b30a8' }}>
                        {trade.symbol}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-bold ${
                            trade.order_type === 'BUY' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                          }`}
                        >
                          {trade.order_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold" style={{ color: '#9b30a8' }}>
                        {trade.volume}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-bold ${
                            trade.status === 'opened'
                              ? 'bg-blue-500 text-white'
                              : trade.status === 'closed'
                              ? 'bg-green-500 text-white'
                              : trade.status === 'failed'
                              ? 'bg-red-500 text-white'
                              : 'bg-gray-400 text-white'
                          }`}
                        >
                          {trade.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm font-semibold" style={{ color: '#9b30a8' }}>
                        {new Date(trade.opened_at).toLocaleString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-xl font-bold" style={{ color: '#9b30a8' }}>
                Aucun trade copié pour le moment
              </p>
              <p className="opacity-75 mt-2" style={{ color: '#9b30a8' }}>
                Les trades apparaîtront ici dès qu'ils seront copiés
              </p>
            </div>
          )}
        </div>

        {/* Guide */}
        <div className="card-white mt-8">
          <h2 className="text-2xl font-black mb-4" style={{ color: '#9b30a8' }}>
            📘 Comment ça marche?
          </h2>
          <div className="space-y-3 opacity-90" style={{ color: '#9b30a8' }}>
            <p className="font-semibold">
              <strong>1. Démarrez le service:</strong> Cliquez sur "Démarrer" pour activer le monitoring
            </p>
            <p className="font-semibold">
              <strong>2. Le service monitore:</strong> Toutes les 5 secondes, il vérifie les positions
              des comptes admin
            </p>
            <p className="font-semibold">
              <strong>3. Copie automatique:</strong> Dès qu'une position est détectée, elle est
              copiée sur tous les comptes utilisateurs actifs
            </p>
            <p className="font-semibold">
              <strong>4. Adaptation:</strong> Les lots sont adaptés selon les settings de chaque
              utilisateur (GOLD, SOL, BTC)
            </p>
            <p className="font-semibold">
              <strong>5. Mapping:</strong> Les symboles sont automatiquement mappés selon le broker
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

