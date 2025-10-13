import { NextResponse } from 'next/server'
import MetaApi from 'metaapi.cloud-sdk'

export async function GET() {
  try {
    const metaApi = new MetaApi(process.env.METAAPI_TOKEN!)
    
    // Récupérer les provisions (infos sur les brokers disponibles)
    const provisioningProfileApi = metaApi.provisioningProfileApi
    const profiles = await provisioningProfileApi.getProvisioningProfiles()

    // Liste des brokers populaires (MetaApi en a des centaines, on filtre les principaux)
    const popularBrokers = [
      'ICMarkets', 'XM', 'Pepperstone', 'Exness', 'FTMO', 
      'Admiral Markets', 'FBS', 'RoboForex', 'Alpari', 'OctaFX',
      'HotForex', 'FXGT', 'AvaTrade', 'ThinkMarkets', 'FPMarkets',
      'Tickmill', 'FOREX.com', 'OANDA', 'CMC Markets', 'IG'
    ]

    // Formater pour le frontend
    const brokers = profiles
      .filter((profile: any) => {
        const name = profile.name || ''
        return popularBrokers.some(broker => 
          name.toLowerCase().includes(broker.toLowerCase())
        )
      })
      .map((profile: any) => ({
        id: profile._id,
        name: profile.name,
        servers: profile.servers || [],
        description: profile.description,
        type: profile.type,
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name))

    return NextResponse.json({ 
      success: true,
      brokers,
      total: brokers.length
    })
  } catch (error: any) {
    console.error('Error fetching brokers:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        // Fallback: liste statique si l'API fail
        brokers: getFallbackBrokers()
      },
      { status: 200 } // 200 pour permettre le fallback
    )
  }
}

// Liste de secours si MetaApi ne répond pas
function getFallbackBrokers() {
  return [
    {
      id: 'icmarkets',
      name: 'IC Markets',
      servers: ['ICMarketsEU-Live', 'ICMarketsSC-Live', 'ICMarkets-Demo'],
    },
    {
      id: 'xm',
      name: 'XM Global',
      servers: ['XMGlobal-Real', 'XMGlobal-Demo'],
    },
    {
      id: 'pepperstone',
      name: 'Pepperstone',
      servers: ['Pepperstone-Live', 'Pepperstone-Demo'],
    },
    {
      id: 'exness',
      name: 'Exness',
      servers: ['Exness-MT5Live', 'Exness-MT5Demo'],
    },
    {
      id: 'ftmo',
      name: 'FTMO',
      servers: ['FTMO-Server', 'FTMO-Demo'],
    },
  ]
}

