import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Vérifier que c'est un message
    if (!body.message) {
      return NextResponse.json({ ok: true })
    }

    const { message } = body
    const chat = message.chat
    const text = message.text

    // Vérifier que c'est un canal (pas un chat privé)
    if (chat.type !== 'channel') {
      return NextResponse.json({ ok: true })
    }

    // Extraire le nom d'utilisateur du canal
    const channelUsername = chat.username || chat.title

    if (!channelUsername || !text) {
      return NextResponse.json({ ok: true })
    }

    // Envoyer le message à l'API de parsing
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const response = await fetch(`${baseUrl}/api/telegram/parse-signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelUsername,
          messageText: text,
          messageId: message.message_id
        })
      })

      console.log('Signal processed:', await response.text())
    } catch (error) {
      console.error('Error processing signal:', error)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ ok: true })
  }
}
