/**
 * Script para verificar si el token del bot es válido
 */

const BOT_TOKEN = '7607234372:AAF--tPwkLCVbBiMglNEx6i0uUGAGFA4w7Q';

async function testBotToken() {
  try {
    console.log('🔍 Verificando token del bot...');
    console.log(`🤖 Token: ${BOT_TOKEN.substring(0, 20)}...`);
    
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    const data = await response.json();
    
    if (!data.ok) {
      console.error('❌ Token inválido:', data.description);
      console.log('');
      console.log('🔧 Posibles soluciones:');
      console.log('1. Verifica que copiaste el token completo de @BotFather');
      console.log('2. Asegúrate de que no hay espacios adicionales');
      console.log('3. Verifica que el bot no haya sido eliminado');
      return;
    }
    
    const bot = data.result;
    console.log('✅ Token válido!');
    console.log(`🤖 Nombre del bot: ${bot.first_name}`);
    console.log(`📝 Username: @${bot.username}`);
    console.log(`🆔 Bot ID: ${bot.id}`);
    console.log('');
    console.log('📱 Próximos pasos:');
    console.log(`1. Busca @${bot.username} en Telegram`);
    console.log('2. Haz clic en "START" o envía /start');
    console.log('3. Envía cualquier mensaje (ej: "Hola")');
    console.log('4. Ejecuta: npm run get-chat-id');
    
  } catch (error) {
    console.error('❌ Error verificando token:', error.message);
  }
}

testBotToken();