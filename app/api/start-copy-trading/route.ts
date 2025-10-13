import { NextResponse } from 'next/server'
import { getMetaApiCopyTradingService } from '@/services/metaapi-copy-trading'

export async function POST(req: Request) {
  try {
    const copyTradingService = getMetaApiCopyTradingService()
    await copyTradingService.start()

    return NextResponse.json({ success: true, message: 'Copy trading service started' })
  } catch (err: any) {
    console.error('Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

