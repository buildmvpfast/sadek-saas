'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchSubscription()
  }, [])

  const fetchSubscription = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      router.push('/auth/login')
      return
    }

    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', session.user.id)
      .single()

    if (data) setSubscription(data)
  }

  const handleSubscribe = async (plan: 'monthly' | 'yearly' = 'monthly') => {
    setLoading(true)
    try {
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
      console.error('Error:', err)
      alert(err.message || 'Erreur lors de la création de la session de paiement')
    } finally {
      setLoading(false)
    }
  }

  const handleManageSubscription = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la création de la session')
      }

      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('URL du portail non reçue')
      }
    } catch (err: any) {
      console.error('Error:', err)
      alert(err.message || 'Erreur lors de l\'ouverture du portail de gestion')
    } finally {
      setLoading(false)
    }
  }

  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing'

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Abonnement</h1>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Statut Actuel</h2>
            
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Statut</p>
                <p className="text-lg font-semibold">
                  {subscription?.status === 'active' && (
                    <span className="text-green-600">Actif</span>
                  )}
                  {subscription?.status === 'trialing' && (
                    <span className="text-blue-600">Période d'essai</span>
                  )}
                  {subscription?.status === 'inactive' && (
                    <span className="text-red-600">Inactif</span>
                  )}
                  {subscription?.status === 'canceled' && (
                    <span className="text-orange-600">Annulé</span>
                  )}
                  {subscription?.status === 'past_due' && (
                    <span className="text-red-600">Paiement en retard</span>
                  )}
                </p>
              </div>

              {subscription?.current_period_end && (
                <div>
                  <p className="text-sm text-gray-600">Fin de période</p>
                  <p className="text-lg font-semibold">
                    {new Date(subscription.current_period_end).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              )}
            </div>

            {isActive ? (
              <button
                onClick={handleManageSubscription}
                disabled={loading}
                className="btn btn-secondary w-full mt-6"
              >
                {loading ? 'Chargement...' : 'Gérer mon abonnement'}
              </button>
            ) : (
              <div className="space-y-3 mt-6">
                <button
                  onClick={() => handleSubscribe('monthly')}
                  disabled={loading}
                  className="btn btn-primary w-full"
                >
                  {loading ? 'Chargement...' : "S'abonner - Mensuel"}
                </button>
                <button
                  onClick={() => handleSubscribe('yearly')}
                  disabled={loading}
                  className="btn w-full bg-green-500 hover:bg-green-600 text-white"
                >
                  {loading ? 'Chargement...' : "S'abonner - Annuel (Meilleure offre)"}
                </button>
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="text-xl font-bold mb-4">🔹 Plan Basique</h2>
            
            <div className="mb-4">
              <p className="text-3xl font-bold">
                {subscription?.stripe_subscription_id ? (
                  subscription.current_period_end && 
                  new Date(subscription.current_period_end) > new Date() ? (
                    '22,99€' // Si abonnement annuel actif
                  ) : '29,99€'
                ) : '29,99€'}
                <span className="text-lg text-gray-600">/mois</span>
              </p>
            </div>

            <ul className="space-y-3 text-gray-700">
              <li>✓ 1 compte connecté</li>
              <li>✓ 1 canal connecté</li>
              <li>✓ 5 actifs tradables</li>
              <li>✓ 10 positions simultanées maximum</li>
              <li>✓ Exécution instantanée des trades</li>
              <li>✓ Dashboard en temps réel</li>
              <li>✓ Historique complet des trades</li>
            </ul>
          </div>
        </div>

        {!isActive && (
          <div className="card mt-6 bg-yellow-50 border border-yellow-200">
            <h3 className="font-bold text-yellow-800 mb-2">⚠️ Abonnement requis</h3>
            <p className="text-yellow-700">
              Vous devez avoir un abonnement actif pour que vos comptes MT5 reçoivent les signaux de trading.
              Sans abonnement actif, aucune position ne sera copiée.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

