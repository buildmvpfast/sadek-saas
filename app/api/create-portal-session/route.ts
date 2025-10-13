import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

export async function POST(req: Request) {
  try {
    const supabase = createServerClient()

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', session.user.id)
      .single()

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (err: any) {
    console.error('Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

