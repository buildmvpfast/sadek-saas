import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Public routes
  const publicRoutes = ['/', '/auth/login', '/auth/signup']
  const isPublicRoute = publicRoutes.includes(req.nextUrl.pathname)

  // Redirect to login if not authenticated
  if (!session && !isPublicRoute) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  // Skip subscription check for now (can re-enable later)
  // Uncomment below to enable subscription checks
  /*
  if (session && !isPublicRoute && !req.nextUrl.pathname.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single()

    if (!profile?.is_admin) {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', session.user.id)
        .single()

      if (subscription?.status !== 'active' && subscription?.status !== 'trialing') {
        if (req.nextUrl.pathname !== '/subscription') {
          return NextResponse.redirect(new URL('/subscription', req.url))
        }
      }
    }
  }
  */

  return res
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}

