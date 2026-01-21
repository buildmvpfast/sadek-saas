
async function simulateSignal() {
  const url = 'https://sadek-saas.vercel.app/api/telegram/webhook'; // Update with your actual Vercel URL
  
  const payload = {
    update_id: 999999,
    channel_post: {
      message_id: Math.floor(Math.random() * 1000000),
      chat: {
        id: -1002313602819,
        title: "L’imprimante VIP 🔒🖨️💸",
        type: "channel"
      },
      date: Math.floor(Date.now() / 1000),
      text: "Buy limit gold 4832.5-4833\n\nTp1 4841 \nTp2 4868.7\nSl 4828.5 \n@ImprimBot"
    }
  };

  console.log('🚀 Envoi d\'une simulation du dernier signal...');
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('✅ Webhook Response:', data);
    console.log('\nCONSIGNES:');
    console.log('1. Vérifiez vos logs Vercel pour voir "✅ Signal parsé"');
    console.log('2. Vérifiez votre base de données (Point 5) pour voir le signal');
    console.log('3. Vérifiez Render pour voir "1 trade(s) prêt(s) à être exécuté(s)"');
  } catch (error) {
    console.error('❌ Erreur simulation:', error);
  }
}

simulateSignal();
