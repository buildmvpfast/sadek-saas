import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const accountId = request.nextUrl.searchParams.get('accountId')

    if (!accountId) {
      return NextResponse.json({ error: 'accountId requis' }, { status: 400 })
    }

    const token = process.env.METAAPI_TOKEN

    if (!token) {
      return NextResponse.json({ error: 'Token MetaApi manquant' }, { status: 500 })
    }

    // Validate that accountId looks like a MetaApi UUID, not an MT5 login number
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(accountId)) {
      return NextResponse.json(
        {
          success: false,
          error: `"${accountId}" n'est pas un ID MetaApi valide. Le compte MT5 doit être reconecté via la plateforme.`,
          positions: [],
        },
        { status: 400 }
      )
    }

    // Use REST API directly — much faster than SDK streaming connection
    const response = await fetch(
      `https://mt-client-api-v1.london.agiliumtrade.ai/users/current/accounts/${accountId}/positions`,
      {
        headers: {
          'auth-token': token,
          'Content-Type': 'application/json',
        },
      }
    )

    // If london fails, try new-york as fallback
    if (!response.ok && response.status === 404) {
      const fallbackResponse = await fetch(
        `https://mt-client-api-v1.new-york.agiliumtrade.ai/users/current/accounts/${accountId}/positions`,
        {
          headers: {
            'auth-token': token,
            'Content-Type': 'application/json',
          },
        }
      )
      if (fallbackResponse.ok) {
        const positions = await fallbackResponse.json()
        return NextResponse.json({ success: true, positions: positions || [] })
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('MetaApi positions error:', response.status, errorData)
      return NextResponse.json(
        { success: false, error: errorData.message || `MetaApi error ${response.status}`, positions: [] },
        { status: response.status }
      )
    }

    const positions = await response.json()

    return NextResponse.json({ success: true, positions: positions || [] })
  } catch (error: any) {
    console.error('Error fetching positions:', error)
    return NextResponse.json({ success: false, error: error.message, positions: [] }, { status: 500 })
  }
}

