import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Pour l'instant, on utilise les brokers statiques
    // TODO: Implémenter l'intégration MetaApi quand l'API sera clarifiée
    const brokers = getStaticBrokers()
    
    return NextResponse.json({ 
      success: true,
      brokers,
      total: brokers.length,
      source: 'static'
    })
  } catch (error: any) {
    console.error('Error fetching brokers:', error)
    return NextResponse.json(
      { 
        success: true,
        brokers: getStaticBrokers(),
        total: getStaticBrokers().length,
        source: 'static'
      },
      { status: 200 }
    )
  }
}

function extractBrokerName(profileName: string): string | null {
  // Extraire le nom du broker depuis le nom du profil
  const brokerKeywords = ['VTmarker', 'Raise FX', 'FXcess', 'Axi', 'AxiTrader']
  
  for (const keyword of brokerKeywords) {
    if (profileName.toLowerCase().includes(keyword.toLowerCase())) {
      return keyword
    }
  }
  
  return null
}

function getStaticBrokers() {
  return [
    {
      id: 'vtmarker',
      name: 'VTmarker',
      servers: [
        'VTmarker-Live',
        'VTmarker-Demo',
        'VTmarker-Live01',
        'VTmarker-Live02',
        'VTmarker-Real',
        'VTmarker-Real01',
        'VTmarker-Real02'
      ],
    },
    {
      id: 'raisefx',
      name: 'Raise FX',
      servers: [
        'RaiseFX-Live',
        'RaiseFX-Demo',
        'RaiseFX-Live01',
        'RaiseFX-Live02',
        'RaiseFX-Real',
        'RaiseFX-Real01',
        'RaiseFX-Real02',
        'RaiseFX-MT5-Live',
        'RaiseFX-MT5-Demo'
      ],
    },
    {
      id: 'fxcess',
      name: 'FXcess',
      servers: [
        'FXcess-Live',
        'FXcess-Demo',
        'FXcess-Live01',
        'FXcess-Live02',
        'FXcess-Real',
        'FXcess-Real01',
        'FXcess-Real02',
        'FXcess-MT5-Live',
        'FXcess-MT5-Demo'
      ],
    },
    {
      id: 'axi',
      name: 'Axi',
      servers: [
        'Axi-Live',
        'Axi-Demo',
        'Axi-Live01',
        'Axi-Live02',
        'Axi-Real',
        'Axi-Real01',
        'Axi-Real02',
        'Axi-MT5-Live',
        'Axi-MT5-Demo',
        'AxiTrader-Live',
        'AxiTrader-Demo'
      ],
    },
  ]
}

// Ancienne version avec MetaApi SDK (garde pour référence)
/*
export async function GET() {
  try {
    const metaApi = new MetaApi(process.env.METAAPI_TOKEN!)
    
    // Récupérer les provisions (infos sur les brokers disponibles)
    const provisioningProfileApi = metaApi.provisioningProfileApi
    const profiles = await provisioningProfileApi.getProvisioningProfiles()

*/

