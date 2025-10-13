'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

export default function SettingsPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [hasSettings, setHasSettings] = useState(false)

  const [settings, setSettings] = useState({
    position_sizing_type: 'lot' as 'lot' | 'percentage',
    position_size_value: '',
    max_open_positions: '10',
  })

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      router.push('/auth/login')
      return
    }

    const { data } = await supabase
      .from('trading_settings')
      .select('*')
      .eq('user_id', session.user.id)
      .single()

    if (data) {
      setHasSettings(true)
      setSettings({
        position_sizing_type: data.position_sizing_type,
        position_size_value: data.position_size_value.toString(),
        max_open_positions: data.max_open_positions.toString(),
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) throw new Error('Non authentifié')

      const data = {
        user_id: session.user.id,
        position_sizing_type: settings.position_sizing_type,
        position_size_value: parseFloat(settings.position_size_value),
        max_open_positions: parseInt(settings.max_open_positions),
      }

      if (hasSettings) {
        const { error } = await supabase
          .from('trading_settings')
          .update(data)
          .eq('user_id', session.user.id)

        if (error) throw error
      } else {
        const { error } = await supabase.from('trading_settings').insert(data)

        if (error) throw error
        setHasSettings(true)
      }

      setSuccess('Paramètres enregistrés avec succès')
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Paramètres de Trading</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Type de sizing</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="lot"
                    checked={settings.position_sizing_type === 'lot'}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        position_sizing_type: e.target.value as 'lot' | 'percentage',
                      })
                    }
                    className="mr-2"
                  />
                  <span>Par lot fixe</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="percentage"
                    checked={settings.position_sizing_type === 'percentage'}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        position_sizing_type: e.target.value as 'lot' | 'percentage',
                      })
                    }
                    className="mr-2"
                  />
                  <span>Par pourcentage du capital</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                {settings.position_sizing_type === 'lot'
                  ? 'Taille de position (lots)'
                  : 'Pourcentage du capital (%)'}
              </label>
              <input
                type="number"
                step="0.01"
                value={settings.position_size_value}
                onChange={(e) =>
                  setSettings({ ...settings, position_size_value: e.target.value })
                }
                className="input"
                required
                min="0.01"
                max={settings.position_sizing_type === 'percentage' ? '100' : undefined}
              />
              <p className="text-sm text-gray-500 mt-1">
                {settings.position_sizing_type === 'lot'
                  ? 'Exemple: 0.01 pour un micro lot'
                  : 'Exemple: 2 pour risquer 2% de votre capital par trade'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Nombre maximum de positions ouvertes
              </label>
              <input
                type="number"
                value={settings.max_open_positions}
                onChange={(e) =>
                  setSettings({ ...settings, max_open_positions: e.target.value })
                }
                className="input"
                required
                min="1"
                max="50"
              />
              <p className="text-sm text-gray-500 mt-1">
                Limite le nombre de trades simultanés pour gérer le risque
              </p>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? 'Enregistrement...' : 'Enregistrer les paramètres'}
            </button>
          </form>
        </div>

        <div className="card mt-8">
          <h2 className="text-xl font-bold mb-4">À propos du Copy Trading</h2>
          <div className="space-y-3 text-gray-700">
            <p>
              ✓ Les positions de l'admin sont automatiquement copiées sur vos comptes MT5 actifs
            </p>
            <p>
              ✓ Les paramètres de sizing s'appliquent à toutes les positions copiées
            </p>
            <p>
              ✓ Vous pouvez désactiver temporairement vos comptes MT5 sans les supprimer
            </p>
            <p>
              ✓ Si votre abonnement expire, toutes les positions ouvertes seront fermées
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

