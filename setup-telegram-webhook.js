// Script pour configurer le webhook Telegram
// Exécute ce script avec: node setup-telegram-webhook.js

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const WEBHOOK_URL = process.env.NEXT_PUBLIC_APP_URL + '/api/telegram/webhook'

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN manquant dans .env.local')
  process.exit(1)
}

async function setupWebhook() {
  try {
    console.log('🔧 Configuration du webhook Telegram...')
    console.log('📡 URL:', WEBHOOK_URL)

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        allowed_updates: ['message']
      })
    })

    const result = await response.json()
    
    if (result.ok) {
      console.log('✅ Webhook configuré avec succès!')
      console.log('📋 Résultat:', result.description)
    } else {
      console.error('❌ Erreur:', result.description)
    }
  } catch (error) {
    console.error('❌ Erreur:', error.message)
  }
}

setupWebhook()
