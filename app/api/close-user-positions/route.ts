import { NextResponse } from 'next/server'
import { getMetaApiCopyTradingService } from '@/services/metaapi-copy-trading'

export async function POST(req: Request) {
  try {
    const { user_id } = await req.json()

    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 })
    }

    const copyTradingService = getMetaApiCopyTradingService()
    await copyTradingService.closeUserPositions(user_id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

