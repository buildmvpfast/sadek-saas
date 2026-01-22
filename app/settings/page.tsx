'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

type TradingSettings = {
  id?: string
  position_sizing_type: 'lot' | 'percentage'
  gold_lot_size: number
  sol_lot_size: number
  btc_lot_size: number
  us30_lot_size: number
  position_percentage: number
  max_open_positions: number
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<TradingSettings>({
    position_sizing_type: 'lot',
    gold_lot_size: 0.01,
    sol_lot_size: 0.01,
    btc_lot_size: 0.01,
    us30_lot_size: 0.01,
    position_percentage: 1.0,
    max_open_positions: 10,
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

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
      setSettings({
        id: data.id,
        position_sizing_type: data.position_sizing_type,
        gold_lot_size: parseFloat(data.gold_lot_size) || 0.01,
        sol_lot_size: parseFloat(data.sol_lot_size) || 0.01,
        btc_lot_size: parseFloat(data.btc_lot_size) || 0.01,
        us30_lot_size: parseFloat(data.us30_lot_size) || 0.01,
        position_percentage: parseFloat(data.position_percentage) || 1.0,
        max_open_positions: data.max_open_positions || 10,
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push('/auth/login')
        return
      }

      const dataToSave = {
        user_id: session.user.id,
        position_sizing_type: settings.position_sizing_type,
        gold_lot_size: settings.gold_lot_size,
        sol_lot_size: settings.sol_lot_size,
        btc_lot_size: settings.btc_lot_size,
        us30_lot_size: settings.us30_lot_size,
        position_percentage: settings.position_percentage,
        max_open_positions: settings.max_open_positions,
      }

      if (settings.id) {
        // Update existing
        const { error: updateError } = await supabase
          .from('trading_settings')
          .update(dataToSave)
          .eq('id', settings.id)

        if (updateError) throw updateError
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('trading_settings')
          .insert(dataToSave)

        if (insertError) throw insertError
      }

      setSuccess('✅ Paramètres enregistrés avec succès!')
      fetchSettings()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen pattern-bg">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-white mb-2">
            Paramètres de Trading ⚙️
          </h1>
          <p className="text-white text-opacity-90 text-lg font-semibold">
            Configurez vos lots pour chaque instrument
          </p>
        </div>

        {error && (
          <div className="bg-red-100 border-2 border-red-400 text-red-700 px-6 py-4 rounded-2xl mb-6 font-bold">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 border-2 border-green-400 text-green-700 px-6 py-4 rounded-2xl mb-6 font-bold">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="card-white">
            <h2 className="text-2xl font-black mb-6" style={{ color: '#9b30a8' }}>
              Type de Position
            </h2>

            <div className="space-y-4">
              <label className="flex items-center space-x-3 cursor-pointer p-4 border-2 rounded-2xl transition-all hover:shadow-md"
                style={{
                  borderColor: settings.position_sizing_type === 'lot' ? '#9b30a8' : '#e5d0e8',
                  backgroundColor: settings.position_sizing_type === 'lot' ? '#f5e8f7' : 'white'
                }}
              >
                <input
                  type="radio"
                  name="position_sizing_type"
                  value="lot"
                  checked={settings.position_sizing_type === 'lot'}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      position_sizing_type: e.target.value as 'lot',
                    })
                  }
                  className="w-5 h-5"
                />
                <div className="flex-1">
                  <p className="font-black text-lg" style={{ color: '#9b30a8' }}>
                    📊 Lots Fixes
                  </p>
                  <p className="text-sm opacity-75" style={{ color: '#9b30a8' }}>
                    Choisissez un nombre de lots spécifique pour chaque instrument
                  </p>
                </div>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer p-4 border-2 rounded-2xl transition-all hover:shadow-md"
                style={{
                  borderColor: settings.position_sizing_type === 'percentage' ? '#9b30a8' : '#e5d0e8',
                  backgroundColor: settings.position_sizing_type === 'percentage' ? '#f5e8f7' : 'white'
                }}
              >
                <input
                  type="radio"
                  name="position_sizing_type"
                  value="percentage"
                  checked={settings.position_sizing_type === 'percentage'}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      position_sizing_type: e.target.value as 'percentage',
                    })
                  }
                  className="w-5 h-5"
                />
                <div className="flex-1">
                  <p className="font-black text-lg" style={{ color: '#9b30a8' }}>
                    📈 Pourcentage du Capital
                  </p>
                  <p className="text-sm opacity-75" style={{ color: '#9b30a8' }}>
                    Utilisez un % de votre capital par position (recommandé)
                  </p>
                </div>
              </label>
            </div>
          </div>

          {settings.position_sizing_type === 'lot' && (
            <div className="card-white">
              <h2 className="text-2xl font-black mb-6" style={{ color: '#9b30a8' }}>
                Configuration des Lots par Instrument
              </h2>

              <div className="space-y-6">
                <div>
                  <label className="block font-bold mb-2" style={{ color: '#9b30a8' }}>
                    🪙 GOLD (XAU/USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="100"
                    className="input"
                    value={settings.gold_lot_size}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        gold_lot_size: parseFloat(e.target.value) || 0.01,
                      })
                    }
                    required
                  />
                  <p className="text-sm mt-2 opacity-75" style={{ color: '#9b30a8' }}>
                    Nombre de lots pour les trades sur l'or (ex: 0.01, 0.1, 1.0)
                  </p>
                </div>

                <div>
                  <label className="block font-bold mb-2" style={{ color: '#9b30a8' }}>
                    ⚡ SOL30 (Solana)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="100"
                    className="input"
                    value={settings.sol_lot_size}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        sol_lot_size: parseFloat(e.target.value) || 0.01,
                      })
                    }
                    required
                  />
                  <p className="text-sm mt-2 opacity-75" style={{ color: '#9b30a8' }}>
                    Nombre de lots pour les trades sur Solana
                  </p>
                </div>

                <div>
                  <label className="block font-bold mb-2" style={{ color: '#9b30a8' }}>
                    ₿ BTC (Bitcoin)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="100"
                    className="input"
                    value={settings.btc_lot_size}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        btc_lot_size: parseFloat(e.target.value) || 0.01,
                      })
                    }
                    required
                  />
                  <p className="text-sm mt-2 opacity-75" style={{ color: '#9b30a8' }}>
                    Nombre de lots pour les trades sur Bitcoin
                  </p>
                </div>

                <div>
                  <label className="block font-bold mb-2" style={{ color: '#9b30a8' }}>
                    📉 US30 (Dow Jones)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="100"
                    className="input"
                    value={settings.us30_lot_size}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        us30_lot_size: parseFloat(e.target.value) || 0.01,
                      })
                    }
                    required
                  />
                  <p className="text-sm mt-2 opacity-75" style={{ color: '#9b30a8' }}>
                    Nombre de lots pour les trades sur l'US30
                  </p>
                </div>
              </div>
            </div>
          )}

          {settings.position_sizing_type === 'percentage' && (
            <div className="card-white">
              <h2 className="text-2xl font-black mb-6" style={{ color: '#9b30a8' }}>
                Pourcentage du Capital
              </h2>

              <div>
                <label className="block font-bold mb-2" style={{ color: '#9b30a8' }}>
                  Pourcentage par position (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="100"
                  className="input"
                  value={settings.position_percentage}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      position_percentage: parseFloat(e.target.value) || 1.0,
                    })
                  }
                  required
                />
                <p className="text-sm mt-2 opacity-75" style={{ color: '#9b30a8' }}>
                  Pourcentage de votre capital à risquer par trade (ex: 1% = 0.01 lot pour $1000)
                </p>
              </div>

              <div className="bg-blue-50 border-2 border-blue-400 p-4 rounded-xl mt-4">
                <p className="text-sm font-bold" style={{ color: '#9b30a8' }}>
                  💡 <strong>Info:</strong> Le système calculera automatiquement le nombre de
                  lots en fonction de votre capital disponible et du pourcentage choisi.
                </p>
              </div>
            </div>
          )}

          <div className="card-white">
            <h2 className="text-2xl font-black mb-6" style={{ color: '#9b30a8' }}>
              Autres Paramètres
            </h2>

            <div>
              <label className="block font-bold mb-2" style={{ color: '#9b30a8' }}>
                Nombre maximum de positions ouvertes
              </label>
              <input
                type="number"
                min="1"
                max="100"
                className="input"
                value={settings.max_open_positions}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    max_open_positions: parseInt(e.target.value) || 10,
                  })
                }
                required
              />
              <p className="text-sm mt-2 opacity-75" style={{ color: '#9b30a8' }}>
                Limite de positions simultanées pour gérer le risque
              </p>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading ? 'Enregistrement...' : '✓ Enregistrer les paramètres'}
          </button>
        </form>

        <div className="card-white mt-8">
          <h2 className="text-2xl font-black mb-4" style={{ color: '#9b30a8' }}>
            📘 Guide des Paramètres
          </h2>
          <div className="space-y-3 opacity-90" style={{ color: '#9b30a8' }}>
            <p className="font-semibold">
              <strong>Lots Fixes:</strong> Vous choisissez exactement combien de lots trader pour
              chaque instrument (GOLD, SOL, BTC). Simple et prévisible.
            </p>
            <p className="font-semibold">
              <strong>Pourcentage:</strong> Le système calcule automatiquement la taille de
              position selon votre capital. Plus flexible et adapté à la croissance.
            </p>
            <p className="font-semibold">
              <strong>Mapping Automatique:</strong> Les symboles sont automatiquement adaptés à
              votre broker (XAUUSD, GOLD, XAU/USD, etc.)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
