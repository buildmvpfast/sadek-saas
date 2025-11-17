'use client'

import { useEffect, useState, useCallback } from 'react'

type AccountInfo = {
  balance: number
  equity: number
  margin: number
  freeMargin: number
  marginLevel: number
  currency: string
  profit: number
  server: string
  leverage: number
}

type AccountBalanceProps = {
  metaapiAccountId: string
}

export default function AccountBalance({ metaapiAccountId }: AccountBalanceProps) {
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAccountInfo = useCallback(async () => {
    try {
      const response = await fetch(`/api/metaapi/account-info?accountId=${metaapiAccountId}`)
      const data = await response.json()
      
      if (data.success && data.accountInfo) {
        setAccountInfo(data.accountInfo)
      } else {
        console.error('Failed to fetch account info:', data.error)
        setAccountInfo(null)
      }
    } catch (err) {
      console.error('Error fetching account info:', err)
      setAccountInfo(null)
    } finally {
      setLoading(false)
    }
  }, [metaapiAccountId])

  useEffect(() => {
    fetchAccountInfo()
    
    // Polling toutes les 5 secondes
    const interval = setInterval(fetchAccountInfo, 5000)
    
    return () => clearInterval(interval)
  }, [fetchAccountInfo])

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
        <span className="text-sm" style={{ color: '#9b30a8' }}>Chargement...</span>
      </div>
    )
  }

  if (!accountInfo) {
    return (
      <p className="text-sm opacity-75" style={{ color: '#9b30a8' }}>
        Balance non disponible
      </p>
    )
  }

  return (
    <div className="mt-2 space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-sm font-semibold opacity-75" style={{ color: '#9b30a8' }}>Balance:</span>
        <span className="text-lg font-black" style={{ color: '#9b30a8' }}>
          {accountInfo.balance.toFixed(2)} {accountInfo.currency}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm font-semibold opacity-75" style={{ color: '#9b30a8' }}>Equity:</span>
        <span className={`text-lg font-black ${
          accountInfo.equity >= accountInfo.balance ? 'text-green-600' : 'text-red-600'
        }`}>
          {accountInfo.equity.toFixed(2)} {accountInfo.currency}
        </span>
      </div>
      {accountInfo.profit !== 0 && (
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold opacity-75" style={{ color: '#9b30a8' }}>Profit:</span>
          <span className={`text-lg font-black ${
            accountInfo.profit >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {accountInfo.profit >= 0 ? '+' : ''}{accountInfo.profit.toFixed(2)} {accountInfo.currency}
          </span>
        </div>
      )}
    </div>
  )
}

