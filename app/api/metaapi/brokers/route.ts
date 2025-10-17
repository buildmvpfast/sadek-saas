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
      id: 'vtmarker',
      name: 'VTmarker',
      servers: ['VTmarker-Live', 'VTmarker-Demo'],
    },
    {
      id: 'raisefx',
      name: 'Raise FX',
      servers: ['RaiseFX-Live', 'RaiseFX-Demo'],
    },
    {
      id: 'fxcess',
      name: 'FXcess',
      servers: ['FXcess-Live', 'FXcess-Demo'],
    },
    {
      id: 'axi',
      name: 'Axi',
      servers: ['Axi-Live', 'Axi-Demo'],
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

