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

    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', session.user.id)
      .single()

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: profile?.email,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'MT5 Copy Trading - Abonnement Mensuel',
              description: 'Copy trading illimité avec jusqu\'à 5 comptes MT5',
            },
            unit_amount: 4900, // 49€ in cents
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription?canceled=true`,
      metadata: {
        user_id: session.user.id,
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (err: any) {
    console.error('Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

