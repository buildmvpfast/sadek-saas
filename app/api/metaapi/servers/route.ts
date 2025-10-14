import { NextResponse } from 'next/server'

// Liste statique des brokers et serveurs
const BROKERS_DATA = [
  {
    name: 'IC Markets',
    servers: ['ICMarketsEU-Live', 'ICMarketsSC-Live', 'ICMarketsEU-MT5', 'ICMarkets-Demo'],
  },
  {
    name: 'XM Global',
    servers: ['XMGlobal-Real', 'XMGlobal-Real 2', 'XMGlobal-Real 3', 'XMGlobal-Demo'],
  },
  {
    name: 'Pepperstone',
    servers: ['Pepperstone-Live', 'Pepperstone-Live02', 'Pepperstone-Demo'],
  },
  {
    name: 'Exness',
    servers: ['Exness-MT5Live', 'Exness-MT5Live2', 'Exness-MT5Real', 'Exness-MT5Demo'],
  },
  {
    name: 'FTMO',
    servers: ['FTMO-Server', 'FTMO-Server2', 'FTMO-Demo'],
  },
  {
    name: 'Admiral Markets',
    servers: ['AdmiralMarkets-Live', 'AdmiralMarkets-Demo'],
  },
  {
    name: 'FBS',
    servers: ['FBS-Real', 'FBS-Real-2', 'FBS-Demo'],
  },
  {
    name: 'RoboForex',
    servers: ['RoboForex-ECN', 'RoboForex-Pro', 'RoboForex-Demo'],
  },
  {
    name: 'Alpari',
    servers: ['Alpari-MT5-Live', 'Alpari-MT5-Demo'],
  },
  {
    name: 'OctaFX',
    servers: ['OctaFX-Real', 'OctaFX-Real2', 'OctaFX-Demo'],
  },
  {
    name: 'HFM (HotForex)',
    servers: ['HotForex-Live', 'HotForex-Real', 'HotForex-Demo'],
  },
  {
    name: 'FXGT',
    servers: ['FXGT-Live', 'FXGT-Demo'],
  },
  {
    name: 'AvaTrade',
    servers: ['AvaTrade-MT5Live', 'AvaTrade-MT5Demo'],
  },
  {
    name: 'ThinkMarkets',
    servers: ['ThinkMarkets-Live', 'ThinkMarkets-Demo'],
  },
  {
    name: 'FP Markets',
    servers: ['FPMarkets-Live', 'FPMarkets-Demo'],
  },
  {
    name: 'Tickmill',
    servers: ['Tickmill-Live', 'Tickmill-Demo'],
  },
  {
    name: 'Forex.com',
    servers: ['FOREX.com-Live', 'FOREX.com-Demo'],
  },
  {
    name: 'OANDA',
    servers: ['OANDA-v20-Live', 'OANDA-v20-Practice'],
  },
  {
    name: 'IG Markets',
    servers: ['IG-Live', 'IG-Demo'],
  },
  {
    name: 'CMC Markets',
    servers: ['CMCMarkets-Live', 'CMCMarkets-Demo'],
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

    // Trouver le broker
    const broker = BROKERS_DATA.find((b) => 
      b.name.toLowerCase().includes(brokerName.toLowerCase())
    )

    if (!broker) {
      return NextResponse.json({
        success: true,
        broker: brokerName,
        servers: []
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

