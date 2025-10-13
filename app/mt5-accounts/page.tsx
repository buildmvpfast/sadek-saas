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

type MT5Account = {
  id: string
  account_number: number
  is_active: boolean
  broker_name: string
  server_name: string
}

export default function MT5AccountsPage() {
  const [mt5Accounts, setMt5Accounts] = useState<MT5Account[]>([])
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [servers, setServers] = useState<string[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingServers, setLoadingServers] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    broker_name: '',
    server_name: '',
    account_number: '',
    password: '',
    is_investor: false,
  })

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchData()
    fetchBrokers()
  }, [])

  const fetchData = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      router.push('/auth/login')
      return
    }

    const { data: accountsData } = await supabase
      .from('mt5_accounts')
      .select('*')
      .eq('user_id', session.user.id)

    if (accountsData) {
      const formattedAccounts = accountsData.map((acc: any) => ({
        id: acc.id,
        account_number: acc.account_number,
        is_active: acc.is_active,
        broker_name: acc.broker_name || 'N/A',
        server_name: acc.server_name || 'N/A',
      }))
      setMt5Accounts(formattedAccounts)
    }
  }

  const fetchBrokers = async () => {
    try {
      const response = await fetch('/api/metaapi/brokers')
      const data = await response.json()
      
      if (data.success && data.brokers) {
        setBrokers(data.brokers)
      } else {
        // Fallback si l'API ne marche pas
        setBrokers(data.brokers || [])
      }
    } catch (err) {
      console.error('Error fetching brokers:', err)
      setError('Impossible de charger les brokers')
    }
  }

  const fetchServers = async (brokerName: string) => {
    setLoadingServers(true)
    try {
      const response = await fetch(`/api/metaapi/servers?broker=${encodeURIComponent(brokerName)}`)
      const data = await response.json()
      
      if (data.success && data.servers) {
        setServers(data.servers.map((s: any) => s.name))
      } else {
        // Fallback: utiliser les serveurs du broker sélectionné
        const broker = brokers.find(b => b.name === brokerName)
        setServers(broker?.servers || [])
      }
    } catch (err) {
      console.error('Error fetching servers:', err)
      const broker = brokers.find(b => b.name === brokerName)
      setServers(broker?.servers || [])
    } finally {
      setLoadingServers(false)
    }
  }

  const handleBrokerChange = (brokerName: string) => {
    setFormData({ 
      ...formData, 
      broker_name: brokerName,
      server_name: '' 
    })
    if (brokerName) {
      fetchServers(brokerName)
    } else {
      setServers([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) throw new Error('Non authentifié')

      // Encrypt password (in production, use proper encryption)
      const passwordEncrypted = Buffer.from(formData.password).toString('base64')

      const { error } = await supabase.from('mt5_accounts').insert({
        user_id: session.user.id,
        broker_name: formData.broker_name,
        server_name: formData.server_name,
        account_number: parseInt(formData.account_number),
        password_encrypted: passwordEncrypted,
        is_investor: formData.is_investor,
      })

      if (error) throw error

      setShowAddForm(false)
      setFormData({
        broker_name: '',
        server_name: '',
        account_number: '',
        password: '',
        is_investor: false,
      })
      setServers([])
      fetchData()
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  const toggleAccountStatus = async (accountId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('mt5_accounts')
      .update({ is_active: !currentStatus })
      .eq('id', accountId)

    if (!error) fetchData()
  }

  const deleteAccount = async (accountId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce compte?')) return

    const { error } = await supabase
      .from('mt5_accounts')
      .delete()
      .eq('id', accountId)

    if (!error) fetchData()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Comptes MT5</h1>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn btn-primary"
          >
            {showAddForm ? 'Annuler' : 'Ajouter un compte'}
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {showAddForm && (
          <div className="card mb-8">
            <h2 className="text-xl font-bold mb-4">Nouveau Compte MT5</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Broker *</label>
                <select
                  value={formData.broker_name}
                  onChange={(e) => handleBrokerChange(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Sélectionner un broker</option>
                  {brokers.map((broker) => (
                    <option key={broker.id} value={broker.name}>
                      {broker.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {brokers.length > 0 
                    ? `${brokers.length} brokers disponibles` 
                    : 'Chargement des brokers...'}
                </p>
              </div>

              {formData.broker_name && (
                <div>
                  <label className="block text-sm font-medium mb-2">Serveur MT5 *</label>
                  {loadingServers ? (
                    <div className="input bg-gray-50">Chargement des serveurs...</div>
                  ) : servers.length > 0 ? (
                    <>
                      <select
                        value={formData.server_name}
                        onChange={(e) => setFormData({ ...formData, server_name: e.target.value })}
                        className="input"
                        required
                      >
                        <option value="">Sélectionner un serveur</option>
                        {servers.map((server) => (
                          <option key={server} value={server}>
                            {server}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        {servers.length} serveurs disponibles
                      </p>
                    </>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={formData.server_name}
                        onChange={(e) => setFormData({ ...formData, server_name: e.target.value })}
                        className="input"
                        placeholder="Ex: MonBroker-Live"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Entrez le nom exact du serveur (visible dans MT5)
                      </p>
                    </>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Numéro de compte MT5 *</label>
                <input
                  type="number"
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  className="input"
                  placeholder="12345678"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Mot de passe MT5 *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input"
                  placeholder="Votre mot de passe MT5"
                  required
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_investor}
                  onChange={(e) => setFormData({ ...formData, is_investor: e.target.checked })}
                  className="mr-2"
                />
                <label className="text-sm">Mot de passe investisseur (lecture seule)</label>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  💡 Les serveurs sont chargés automatiquement depuis MetaApi
                </p>
              </div>

              <button type="submit" disabled={loading || !formData.server_name} className="btn btn-primary w-full">
                {loading ? 'Ajout en cours...' : 'Ajouter le compte'}
              </button>
            </form>
          </div>
        )}

        <div className="space-y-4">
            {mt5Accounts.map((account) => (
              <div key={account.id} className="card">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold">{account.broker_name}</h3>
                    <p className="text-gray-600">Compte #{account.account_number}</p>
                    <p className="text-sm text-gray-500">{account.server_name}</p>
                  </div>
                
                <div className="flex items-center space-x-4">
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    account.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {account.is_active ? 'Actif' : 'Inactif'}
                  </span>
                  
                  <button
                    onClick={() => toggleAccountStatus(account.id, account.is_active)}
                    className="btn btn-secondary"
                  >
                    {account.is_active ? 'Désactiver' : 'Activer'}
                  </button>
                  
                  <button
                    onClick={() => deleteAccount(account.id)}
                    className="btn bg-red-500 text-white hover:bg-red-600"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          ))}

          {mt5Accounts.length === 0 && !showAddForm && (
            <div className="card text-center py-12">
              <p className="text-gray-500 mb-4">Aucun compte MT5 configuré</p>
              <button onClick={() => setShowAddForm(true)} className="btn btn-primary">
                Ajouter votre premier compte
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

