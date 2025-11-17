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
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id, status')
      .eq('user_id', session.user.id)
      .single()

    if (subError || !subscription) {
      console.error('Subscription error:', subError)
      return NextResponse.json({ 
        error: 'Aucun abonnement trouvé. Veuillez vous abonner d\'abord.' 
      }, { status: 404 })
    }

    if (!subscription.stripe_customer_id) {
      return NextResponse.json({ 
        error: 'Aucun client Stripe associé. Veuillez vous abonner d\'abord.' 
      }, { status: 404 })
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/subscription`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (err: any) {
    console.error('Error creating portal session:', err)
    return NextResponse.json({ 
      error: err.message || 'Erreur lors de la création de la session du portail' 
    }, { status: 500 })
  }
}

