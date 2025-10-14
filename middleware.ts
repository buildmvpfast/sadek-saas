import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Public routes (accessible sans connexion)
  const publicRoutes = ['/', '/auth/login', '/auth/signup']
  const isPublicRoute = publicRoutes.includes(req.nextUrl.pathname)
  
  // Routes accessibles même sans abonnement
  const noSubscriptionRequiredRoutes = [
    '/subscription-required',
    '/subscription',
    ...publicRoutes,
  ]
  const isNoSubscriptionRequired = noSubscriptionRequiredRoutes.some(route => 
    req.nextUrl.pathname.startsWith(route)
  )

  // Redirect to login if not authenticated
  if (!session && !isPublicRoute) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  // Check subscription for authenticated users (skip for admins)
  if (session && !isNoSubscriptionRequired && !req.nextUrl.pathname.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single()

    // Les admins n'ont pas besoin d'abonnement
    if (!profile?.is_admin) {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', session.user.id)
        .single()

      // Rediriger vers le paywall si pas d'abonnement actif
      if (subscription?.status !== 'active' && subscription?.status !== 'trialing') {
        return NextResponse.redirect(new URL('/subscription-required', req.url))
      }
    }
  }

  return res
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}

