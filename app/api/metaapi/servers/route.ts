import { NextResponse } from 'next/server'

// Liste des brokers et leurs vrais serveurs
const BROKERS_DATA = [
  {
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

    // Pour l'instant, on utilise les serveurs statiques
    // TODO: Implémenter l'intégration MetaApi quand l'API sera clarifiée
    const broker = BROKERS_DATA.find((b) => 
      b.name.toLowerCase().includes(brokerName.toLowerCase())
    )

    if (!broker) {
      return NextResponse.json({
        success: true,
        broker: brokerName,
        servers: [],
        source: 'static'
      })
    }

    // Formater les serveurs
    const servers = broker.servers.map((server) => ({
      name: server,
      type: server.includes('Demo') ? 'demo' : 'live',
    }))

    return NextResponse.json({
      success: true,
      broker: broker.name,
      servers,
      source: 'static'
    })
  } catch (error: any) {
    console.error('Error fetching servers:', error)
    return NextResponse.json(
      { success: false, error: error.message, servers: [] },
      { status: 500 }
    )
  }
}

