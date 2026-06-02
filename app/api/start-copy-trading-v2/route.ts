import { NextResponse } from 'next/server'

let monitor: any = null

export async function POST(request: Request) {
  try {
    const { createRouteHandlerClient } = await import('@supabase/auth-helpers-nextjs')
    const { cookies } = await import('next/headers')
    const supabase = createRouteHandlerClient({ cookies })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ success: false, error: 'Accès réservé aux admins' }, { status: 403 })
    }

    // Import dynamique pour éviter l'erreur au build
    const { MetaApiPositionMonitor } = await import('@/services/metaapi-position-monitor')

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
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { createRouteHandlerClient } = await import('@supabase/auth-helpers-nextjs')
    const { cookies } = await import('next/headers')
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })
    }
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) {
      return NextResponse.json({ success: false, error: 'Accès réservé aux admins' }, { status: 403 })
    }

    if (monitor) {
      await monitor.stopMonitoring()
      monitor = null
    }

    return NextResponse.json({ success: true, message: 'Copy trading arrêté' })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    running: monitor !== null,
  })
}

