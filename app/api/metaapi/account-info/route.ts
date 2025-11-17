import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const accountId = request.nextUrl.searchParams.get('accountId')
    
    if (!accountId) {
      return NextResponse.json({ error: 'accountId requis' }, { status: 400 })
    }

    const { default: MetaApi } = await import('metaapi.cloud-sdk')
    const token = process.env.METAAPI_TOKEN

    if (!token) {
      return NextResponse.json({ error: 'Token MetaApi manquant' }, { status: 500 })
    }

    const api = new MetaApi(token)
    const account = await api.metatraderAccountApi.getAccount(accountId)
    
    await account.waitDeployed()
    const connection = account.getRPCConnection()
    await connection.connect()
    await connection.waitSynchronized()

    const accountInfo = await connection.getAccountInformation()

    // Calculer le profit comme equity - balance
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

