'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

type TelegramChannel = {
  id: string
  name: string
  username: string
  description: string
  is_premium: boolean
  created_at: string
}

type UserSubscription = {
  id: string
  channel_id: string
  is_active: boolean
}

export default function TelegramChannelsPage() {
  const [channels, setChannels] = useState<TelegramChannel[]>([])
  const [userSubscriptions, setUserSubscriptions] = useState<UserSubscription[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      router.push('/auth/login')
      return
    }

    // Récupérer uniquement les canaux avec un token actif
    const { data: channelsData } = await supabase
      .from('telegram_channels')
      .select(`
        *,
        telegram_bot_tokens!inner(is_active)
      `)
      .eq('is_active', true)
      .eq('telegram_bot_tokens.is_active', true)

    // Récupérer les abonnements de l'utilisateur
    const { data: subscriptionsData } = await supabase
      .from('user_telegram_subscriptions')
      .select('*')
      .eq('user_id', session.user.id)

    if (channelsData) setChannels(channelsData)
    if (subscriptionsData) setUserSubscriptions(subscriptionsData)
  }

  const toggleSubscription = async (channelId: string) => {
    setLoading(true)
    setError('')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) throw new Error('Non authentifié')

      const existingSubscription = userSubscriptions.find(sub => sub.channel_id === channelId)

      if (existingSubscription) {
        // Désabonner
        const { error } = await supabase
          .from('user_telegram_subscriptions')
          .delete()
          .eq('id', existingSubscription.id)

        if (error) throw error
      } else {
        // S'abonner
        const { error } = await supabase
          .from('user_telegram_subscriptions')
          .insert({
            user_id: session.user.id,
            channel_id: channelId,
            is_active: true
          })

        if (error) throw error
      }

      fetchData() // Recharger les données
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  const isSubscribed = (channelId: string) => {
    return userSubscriptions.some(sub => sub.channel_id === channelId)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Canaux Telegram</h1>
          <p className="text-gray-600">
            Choisissez les canaux Telegram que vous souhaitez suivre pour recevoir automatiquement les signaux de trading.
          </p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="grid gap-6">
          {channels.map((channel) => (
            <div key={channel.id} className="card">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center mb-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-lg mr-3">
                      {channel.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        {channel.name}
                      </h3>
                      <p className="text-gray-600">
                        @{channel.username}
                      </p>
                    </div>
                  </div>
                  {channel.description && (
                    <p className="text-gray-500 text-sm mb-3">
                      {channel.description}
                    </p>
                  )}
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                    channel.is_premium ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {channel.is_premium ? '⭐ Premium' : '🆓 Gratuit'}
                  </span>
                </div>
                
                <button
                  onClick={() => toggleSubscription(channel.id)}
                  disabled={loading}
                  className={`px-6 py-3 rounded-lg font-bold transition-all ${
                    isSubscribed(channel.id)
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  {loading ? '...' : isSubscribed(channel.id) ? 'Se désabonner' : 'S\'abonner'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {channels.length === 0 && (
          <div className="card text-center py-12">
            <p className="text-xl font-bold text-gray-900 mb-2">
              Aucun canal disponible
            </p>
            <p className="text-gray-600">
              Les canaux Telegram seront ajoutés prochainement.
            </p>
          </div>
        )}

        <div className="mt-8 bg-blue-50 border-2 border-blue-400 rounded-lg p-6">
          <h3 className="text-lg font-bold text-blue-800 mb-2">
            📱 Comment ça marche?
          </h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Abonnez-vous aux canaux qui vous intéressent</li>
            <li>• Les signaux seront automatiquement détectés et exécutés sur votre compte MT5</li>
            <li>• Vous recevrez une notification à chaque trade exécuté</li>
            <li>• Vous pouvez vous désabonner à tout moment</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
