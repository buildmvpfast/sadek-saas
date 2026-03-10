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
          region: 'london',
        }),
      }
    )

    const data = await response.json()

    console.log('MetaApi create account response:', response.status, JSON.stringify(data))

    if (!response.ok) {
      console.error('MetaApi error:', data)
      return NextResponse.json(
        {
          success: false,
          error: data.message || 'Failed to connect account to MetaApi',
          details: data,
        },
        { status: response.status }
      )
    }

    if (!data.id) {
      console.error('MetaApi returned no account ID:', data)
      return NextResponse.json(
        {
          success: false,
          error: 'MetaApi did not return an account ID. Response: ' + JSON.stringify(data),
        },
        { status: 500 }
      )
    }

    // Déployer le compte (nécessaire pour qu'il soit actif)
    if (data.id) {
      const deployResponse = await fetch(
        `https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${data.id}/deploy`,
        {
          method: 'POST',
          headers: {
            'auth-token': process.env.METAAPI_TOKEN,
          },
        }
      )

      if (!deployResponse.ok) {
        const deployError = await deployResponse.json().catch(() => ({}))
        console.warn('Deploy warning:', deployError)
        // On continue quand même, le déploiement peut être en cours
      }

      // Attendre un peu que le déploiement commence (optionnel)
      // Le compte sera déployé automatiquement par MetaAPI
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

