'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

type Broker = {
  id: string
  name: string
  servers?: string[]
}

type AdminMT5Account = {
  id: string
  account_number: number
  is_active: boolean
  is_admin_account: boolean
  broker_name: string
  server_name: string
  metaapi_account_id: string | null
}

export default function AdminMT5AccountsPage() {
  const [adminAccounts, setAdminAccounts] = useState<AdminMT5Account[]>([])
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [servers, setServers] = useState<string[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingServers, setLoadingServers] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    broker_name: '',
    server_name: '',
    account_number: '',
    password: '',
  })

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    checkAdmin()
    fetchAdminAccounts()
    fetchBrokers()
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

  const fetchAdminAccounts = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) return

    const { data: accountsData } = await supabase
      .from('mt5_accounts')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('is_admin_account', true)

    if (accountsData) {
      setAdminAccounts(accountsData as AdminMT5Account[])
    }
  }

  const fetchBrokers = async () => {
    try {
      const response = await fetch('/api/metaapi/brokers')
      const data = await response.json()

      if (data.success && data.brokers) {
        setBrokers(data.brokers)
      }
    } catch (err) {
      console.error('Error fetching brokers:', err)
    }
  }

  const fetchServers = async (brokerName: string) => {
    setLoadingServers(true)
    try {
      const response = await fetch(
        `/api/metaapi/servers?broker=${encodeURIComponent(brokerName)}`
      )
      const data = await response.json()

      if (data.success && data.servers) {
        setServers(data.servers.map((s: any) => s.name))
      } else {
        const broker = brokers.find((b) => b.name === brokerName)
        setServers(broker?.servers || [])
      }
    } catch (err) {
      console.error('Error fetching servers:', err)
      const broker = brokers.find((b) => b.name === brokerName)
      setServers(broker?.servers || [])
    } finally {
      setLoadingServers(false)
    }
  }

  const handleBrokerChange = (brokerName: string) => {
    setFormData({ ...formData, broker_name: brokerName, server_name: '' })
    fetchServers(brokerName)
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

      // Connecter le compte à MetaApi
      const response = await fetch('/api/metaapi/connect-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Admin - ${formData.broker_name} - ${formData.account_number}`,
          login: formData.account_number,
          password: formData.password,
          server: formData.server_name,
          platform: 'mt5',
          magic: 0,
        }),
      })

      const metaApiData = await response.json()

      if (!metaApiData.success) {
        throw new Error(metaApiData.error || 'Erreur lors de la connexion MetaApi')
      }

      // Enregistrer dans Supabase
      const { error: dbError } = await supabase.from('mt5_accounts').insert({
        user_id: session.user.id,
        broker_name: formData.broker_name,
        server_name: formData.server_name,
        account_number: parseInt(formData.account_number),
        password_encrypted: btoa(formData.password), // Simple encoding, pas très sécurisé mais ok pour dev
        is_active: true,
        is_admin_account: true, // IMPORTANT: Marquer comme compte admin
        metaapi_account_id: metaApiData.accountId,
      })

      if (dbError) throw dbError

      setSuccess('✅ Compte admin ajouté avec succès!')
      setFormData({
        broker_name: '',
        server_name: '',
        account_number: '',
        password: '',
      })
      setShowAddForm(false)
      fetchAdminAccounts()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'ajout du compte')
    } finally {
      setLoading(false)
    }
  }

  const toggleAccountStatus = async (accountId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('mt5_accounts')
      .update({ is_active: !currentStatus })
      .eq('id', accountId)

    if (!error) {
      fetchAdminAccounts()
    }
  }

  const deleteAccount = async (accountId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce compte admin?')) return

    const { error } = await supabase.from('mt5_accounts').delete().eq('id', accountId)

    if (!error) {
      setSuccess('Compte supprimé')
      fetchAdminAccounts()
    } else {
      setError('Erreur lors de la suppression')
    }
  }

  return (
    <div className="min-h-screen pattern-bg">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-white mb-2">
            Comptes MT5 Admin 🎯
          </h1>
          <p className="text-white text-opacity-90 text-lg font-semibold">
            Gérez les comptes de trading principal pour le copy trading
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

        <div className="card-white mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black" style={{ color: '#9b30a8' }}>
              Mes Comptes Admin
            </h2>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="btn btn-primary text-sm"
            >
              {showAddForm ? '✕ Annuler' : '+ Ajouter un compte'}
            </button>
          </div>

          {showAddForm && (
            <form onSubmit={handleSubmit} className="space-y-4 mb-8 p-6 bg-primary-50 rounded-2xl border-2 border-primary-200">
              <div>
                <label className="block font-bold mb-2" style={{ color: '#9b30a8' }}>
                  Broker
                </label>
                <select
                  className="input"
                  value={formData.broker_name}
                  onChange={(e) => handleBrokerChange(e.target.value)}
                  required
                >
                  <option value="">Sélectionnez un broker</option>
                  {brokers.map((broker) => (
                    <option key={broker.id} value={broker.name}>
                      {broker.name}
                    </option>
                  ))}
                </select>
              </div>

              {formData.broker_name && (
                <div>
                  <label className="block font-bold mb-2" style={{ color: '#9b30a8' }}>
                    Serveur {loadingServers && '(chargement...)'}
                  </label>
                  <select
                    className="input"
                    value={formData.server_name}
                    onChange={(e) =>
                      setFormData({ ...formData, server_name: e.target.value })
                    }
                    required
                    disabled={loadingServers}
                  >
                    <option value="">Sélectionnez un serveur</option>
                    {servers.map((server) => (
                      <option key={server} value={server}>
                        {server}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold mb-2" style={{ color: '#9b30a8' }}>
                  Numéro de compte MT5
                </label>
                <input
                  type="number"
                  className="input"
                  value={formData.account_number}
                  onChange={(e) =>
                    setFormData({ ...formData, account_number: e.target.value })
                  }
                  placeholder="123456789"
                  required
                />
              </div>

              <div>
                <label className="block font-bold mb-2" style={{ color: '#9b30a8' }}>
                  Mot de passe MT5
                </label>
                <input
                  type="password"
                  className="input"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="bg-yellow-50 border-2 border-yellow-400 p-4 rounded-xl">
                <p className="text-sm font-bold text-yellow-800">
                  ⚠️ <strong>Compte Admin</strong>: Les trades de ce compte seront copiés
                  sur tous les comptes utilisateurs actifs avec un abonnement valide.
                </p>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={loading}
              >
                {loading ? 'Connexion en cours...' : '✓ Ajouter le compte admin'}
              </button>
            </form>
          )}

          {adminAccounts.length > 0 ? (
            <div className="space-y-4">
              {adminAccounts.map((account) => (
                <div
                  key={account.id}
                  className="border-2 border-primary-200 rounded-2xl p-6 bg-gradient-to-r from-primary-50 to-white hover:shadow-lg transition-all"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-black" style={{ color: '#9b30a8' }}>
                          {account.broker_name}
                        </h3>
                        <span
                          className={`px-4 py-1 rounded-full text-sm font-bold ${
                            account.is_active
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-400 text-white'
                          }`}
                        >
                          {account.is_active ? '✓ Actif' : '✗ Inactif'}
                        </span>
                        <span className="px-4 py-1 rounded-full text-sm font-bold bg-purple-600 text-white">
                          🎯 ADMIN
                        </span>
                      </div>
                      <p className="font-semibold opacity-75" style={{ color: '#9b30a8' }}>
                        Serveur: {account.server_name}
                      </p>
                      <p className="font-semibold opacity-75" style={{ color: '#9b30a8' }}>
                        Compte: #{account.account_number}
                      </p>
                      {account.metaapi_account_id && (
                        <p className="text-sm opacity-60 mt-2" style={{ color: '#9b30a8' }}>
                          MetaApi ID: {account.metaapi_account_id}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleAccountStatus(account.id, account.is_active)}
                        className="px-4 py-2 rounded-xl font-bold bg-blue-500 text-white hover:bg-blue-600 transition-all"
                      >
                        {account.is_active ? 'Désactiver' : 'Activer'}
                      </button>
                      <button
                        onClick={() => deleteAccount(account.id)}
                        className="px-4 py-2 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition-all"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-xl font-bold mb-4" style={{ color: '#9b30a8' }}>
                Aucun compte admin connecté
              </p>
              <p className="opacity-75 mb-6" style={{ color: '#9b30a8' }}>
                Ajoutez un compte MT5 pour commencer le copy trading
              </p>
            </div>
          )}
        </div>

        <div className="card-white">
          <h2 className="text-2xl font-black mb-4" style={{ color: '#9b30a8' }}>
            📘 Comment ça marche?
          </h2>
          <div className="space-y-3 opacity-90" style={{ color: '#9b30a8' }}>
            <p className="font-semibold">
              <strong>1.</strong> Connectez votre compte MT5 principal (le compte qui trade)
            </p>
            <p className="font-semibold">
              <strong>2.</strong> Dès qu'une position est ouverte sur ce compte, elle sera
              automatiquement copiée sur tous les comptes utilisateurs
            </p>
            <p className="font-semibold">
              <strong>3.</strong> Les lots sont adaptés selon les settings de chaque utilisateur
              (GOLD, SOL30, BTC)
            </p>
            <p className="font-semibold">
              <strong>4.</strong> Les symboles sont automatiquement mappés selon le broker de
              l'utilisateur (XAUUSD → GOLD, etc.)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

