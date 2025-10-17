// Script pour configurer le webhook Telegram pour L'IMPRIMANTE
require('dotenv').config({ path: '.env.local' });

const TELEGRAM_BOT_TOKEN = '8496815756:AAEFOf60xHTGEWlXWtzgSIMwNJzwDhCra4M';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

if (!APP_URL) {
  console.error('Please set NEXT_PUBLIC_APP_URL in your .env.local file');
  process.exit(1);
}

const webhookUrl = `${APP_URL}/api/telegram/webhook`;
const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`;

async function setupWebhook() {
  try {
    console.log('🚀 Configuration du webhook Telegram pour L\'IMPRIMANTE...');
    console.log('Token:', TELEGRAM_BOT_TOKEN.substring(0, 10) + '...');
    console.log('Webhook URL:', webhookUrl);

    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message'],
        drop_pending_updates: true
      }),
    });

    const data = await response.json();

    if (data.ok) {
      console.log('✅ Webhook Telegram configuré avec succès!');
      console.log('Description:', data.description);
      console.log('Webhook URL:', webhookUrl);
      
      // Vérifier les informations du bot
      const botInfoUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`;
      const botResponse = await fetch(botInfoUrl);
      const botData = await botResponse.json();
      
      if (botData.ok) {
        console.log('🤖 Informations du bot:');
        console.log('  - Nom:', botData.result.first_name);
        console.log('  - Username:', botData.result.username);
        console.log('  - ID:', botData.result.id);
      }
    } else {
      console.error('❌ Erreur lors de la configuration du webhook:', data.description);
    }
  } catch (error) {
    console.error('❌ Erreur lors de la configuration du webhook:', error);
  }
}

setupWebhook();
