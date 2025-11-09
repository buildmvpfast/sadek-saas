'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SubscriptionRequiredPage() {
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    checkSubscription()
  }, [])

  const checkSubscription = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      router.push('/auth/login')
      return
    }

    // Vérifier si l'utilisateur a un abonnement actif
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', session.user.id)
      .single()

    if (subscription?.status === 'active' || subscription?.status === 'trialing') {
      router.push('/dashboard')
    }
  }

  const activateSubscription = async (plan: 'monthly' | 'yearly') => {
    setLoading(plan)
    setError('')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push('/auth/login')
        return
      }

      // Rediriger vers Stripe Checkout
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })

      const { url, error: apiError } = await response.json()

      if (apiError) {
        throw new Error(apiError)
      }

      if (url) {
        window.location.href = url
      } else {
        throw new Error('URL de checkout non reçue')
      }
    } catch (err: any) {
      console.error('❌ Activation error:', err)
      setError(err.message || 'Erreur lors de l\'activation')
      setLoading('')
    }
  }

  return (
    <div className="min-h-screen pattern-bg flex items-center justify-center p-4">
      <div className="max-w-5xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl sm:text-6xl font-black text-white mb-4 tracking-tight">
            L'IMPRIMANTE®
          </h1>
          <div className="h-1 w-32 bg-white mx-auto mb-8"></div>
          <p className="text-2xl font-bold text-white mb-2">
            Rejoins la communauté N°1 de trading francophone
          </p>
          <p className="text-lg text-white text-opacity-90 font-semibold">
            Accède au copy trading et à tous les outils
          </p>
        </div>

        {error && (
          <div className="bg-red-100 border-2 border-red-400 text-red-700 px-6 py-4 rounded-2xl mb-6 font-bold text-center">
            {error}
          </div>
        )}

        {/* Plans de tarification */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Plan Mensuel */}
          <div className="card-white relative">
            <div className="text-center mb-6">
              <h3 className="text-3xl font-black mb-2" style={{ color: '#9b30a8' }}>
                Mensuel
              </h3>
              <div className="flex items-baseline justify-center mb-4">
                <span className="text-6xl font-black" style={{ color: '#9b30a8' }}>
                  29€
                </span>
                <span className="text-2xl font-bold opacity-75 ml-2" style={{ color: '#9b30a8' }}>
                  /mois
                </span>
              </div>
              <p className="text-sm opacity-75" style={{ color: '#9b30a8' }}>
                Engagement mensuel
              </p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-start">
                <span className="text-green-500 text-2xl mr-3">✓</span>
                <p className="font-bold" style={{ color: '#9b30a8' }}>
                  Copy trading automatique
                </p>
              </div>
              <div className="flex items-start">
                <span className="text-green-500 text-2xl mr-3">✓</span>
                <p className="font-bold" style={{ color: '#9b30a8' }}>
                  Configuration personnalisée (GOLD, SOL, BTC)
                </p>
              </div>
              <div className="flex items-start">
                <span className="text-green-500 text-2xl mr-3">✓</span>
                <p className="font-bold" style={{ color: '#9b30a8' }}>
                  Accès à tous les signaux
                </p>
              </div>
              <div className="flex items-start">
                <span className="text-green-500 text-2xl mr-3">✓</span>
                <p className="font-bold" style={{ color: '#9b30a8' }}>
                  Support communauté
                </p>
              </div>
              <div className="flex items-start">
                <span className="text-green-500 text-2xl mr-3">✓</span>
                <p className="font-bold" style={{ color: '#9b30a8' }}>
                  Multi-comptes MT5
                </p>
              </div>
            </div>

            <button
              onClick={() => activateSubscription('monthly')}
              disabled={loading === 'monthly'}
              className="btn btn-primary w-full"
            >
              {loading === 'monthly' ? '⏳ Activation...' : '🚀 Commencer'}
            </button>
          </div>

          {/* Plan Annuel */}
          <div className="card-white relative border-4 border-green-500">
            {/* Badge "Meilleure offre" */}
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="bg-green-500 text-white px-6 py-2 rounded-full font-black text-sm shadow-lg">
                💎 MEILLEURE OFFRE
              </span>
            </div>

            <div className="text-center mb-6 mt-4">
              <h3 className="text-3xl font-black mb-2" style={{ color: '#9b30a8' }}>
                Annuel
              </h3>
              <div className="flex items-baseline justify-center mb-2">
                <span className="text-6xl font-black text-green-600">
                  249€
                </span>
                <span className="text-2xl font-bold opacity-75 ml-2" style={{ color: '#9b30a8' }}>
                  /an
                </span>
              </div>
              <p className="text-sm font-bold text-green-600 mb-2">
                Économise 99€ par an!
              </p>
              <p className="text-sm opacity-75" style={{ color: '#9b30a8' }}>
                Soit 20.75€/mois
              </p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-start">
                <span className="text-green-500 text-2xl mr-3">✓</span>
                <p className="font-bold" style={{ color: '#9b30a8' }}>
                  Copy trading automatique
                </p>
              </div>
              <div className="flex items-start">
                <span className="text-green-500 text-2xl mr-3">✓</span>
                <p className="font-bold" style={{ color: '#9b30a8' }}>
                  Configuration personnalisée (GOLD, SOL, BTC)
                </p>
              </div>
              <div className="flex items-start">
                <span className="text-green-500 text-2xl mr-3">✓</span>
                <p className="font-bold" style={{ color: '#9b30a8' }}>
                  Accès à tous les signaux
                </p>
              </div>
              <div className="flex items-start">
                <span className="text-green-500 text-2xl mr-3">✓</span>
                <p className="font-bold" style={{ color: '#9b30a8' }}>
                  Support communauté prioritaire
                </p>
              </div>
              <div className="flex items-start">
                <span className="text-green-500 text-2xl mr-3">✓</span>
                <p className="font-bold" style={{ color: '#9b30a8' }}>
                  Multi-comptes MT5 illimités
                </p>
              </div>
              <div className="flex items-start">
                <span className="text-green-500 text-2xl mr-3">✓</span>
                <p className="font-bold text-green-600">
                  Accès anticipé aux nouvelles features
                </p>
              </div>
            </div>

            <button
              onClick={() => activateSubscription('yearly')}
              disabled={loading === 'yearly'}
              className="btn w-full bg-green-500 hover:bg-green-600 text-white font-bold text-lg px-6 py-3 rounded-full transition-all duration-300 transform hover:scale-105 shadow-lg"
            >
              {loading === 'yearly' ? '⏳ Activation...' : '💎 Meilleure Offre'}
            </button>
          </div>
        </div>

        {/* Mode Test Notice */}
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-2xl p-6 text-center">
          <p className="font-bold text-yellow-800 mb-2">
            🧪 MODE TEST ACTIVÉ
          </p>
          <p className="text-sm text-yellow-700 font-semibold">
            Clique sur un plan pour activer l'abonnement instantanément (sans paiement).
            En production, cela redirigera vers Stripe.
          </p>
        </div>

        {/* Features */}
        <div className="card-white mt-8">
          <h2 className="text-2xl font-black mb-6 text-center" style={{ color: '#9b30a8' }}>
            Pourquoi rejoindre L'IMPRIMANTE?
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl mb-3">🤖</div>
              <h3 className="font-black mb-2" style={{ color: '#9b30a8' }}>
                Copy Trading Auto
              </h3>
              <p className="text-sm opacity-75" style={{ color: '#9b30a8' }}>
                Les trades de Sadek sont copiés automatiquement sur ton compte
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">⚙️</div>
              <h3 className="font-black mb-2" style={{ color: '#9b30a8' }}>
                100% Personnalisable
              </h3>
              <p className="text-sm opacity-75" style={{ color: '#9b30a8' }}>
                Définis tes lots pour GOLD, SOL, BTC selon ton capital
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">👥</div>
              <h3 className="font-black mb-2" style={{ color: '#9b30a8' }}>
                Communauté Active
              </h3>
              <p className="text-sm opacity-75" style={{ color: '#9b30a8' }}>
                Rejoins des centaines de traders qui progressent ensemble
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

