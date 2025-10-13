'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

type Broker = {
  id: string
  name: string
  server_address: string
}

type MT5Account = {
  id: string
  account_number: number
  is_active: boolean
  brokers: Broker
}

export default function MT5AccountsPage() {
  const [mt5Accounts, setMt5Accounts] = useState<MT5Account[]>([])
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    broker_id: '',
    account_number: '',
    password: '',
    is_investor: false,
  })

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

    const { data: accountsData } = await supabase
      .from('mt5_accounts')
      .select('*, brokers(*)')
      .eq('user_id', session.user.id)

    const { data: brokersData } = await supabase
      .from('brokers')
      .select('*')
      .order('name')

    if (accountsData) setMt5Accounts(accountsData)
    if (brokersData) setBrokers(brokersData)
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
        broker_id: formData.broker_id,
        account_number: parseInt(formData.account_number),
        password_encrypted: passwordEncrypted,
        is_investor: formData.is_investor,
      })

      if (error) throw error

      setShowAddForm(false)
      setFormData({
        broker_id: '',
        account_number: '',
        password: '',
        is_investor: false,
      })
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
                <label className="block text-sm font-medium mb-2">Broker</label>
                <select
                  value={formData.broker_id}
                  onChange={(e) => setFormData({ ...formData, broker_id: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Sélectionner un broker</option>
                  {brokers.map((broker) => (
                    <option key={broker.id} value={broker.id}>
                      {broker.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Numéro de compte</label>
                <input
                  type="number"
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Mot de passe</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input"
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

              <button type="submit" disabled={loading} className="btn btn-primary w-full">
                {loading ? 'Ajout en cours...' : 'Ajouter'}
              </button>
            </form>
          </div>
        )}

        <div className="space-y-4">
          {mt5Accounts.map((account) => (
            <div key={account.id} className="card">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold">{account.brokers.name}</h3>
                  <p className="text-gray-600">Compte #{account.account_number}</p>
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

