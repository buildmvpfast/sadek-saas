'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

type TradingSettings = {
  id?: string
  position_sizing_type: 'lot' | 'percentage'
  // Métaux
  gold_lot_size: number
  // Crypto
  btc_lot_size: number
  eth_lot_size: number
  sol_lot_size: number
  // Indices
  us30_lot_size: number
  nas100_lot_size: number
  ger40_lot_size: number
  uk100_lot_size: number
  spx500_lot_size: number
  // Forex majeurs
  eurusd_lot_size: number
  gbpusd_lot_size: number
  usdjpy_lot_size: number
  usdchf_lot_size: number
  usdcad_lot_size: number
  audusd_lot_size: number
  nzdusd_lot_size: number
  // Forex croisés
  eurgbp_lot_size: number
  eurjpy_lot_size: number
  gbpjpy_lot_size: number
  // Global
  position_percentage: number
  max_open_positions: number
}

const DEFAULT_SETTINGS: TradingSettings = {
  position_sizing_type: 'lot',
  gold_lot_size: 0.01,
  btc_lot_size: 0.01,
  eth_lot_size: 0.01,
  sol_lot_size: 0.01,
  us30_lot_size: 0.01,
  nas100_lot_size: 0.01,
  ger40_lot_size: 0.01,
  uk100_lot_size: 0.01,
  spx500_lot_size: 0.01,
  eurusd_lot_size: 0.01,
  gbpusd_lot_size: 0.01,
  usdjpy_lot_size: 0.01,
  usdchf_lot_size: 0.01,
  usdcad_lot_size: 0.01,
  audusd_lot_size: 0.01,
  nzdusd_lot_size: 0.01,
  eurgbp_lot_size: 0.01,
  eurjpy_lot_size: 0.01,
  gbpjpy_lot_size: 0.01,
  position_percentage: 1.0,
  max_open_positions: 10,
}

type LotInputProps = {
  label: string
  emoji: string
  field: keyof TradingSettings
  settings: TradingSettings
  onChange: (field: keyof TradingSettings, value: number) => void
}

function LotInput({ label, emoji, field, settings, onChange }: LotInputProps) {
  return (
    <div>
      <label className="block font-bold mb-2" style={{ color: '#9b30a8' }}>
        {emoji} {label}
      </label>
      <input
        type="number"
        step="0.01"
        min="0.01"
        max="100"
        className="input"
        value={settings[field] as number}
        onChange={(e) => onChange(field, parseFloat(e.target.value) || 0.01)}
        required
      />
    </div>
  )
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<TradingSettings>(DEFAULT_SETTINGS)
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
        btc_lot_size: parseFloat(data.btc_lot_size) || 0.01,
        eth_lot_size: parseFloat(data.eth_lot_size) || 0.01,
        sol_lot_size: parseFloat(data.sol_lot_size) || 0.01,
        us30_lot_size: parseFloat(data.us30_lot_size) || 0.01,
        nas100_lot_size: parseFloat(data.nas100_lot_size) || 0.01,
        ger40_lot_size: parseFloat(data.ger40_lot_size) || 0.01,
        uk100_lot_size: parseFloat(data.uk100_lot_size) || 0.01,
        spx500_lot_size: parseFloat(data.spx500_lot_size) || 0.01,
        eurusd_lot_size: parseFloat(data.eurusd_lot_size) || 0.01,
        gbpusd_lot_size: parseFloat(data.gbpusd_lot_size) || 0.01,
        usdjpy_lot_size: parseFloat(data.usdjpy_lot_size) || 0.01,
        usdchf_lot_size: parseFloat(data.usdchf_lot_size) || 0.01,
        usdcad_lot_size: parseFloat(data.usdcad_lot_size) || 0.01,
        audusd_lot_size: parseFloat(data.audusd_lot_size) || 0.01,
        nzdusd_lot_size: parseFloat(data.nzdusd_lot_size) || 0.01,
        eurgbp_lot_size: parseFloat(data.eurgbp_lot_size) || 0.01,
        eurjpy_lot_size: parseFloat(data.eurjpy_lot_size) || 0.01,
        gbpjpy_lot_size: parseFloat(data.gbpjpy_lot_size) || 0.01,
        position_percentage: parseFloat(data.position_percentage) || 1.0,
        max_open_positions: data.max_open_positions || 10,
      })
    }
  }

  const handleChange = (field: keyof TradingSettings, value: number) => {
    setSettings((prev) => ({ ...prev, [field]: value }))
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
        btc_lot_size: settings.btc_lot_size,
        eth_lot_size: settings.eth_lot_size,
        sol_lot_size: settings.sol_lot_size,
        us30_lot_size: settings.us30_lot_size,
        nas100_lot_size: settings.nas100_lot_size,
        ger40_lot_size: settings.ger40_lot_size,
        uk100_lot_size: settings.uk100_lot_size,
        spx500_lot_size: settings.spx500_lot_size,
        eurusd_lot_size: settings.eurusd_lot_size,
        gbpusd_lot_size: settings.gbpusd_lot_size,
        usdjpy_lot_size: settings.usdjpy_lot_size,
        usdchf_lot_size: settings.usdchf_lot_size,
        usdcad_lot_size: settings.usdcad_lot_size,
        audusd_lot_size: settings.audusd_lot_size,
        nzdusd_lot_size: settings.nzdusd_lot_size,
        eurgbp_lot_size: settings.eurgbp_lot_size,
        eurjpy_lot_size: settings.eurjpy_lot_size,
        gbpjpy_lot_size: settings.gbpjpy_lot_size,
        position_percentage: settings.position_percentage,
        max_open_positions: settings.max_open_positions,
      }

      if (settings.id) {
        const { error: updateError } = await supabase
          .from('trading_settings')
          .update(dataToSave)
          .eq('id', settings.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('trading_settings')
          .insert(dataToSave)

        if (insertError) throw insertError
      }

      setSuccess('✅ Paramètres enregistrés avec succès!')
      fetchSettings()
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'enregistrement")
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
          {/* Type de position */}
          <div className="card-white">
            <h2 className="text-2xl font-black mb-6" style={{ color: '#9b30a8' }}>
              Type de Position
            </h2>

            <div className="space-y-4">
              {(['lot', 'percentage'] as const).map((type) => (
                <label
                  key={type}
                  className="flex items-center space-x-3 cursor-pointer p-4 border-2 rounded-2xl transition-all hover:shadow-md"
                  style={{
                    borderColor: settings.position_sizing_type === type ? '#9b30a8' : '#e5d0e8',
                    backgroundColor:
                      settings.position_sizing_type === type ? '#f5e8f7' : 'white',
                  }}
                >
                  <input
                    type="radio"
                    name="position_sizing_type"
                    value={type}
                    checked={settings.position_sizing_type === type}
                    onChange={() =>
                      setSettings({ ...settings, position_sizing_type: type })
                    }
                    className="w-5 h-5"
                  />
                  <div className="flex-1">
                    {type === 'lot' ? (
                      <>
                        <p className="font-black text-lg" style={{ color: '#9b30a8' }}>
                          📊 Lots Fixes
                        </p>
                        <p className="text-sm opacity-75" style={{ color: '#9b30a8' }}>
                          Choisissez un nombre de lots spécifique pour chaque instrument
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-black text-lg" style={{ color: '#9b30a8' }}>
                          📈 Pourcentage du Capital
                        </p>
                        <p className="text-sm opacity-75" style={{ color: '#9b30a8' }}>
                          Utilisez un % de votre capital par position (recommandé)
                        </p>
                      </>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Lots fixes par instrument */}
          {settings.position_sizing_type === 'lot' && (
            <>
              {/* Métaux */}
              <div className="card-white">
                <h2 className="text-2xl font-black mb-6" style={{ color: '#9b30a8' }}>
                  🥇 Métaux
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <LotInput label="GOLD (XAU/USD)" emoji="🪙" field="gold_lot_size" settings={settings} onChange={handleChange} />
                </div>
              </div>

              {/* Crypto */}
              <div className="card-white">
                <h2 className="text-2xl font-black mb-6" style={{ color: '#9b30a8' }}>
                  🔗 Crypto
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <LotInput label="BTC (Bitcoin)" emoji="₿" field="btc_lot_size" settings={settings} onChange={handleChange} />
                  <LotInput label="ETH (Ethereum)" emoji="🔷" field="eth_lot_size" settings={settings} onChange={handleChange} />
                  <LotInput label="SOL30 (Solana)" emoji="⚡" field="sol_lot_size" settings={settings} onChange={handleChange} />
                </div>
              </div>

              {/* Indices */}
              <div className="card-white">
                <h2 className="text-2xl font-black mb-6" style={{ color: '#9b30a8' }}>
                  📉 Indices
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <LotInput label="US30 (Dow Jones)" emoji="🇺🇸" field="us30_lot_size" settings={settings} onChange={handleChange} />
                  <LotInput label="NAS100 (Nasdaq)" emoji="💻" field="nas100_lot_size" settings={settings} onChange={handleChange} />
                  <LotInput label="SPX500 (S&P 500)" emoji="📊" field="spx500_lot_size" settings={settings} onChange={handleChange} />
                  <LotInput label="GER40 (DAX)" emoji="🇩🇪" field="ger40_lot_size" settings={settings} onChange={handleChange} />
                  <LotInput label="UK100 (FTSE 100)" emoji="🇬🇧" field="uk100_lot_size" settings={settings} onChange={handleChange} />
                </div>
              </div>

              {/* Forex Majeurs */}
              <div className="card-white">
                <h2 className="text-2xl font-black mb-6" style={{ color: '#9b30a8' }}>
                  💱 Forex — Paires Majeures
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <LotInput label="EUR/USD" emoji="🇪🇺" field="eurusd_lot_size" settings={settings} onChange={handleChange} />
                  <LotInput label="GBP/USD" emoji="🇬🇧" field="gbpusd_lot_size" settings={settings} onChange={handleChange} />
                  <LotInput label="USD/JPY" emoji="🇯🇵" field="usdjpy_lot_size" settings={settings} onChange={handleChange} />
                  <LotInput label="USD/CHF" emoji="🇨🇭" field="usdchf_lot_size" settings={settings} onChange={handleChange} />
                  <LotInput label="USD/CAD" emoji="🇨🇦" field="usdcad_lot_size" settings={settings} onChange={handleChange} />
                  <LotInput label="AUD/USD" emoji="🇦🇺" field="audusd_lot_size" settings={settings} onChange={handleChange} />
                  <LotInput label="NZD/USD" emoji="🇳🇿" field="nzdusd_lot_size" settings={settings} onChange={handleChange} />
                </div>
              </div>

              {/* Forex Croisés */}
              <div className="card-white">
                <h2 className="text-2xl font-black mb-6" style={{ color: '#9b30a8' }}>
                  🔀 Forex — Paires Croisées
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <LotInput label="EUR/GBP" emoji="🇪🇺" field="eurgbp_lot_size" settings={settings} onChange={handleChange} />
                  <LotInput label="EUR/JPY" emoji="🇯🇵" field="eurjpy_lot_size" settings={settings} onChange={handleChange} />
                  <LotInput label="GBP/JPY" emoji="🇬🇧" field="gbpjpy_lot_size" settings={settings} onChange={handleChange} />
                </div>
              </div>
            </>
          )}

          {/* Pourcentage */}
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
                  💡 <strong>Info:</strong> Le système calculera automatiquement le nombre de lots
                  en fonction de votre capital disponible et du pourcentage choisi.
                </p>
              </div>
            </div>
          )}

          {/* Autres */}
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
              chaque instrument. Simple et prévisible.
            </p>
            <p className="font-semibold">
              <strong>Pourcentage:</strong> Le système calcule automatiquement la taille de position
              selon votre capital. Plus flexible et adapté à la croissance.
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
