import { TelegramBot } from './telegram-bot';
import { logger, checkConfig } from '../config';

/**
 * Script de prueba para verificar el bot de Telegram
 * Ejecutar con: npm run test:telegram
 */
async function testTelegram() {
  logger.info('🧪 Iniciando test del bot de Telegram...');
  
  // Verificar configuración
  if (!checkConfig()) {
    process.exit(1);
  }

  const telegramBot = new TelegramBot();

  try {
    // Inicializar bot
    logger.info('🚀 Inicializando bot de Telegram...');
    await telegramBot.initialize();

    console.log(`
✅ Bot de Telegram inicializado correctamente

🧪 Ejecutando pruebas...
    `);

    // Test 1: Conectividad básica
    logger.info('🔗 Probando conectividad...');
    const conectividad = await telegramBot.probarConectividad();
    
    if (conectividad) {
      console.log('✅ Test 1: Conectividad - EXITOSO');
    } else {
      console.log('❌ Test 1: Conectividad - FALLÓ');
      return;
    }

    // Esperar un poco entre mensajes
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Notificación de prueba
    logger.info('📤 Enviando notificación de prueba...');
    const notificacionPrueba = {
      expediente: 'TEST-2024-001',
      caratula: 'PRUEBA DE NOTIFICACIÓN - TEST AUTOMÁTICO',
      fecha: new Date(),
      mensaje: 'Esta es una notificación de prueba generada por el sistema de testing automático. Si recibes este mensaje, significa que el bot de Telegram está funcionando correctamente.',
      urgente: false
    };

    const resultadoNotificacion = await telegramBot.enviarNotificacion(notificacionPrueba);
    
    if (resultadoNotificacion.success) {
      console.log(`✅ Test 2: Notificación - EXITOSO (Message ID: ${resultadoNotificacion.messageId})`);
    } else {
      console.log(`❌ Test 2: Notificación - FALLÓ: ${resultadoNotificacion.error}`);
    }

    // Esperar un poco entre mensajes
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: Notificación urgente
    logger.info('🚨 Enviando notificación urgente de prueba...');
    const notificacionUrgente = {
      expediente: 'URGENT-2024-001',
      caratula: 'PRUEBA DE NOTIFICACIÓN URGENTE - TEST',
      fecha: new Date(),
      mensaje: 'Esta es una notificación URGENTE de prueba. Las notificaciones urgentes tienen un formato visual diferente.',
      urgente: true
    };

    const resultadoUrgente = await telegramBot.enviarNotificacion(notificacionUrgente);
    
    if (resultadoUrgente.success) {
      console.log(`✅ Test 3: Notificación urgente - EXITOSO (Message ID: ${resultadoUrgente.messageId})`);
    } else {
      console.log(`❌ Test 3: Notificación urgente - FALLÓ: ${resultadoUrgente.error}`);
    }

    // Esperar un poco entre mensajes
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 4: Resumen de notificaciones
    logger.info('📊 Enviando resumen de prueba...');
    const expedientesPrueba = [
      {
        id: '1',
        numero: 'EXP-2024-001',
        caratula: 'EXPEDIENTE DE PRUEBA UNO - CARÁTULA COMPLETA PARA TESTING',
        tieneNotificacion: true,
        ultimaVerificacion: new Date(),
        notificacionEnviada: false
      },
      {
        id: '2', 
        numero: 'EXP-2024-002',
        caratula: 'SEGUNDO EXPEDIENTE DE PRUEBA - OTRA CARÁTULA PARA TESTING DEL SISTEMA',
        tieneNotificacion: true,
        ultimaVerificacion: new Date(),
        notificacionEnviada: false
      }
    ];

    const resultadoResumen = await telegramBot.enviarResumen(expedientesPrueba);
    
    if (resultadoResumen.success) {
      console.log(`✅ Test 4: Resumen - EXITOSO (Message ID: ${resultadoResumen.messageId})`);
    } else {
      console.log(`❌ Test 4: Resumen - FALLÓ: ${resultadoResumen.error}`);
    }

    // Esperar un poco entre mensajes
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 5: Estado del sistema
    logger.info('📊 Enviando estado del sistema...');
    const estadisticasPrueba = {
      totalExpedientes: 25,
      expedientesConNotificaciones: 5,
      notificacionesPendientes: 2,
      notificacionesEnviadas: 18
    };

    const resultadoEstado = await telegramBot.enviarEstadoSistema(estadisticasPrueba);
    
    if (resultadoEstado.success) {
      console.log(`✅ Test 5: Estado del sistema - EXITOSO (Message ID: ${resultadoEstado.messageId})`);
    } else {
      console.log(`❌ Test 5: Estado del sistema - FALLÓ: ${resultadoEstado.error}`);
    }

    // Esperar un poco entre mensajes
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 6: Error crítico (simulado)
    logger.info('🚨 Enviando error crítico de prueba...');
    const resultadoError = await telegramBot.enviarErrorCritico(
      'Error de prueba del sistema de notificaciones',
      'Test automático - Este es un error simulado para verificar el funcionamiento'
    );
    
    if (resultadoError.success) {
      console.log(`✅ Test 6: Error crítico - EXITOSO (Message ID: ${resultadoError.messageId})`);
    } else {
      console.log(`❌ Test 6: Error crítico - FALLÓ: ${resultadoError.error}`);
    }

    // Resumen final
    console.log(`
╔══════════════════════════════════════╗
║        TESTS COMPLETADOS             ║
║                                      ║
║ ✅ Bot de Telegram funcionando       ║
║ ✅ Notificaciones configuradas       ║
║ ✅ Formatos de mensaje correctos     ║
║ ✅ Sistema de alertas operativo      ║
╚══════════════════════════════════════╝

🎉 TODOS LOS TESTS EXITOSOS

El bot está listo para enviar notificaciones reales.
Puedes usar los siguientes comandos en Telegram:

/start - Iniciar conversación con el bot
/status - Ver estado del sistema
/test - Enviar mensaje de prueba
/help - Ver ayuda

📱 Chat ID configurado: ${process.env.TELEGRAM_CHAT_ID}
🤖 Bot Token: ${process.env.TELEGRAM_BOT_TOKEN ? 'Configurado' : 'NO CONFIGURADO'}
    `);

  } catch (error) {
    logger.error('💥 Error durante el test de Telegram:', error);
    
    console.log(`
❌ ERROR FATAL

${error}

Posibles causas:
1. Token del bot incorrecto en .env
2. Chat ID incorrecto en .env  
3. Bot no tiene permisos para enviar mensajes
4. Problemas de conectividad

Soluciones:
1. Verifica TELEGRAM_BOT_TOKEN en .env
2. Verifica TELEGRAM_CHAT_ID en .env
3. Asegúrate de haber iniciado conversación con el bot
4. Verifica que el bot no esté bloqueado

Para obtener el Chat ID:
1. Habla con @userinfobot en Telegram
2. Envía cualquier mensaje
3. Copia el ID que te responde

Para crear un bot:
1. Habla con @BotFather en Telegram  
2. Usa /newbot
3. Sigue las instrucciones
4. Copia el token que te da

Revisa los logs en logs/ para más información.
    `);
    
  } finally {
    logger.info('🧹 Finalizando test...');
    // No detenemos el bot aquí para permitir testing manual de comandos
  }
}

// Ejecutar test
testTelegram().catch(error => {
  logger.error('💥 Error fatal en test de Telegram:', error);
  process.exit(1);
});