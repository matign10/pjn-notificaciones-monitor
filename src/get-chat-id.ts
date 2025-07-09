/**
 * Script para obtener tu Chat ID de Telegram
 * 
 * Instrucciones:
 * 1. Reemplaza 'TU_BOT_TOKEN' con el token real de tu bot
 * 2. Ejecuta: npm run get-chat-id
 * 3. El script te mostrará tu Chat ID
 */

const BOT_TOKEN = '7607234372:AAF--tPwkLCVbBiMglNEx6i0uUGAGFA4w7Q'; // Reemplaza con tu token real

async function getChatId() {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`);
    const data = await response.json();
    
    if (!data.ok) {
      console.error('❌ Error:', data.description);
      return;
    }
    
    if (data.result.length === 0) {
      console.log('📱 No hay mensajes. Envía un mensaje a tu bot primero.');
      return;
    }
    
    const ultimoMensaje = data.result[data.result.length - 1];
    const chatId = ultimoMensaje.message.chat.id;
    const usuario = ultimoMensaje.message.from.first_name;
    
    console.log('✅ Chat ID encontrado:');
    console.log(`👤 Usuario: ${usuario}`);
    console.log(`🆔 Chat ID: ${chatId}`);
    console.log('');
    console.log('📝 Agrega estas líneas a tu archivo .env:');
    console.log(`TELEGRAM_BOT_TOKEN=${BOT_TOKEN}`);
    console.log(`TELEGRAM_CHAT_ID=${chatId}`);
    
  } catch (error) {
    console.error('❌ Error obteniendo Chat ID:', error);
  }
}

getChatId();