'use client'

import { useState } from 'react'

type Props = {
  brokers: any[]
  onSubmit: (data: any) => Promise<void>
  onCancel: () => void
  loading: boolean
}

export default function AddBrokerForm({ brokers, onSubmit, onCancel, loading }: Props) {
  const [formData, setFormData] = useState({
    broker_id: '',
    server: '',
    account_number: '',
    password: '',
    is_investor: false,
  })

  const [showCustomServer, setShowCustomServer] = useState(false)
  const selectedBroker = brokers.find((b) => b.id === formData.broker_id)

  const handleBrokerChange = (brokerId: string) => {
    const broker = brokers.find((b) => b.id === brokerId)
    setFormData({
      ...formData,
      broker_id: brokerId,
      server: broker?.server_address || '',
    })
    setShowCustomServer(broker?.server_address === 'CUSTOM')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(formData)
  }

  return (
    <div className="card mb-8">
      <h2 className="text-xl font-bold mb-4">Nouveau Compte MT5</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Broker *</label>
          <select
            value={formData.broker_id}
            onChange={(e) => handleBrokerChange(e.target.value)}
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
          <p className="text-xs text-gray-500 mt-1">
            Le broker avec lequel vous tradez
          </p>
        </div>

        {selectedBroker && (
          <div>
            <label className="block text-sm font-medium mb-2">
              Serveur MT5 *
            </label>
            {showCustomServer ? (
              <input
                type="text"
                value={formData.server}
                onChange={(e) => setFormData({ ...formData, server: e.target.value })}
                className="input"
                placeholder="Ex: MonBroker-Live"
                required
              />
            ) : (
              <input
                type="text"
                value={formData.server}
                onChange={(e) => setFormData({ ...formData, server: e.target.value })}
                className="input"
                required
              />
            )}
            <p className="text-xs text-gray-500 mt-1">
              Le nom exact du serveur (visible dans MT5)
              {showCustomServer && ' - Entrez le nom exact de votre serveur'}
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-2">
            Numéro de compte MT5 *
          </label>
          <input
            type="number"
            value={formData.account_number}
            onChange={(e) =>
              setFormData({ ...formData, account_number: e.target.value })
            }
            className="input"
            placeholder="12345678"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Votre login MT5 (numérique)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Mot de passe MT5 *
          </label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="input"
            placeholder="Votre mot de passe MT5"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Le mot de passe de votre compte MT5 (stocké de manière sécurisée)
          </p>
        </div>

        <div className="flex items-start space-x-2">
          <input
            type="checkbox"
            checked={formData.is_investor}
            onChange={(e) =>
              setFormData({ ...formData, is_investor: e.target.checked })
            }
            className="mt-1"
          />
          <div>
            <label className="text-sm font-medium">Mot de passe investisseur</label>
            <p className="text-xs text-gray-500">
              Cochez si vous utilisez un mot de passe lecture seule (read-only)
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>💡 Astuce:</strong> Utilisez un compte démo pour tester d'abord!
          </p>
        </div>

        <div className="flex space-x-4">
          <button type="submit" disabled={loading} className="btn btn-primary flex-1">
            {loading ? 'Ajout en cours...' : 'Ajouter le compte'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary flex-1"
          >
            Annuler
          </button>
        </div>
      </form>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2 text-sm">Comment trouver ces infos?</h3>
        <ul className="text-xs text-gray-700 space-y-1">
          <li>
            <strong>Serveur:</strong> Ouvrez MT5 → Fichier → Se connecter → Le nom
            du serveur s'affiche
          </li>
          <li>
            <strong>Numéro de compte:</strong> Visible dans votre email de bienvenue
            du broker
          </li>
          <li>
            <strong>Mot de passe:</strong> Celui que vous utilisez pour vous
            connecter à MT5
          </li>
        </ul>
      </div>
    </div>
  )
}

