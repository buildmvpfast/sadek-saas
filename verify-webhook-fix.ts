

  const url = 'http://localhost:3000/api/telegram/webhook';
  
  const payload = {
    update_id: 137150967,
    channel_post: {
      message_id: 11150,
      sender_chat: {
        id: -1002313602819,
        title: "L’imprimante VIP 🔒🖨️💸",
        type: "channel"
      },
      chat: {
        id: -1002313602819,
        title: "L’imprimante VIP 🔒🖨️💸",
        type: "channel"
      },
      date: 1768917659,
      text: "Buy limit ( nous sommes en live ) \n\n4731.9 \nTP1 4736\nTP2 ouvert \nSL 4729\n@ImprimBot",
      entities: [{ offset: 73, length: 10, type: "mention" }]
    }
  };

  console.log('Sending webhook payload...');
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('Response:', data);
    console.log('Check your server logs to see if "✅ Canal détecté" and "✅ Canal trouvé" appear with the ID -1002313602819.');
  } catch (error) {
    console.error('Error sending webhook:', error);
  }
}

verifyWebhook();
