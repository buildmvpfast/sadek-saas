import { NextResponse } from 'next/server'
import { MetaApiPositionMonitor } from '@/services/metaapi-position-monitor'
import { createClient } from '@supabase/supabase-js'

let monitor: MetaApiPositionMonitor | null = null

export async function POST(request: Request) {
  try {
    // Vérifier que c'est un admin qui appelle
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json(
        { success: false, error: 'Accès réservé aux admins' },
        { status: 403 }
      )
    }

    // Démarrer le monitoring
    if (!monitor) {
      monitor = new MetaApiPositionMonitor()
      await monitor.startMonitoring()
    }

    return NextResponse.json({
      success: true,
      message: 'Copy trading démarré! Les positions admin seront maintenant copiées.',
    })
  } catch (error: any) {
    console.error('Error starting copy trading:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    if (monitor) {
      monitor.stopMonitoring()
      monitor = null
    }

    return NextResponse.json({
      success: true,
      message: 'Copy trading arrêté',
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    running: monitor !== null,
  })
}

