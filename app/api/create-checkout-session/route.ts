import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

export async function POST(req: Request) {
  try {
    const supabase = createServerClient()
    const body = await req.json()
    const plan = body.plan || 'monthly' // 'monthly' or 'yearly'

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

    // Produits Stripe
    const PRODUCT_IDS = {
      monthly: 'prod_TOJi07OHG8AVUc', // Plan Basic Mensuel
      yearly: 'prod_TOJkO0xDiqmvZn',  // Plan Basic Annuel
    }

    const productId = PRODUCT_IDS[plan as keyof typeof PRODUCT_IDS] || PRODUCT_IDS.monthly

    // Récupérer les prix du produit
    const prices = await stripe.prices.list({
      product: productId,
      active: true,
    })

    if (!prices.data || prices.data.length === 0) {
      return NextResponse.json({ error: 'Aucun prix trouvé pour ce produit' }, { status: 400 })
    }

    // Utiliser le premier prix actif (normalement il n'y en a qu'un par produit)
    const priceId = prices.data[0].id

    // Vérifier et normaliser NEXT_PUBLIC_APP_URL
    let appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) {
      // Essayer de récupérer depuis la requête
      const origin = req.headers.get('origin') || req.headers.get('referer')
      if (origin) {
        appUrl = origin.replace(/\/$/, '') // Enlever le trailing slash
      } else {
        throw new Error('NEXT_PUBLIC_APP_URL non configuré et impossible de le détecter automatiquement')
      }
    }
    
    // S'assurer que l'URL a le schéma https://
    if (!appUrl.startsWith('http://') && !appUrl.startsWith('https://')) {
      appUrl = `https://${appUrl}`
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: profile?.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/subscription?success=true`,
      cancel_url: `${appUrl}/subscription?canceled=true`,
      metadata: {
        user_id: session.user.id,
        plan: plan,
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (err: any) {
    console.error('Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

