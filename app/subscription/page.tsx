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

  const handleSubscribe = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
      })

      const { url } = await response.json()
      if (url) {
        window.location.href = url
      }
    } catch (err) {
      console.error('Error:', err)
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

      const { url } = await response.json()
      if (url) {
        window.location.href = url
      }
    } catch (err) {
      console.error('Error:', err)
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
              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="btn btn-primary w-full mt-6"
              >
                {loading ? 'Chargement...' : "S'abonner maintenant"}
              </button>
            )}
          </div>

          <div className="card">
            <h2 className="text-xl font-bold mb-4">Plan Copy Trading</h2>
            
            <div className="mb-4">
              <p className="text-3xl font-bold">49€<span className="text-lg text-gray-600">/mois</span></p>
            </div>

            <ul className="space-y-3 text-gray-700">
              <li>✓ Copy trading illimité</li>
              <li>✓ Connexion de jusqu'à 5 comptes MT5</li>
              <li>✓ Exécution instantanée des trades</li>
              <li>✓ Gestion du risk par lot ou %</li>
              <li>✓ Dashboard en temps réel</li>
              <li>✓ Historique complet des trades</li>
              <li>✓ Support prioritaire</li>
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

