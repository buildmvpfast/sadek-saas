import { NextResponse } from 'next/server'
import MetaApi from 'metaapi.cloud-sdk'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const brokerName = searchParams.get('broker')

    if (!brokerName) {
      return NextResponse.json(
        { success: false, error: 'Broker name required' },
        { status: 400 }
      )
    }

    const metaApi = new MetaApi(process.env.METAAPI_TOKEN!)
    
    // Récupérer les profils de provisioning
    const provisioningProfileApi = metaApi.provisioningProfileApi
    const profiles = await provisioningProfileApi.getProvisioningProfiles()

    // Trouver le broker
    const broker = profiles.find((profile: any) => 
      profile.name && profile.name.toLowerCase().includes(brokerName.toLowerCase())
    )

    if (!broker || !broker.servers) {
      return NextResponse.json({
        success: false,
        error: 'Broker not found',
        servers: []
      })
    }

    // Formater les serveurs
    const servers = broker.servers.map((server: any) => ({
      name: typeof server === 'string' ? server : server.name,
      type: typeof server === 'string' ? 'unknown' : (server.type || 'live'),
    }))

    return NextResponse.json({
      success: true,
      broker: broker.name,
      servers
    })
  } catch (error: any) {
    console.error('Error fetching servers:', error)
    return NextResponse.json(
      { success: false, error: error.message, servers: [] },
      { status: 500 }
    )
  }
}

