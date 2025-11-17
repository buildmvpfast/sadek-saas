import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const accountId = request.nextUrl.searchParams.get('accountId')
    
    if (!accountId) {
      return NextResponse.json({ error: 'accountId requis' }, { status: 400 })
    }

    const token = process.env.METAAPI_TOKEN

    if (!token) {
      return NextResponse.json({ error: 'Token MetaApi manquant' }, { status: 500 })
    }

    // Utiliser l'API REST de MetaAPI (compatible avec Node.js, pas besoin de window)
    const response = await fetch(
      `https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${accountId}/account-information`,
      {
        headers: {
          'auth-token': token,
        },
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }))
      console.error('MetaAPI REST API error:', response.status, errorData)
      
      return NextResponse.json({ 
        success: false,
        error: errorData.message || `Erreur MetaAPI: ${response.status}`
      }, { status: response.status })
    }

    const accountInfo = await response.json()

    // Calculer le profit comme equity - balance
    const profit = (accountInfo.equity || 0) - (accountInfo.balance || 0)

    return NextResponse.json({ 
      success: true, 
      accountInfo: {
        balance: accountInfo.balance || 0,
        equity: accountInfo.equity || 0,
        margin: accountInfo.margin || 0,
        freeMargin: accountInfo.freeMargin || 0,
        marginLevel: accountInfo.marginLevel || 0,
        currency: accountInfo.currency || 'USD',
        profit: profit,
        server: accountInfo.server || '',
        leverage: accountInfo.leverage || 0,
      }
    })
  } catch (error: any) {
    console.error('Error fetching account info:', error)
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Erreur lors de la récupération des informations du compte'
    }, { status: 500 })
  }
}

