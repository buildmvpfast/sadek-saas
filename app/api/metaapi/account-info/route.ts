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

    const { default: MetaApi } = await import('metaapi.cloud-sdk')
    const api = new MetaApi(token)
    const account = await api.metatraderAccountApi.getAccount(accountId)
    
    // Timeout pour waitDeployed (15 secondes max)
    try {
      const deployedPromise = account.waitDeployed()
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: account deployment took too long')), 15000)
      )
      await Promise.race([deployedPromise, timeoutPromise])
    } catch (error: any) {
      // Si le compte n'est pas déployé, on continue quand même
      console.warn('Account deployment warning:', error.message)
    }
    
    const connection = account.getRPCConnection()
    
    try {
      await connection.connect()
    } catch (error: any) {
      console.warn('Connection warning:', error.message)
      // On continue même si la connexion échoue
    }
    
    // Timeout pour waitSynchronized (15 secondes max)
    try {
      const syncPromise = connection.waitSynchronized()
      const syncTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: synchronization took too long')), 15000)
      )
      await Promise.race([syncPromise, syncTimeoutPromise])
    } catch (error: any) {
      // Si la synchronisation échoue, on essaie quand même de récupérer les infos
      console.warn('Synchronization warning:', error.message)
    }

    let accountInfo
    try {
      accountInfo = await connection.getAccountInformation()
    } catch (error: any) {
      console.error('Error getting account information:', error)
      throw new Error(`Impossible de récupérer les informations du compte: ${error.message}`)
    }

    const profit = accountInfo.equity - accountInfo.balance

    return NextResponse.json({ 
      success: true, 
      accountInfo: {
        balance: accountInfo.balance,
        equity: accountInfo.equity,
        margin: accountInfo.margin,
        freeMargin: accountInfo.freeMargin,
        marginLevel: accountInfo.marginLevel,
        currency: accountInfo.currency,
        profit: profit,
        server: accountInfo.server,
        leverage: accountInfo.leverage,
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

