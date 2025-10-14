import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Pour l'instant, on retourne une liste statique de brokers
    // MetaApi SDK a des problèmes d'import dans Next.js
    const brokers = getStaticBrokers()
    
    return NextResponse.json({ 
      success: true,
      brokers,
      total: brokers.length
    })
  } catch (error: any) {
    console.error('Error fetching brokers:', error)
    return NextResponse.json(
      { 
        success: true, // On retourne quand même les brokers
        brokers: getStaticBrokers(),
        total: getStaticBrokers().length
      },
      { status: 200 }
    )
  }
}

function getStaticBrokers() {
  return [
    {
      id: 'icmarkets',
      name: 'IC Markets',
      servers: ['ICMarketsEU-Live', 'ICMarketsSC-Live', 'ICMarketsEU-MT5', 'ICMarkets-Demo'],
    },
    {
      id: 'xm',
      name: 'XM Global',
      servers: ['XMGlobal-Real', 'XMGlobal-Real 2', 'XMGlobal-Real 3', 'XMGlobal-Demo'],
    },
    {
      id: 'pepperstone',
      name: 'Pepperstone',
      servers: ['Pepperstone-Live', 'Pepperstone-Live02', 'Pepperstone-Demo'],
    },
    {
      id: 'exness',
      name: 'Exness',
      servers: ['Exness-MT5Live', 'Exness-MT5Live2', 'Exness-MT5Real', 'Exness-MT5Demo'],
    },
    {
      id: 'ftmo',
      name: 'FTMO',
      servers: ['FTMO-Server', 'FTMO-Server2', 'FTMO-Demo'],
    },
    {
      id: 'admiral',
      name: 'Admiral Markets',
      servers: ['AdmiralMarkets-Live', 'AdmiralMarkets-Demo'],
    },
    {
      id: 'fbs',
      name: 'FBS',
      servers: ['FBS-Real', 'FBS-Real-2', 'FBS-Demo'],
    },
    {
      id: 'roboforex',
      name: 'RoboForex',
      servers: ['RoboForex-ECN', 'RoboForex-Pro', 'RoboForex-Demo'],
    },
    {
      id: 'alpari',
      name: 'Alpari',
      servers: ['Alpari-MT5-Live', 'Alpari-MT5-Demo'],
    },
    {
      id: 'octafx',
      name: 'OctaFX',
      servers: ['OctaFX-Real', 'OctaFX-Real2', 'OctaFX-Demo'],
    },
    {
      id: 'hotforex',
      name: 'HFM (HotForex)',
      servers: ['HotForex-Live', 'HotForex-Real', 'HotForex-Demo'],
    },
    {
      id: 'fxgt',
      name: 'FXGT',
      servers: ['FXGT-Live', 'FXGT-Demo'],
    },
    {
      id: 'avatrade',
      name: 'AvaTrade',
      servers: ['AvaTrade-MT5Live', 'AvaTrade-MT5Demo'],
    },
    {
      id: 'thinkmarkets',
      name: 'ThinkMarkets',
      servers: ['ThinkMarkets-Live', 'ThinkMarkets-Demo'],
    },
    {
      id: 'fpmarkets',
      name: 'FP Markets',
      servers: ['FPMarkets-Live', 'FPMarkets-Demo'],
    },
    {
      id: 'tickmill',
      name: 'Tickmill',
      servers: ['Tickmill-Live', 'Tickmill-Demo'],
    },
    {
      id: 'forexcom',
      name: 'Forex.com',
      servers: ['FOREX.com-Live', 'FOREX.com-Demo'],
    },
    {
      id: 'oanda',
      name: 'OANDA',
      servers: ['OANDA-v20-Live', 'OANDA-v20-Practice'],
    },
    {
      id: 'igmarkets',
      name: 'IG Markets',
      servers: ['IG-Live', 'IG-Demo'],
    },
    {
      id: 'cmcmarkets',
      name: 'CMC Markets',
      servers: ['CMCMarkets-Live', 'CMCMarkets-Demo'],
    },
    {
      id: 'custom',
      name: 'Autre (serveur personnalisé)',
      servers: ['CUSTOM'],
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

