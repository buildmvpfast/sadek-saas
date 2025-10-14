import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, login, password, server, platform, magic } = body

    if (!process.env.METAAPI_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'MetaApi token not configured' },
        { status: 500 }
      )
    }

    // Créer un compte MetaApi via leur REST API
    const response = await fetch(
      'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'auth-token': process.env.METAAPI_TOKEN,
        },
        body: JSON.stringify({
          name,
          type: 'cloud',
          login: login.toString(),
          password,
          server,
          platform,
          magic: magic || 0,
          application: 'MetaApi',
          region: 'new-york', // ou 'london', 'singapore'
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('MetaApi error:', data)
      return NextResponse.json(
        {
          success: false,
          error: data.message || 'Failed to connect account to MetaApi',
        },
        { status: response.status }
      )
    }

    // Déployer le compte (nécessaire pour qu'il soit actif)
    if (data.id) {
      await fetch(
        `https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${data.id}/deploy`,
        {
          method: 'POST',
          headers: {
            'auth-token': process.env.METAAPI_TOKEN,
          },
        }
      )
    }

    return NextResponse.json({
      success: true,
      accountId: data.id,
      state: data.state,
      connectionStatus: data.connectionStatus,
    })
  } catch (error: any) {
    console.error('Error connecting account:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

