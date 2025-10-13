import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Webhook Error' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        await supabaseAdmin.from('subscriptions').update({
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          status: 'active',
        }).eq('user_id', session.metadata?.user_id)

        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription

        await supabaseAdmin.from('subscriptions').update({
          status: subscription.status as any,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        }).eq('stripe_subscription_id', subscription.id)

        // If subscription is no longer active, close all open positions
        if (subscription.status !== 'active' && subscription.status !== 'trialing') {
          const { data: subData } = await supabaseAdmin
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_subscription_id', subscription.id)
            .single()

          if (subData) {
            // Trigger position closing (implement in MT5 service)
            await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/close-user-positions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: subData.user_id }),
            })
          }
        }

        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription

        await supabaseAdmin.from('subscriptions').update({
          status: 'canceled',
        }).eq('stripe_subscription_id', subscription.id)

        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('Error processing webhook:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

