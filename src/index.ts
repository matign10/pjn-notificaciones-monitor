#!/usr/bin/env node

import { checkConfig, logger } from './config';
import { PJNMonitor } from './monitor/pjn-monitor';

let monitor: PJNMonitor;

async function main() {
  console.log(`
╔═══════════════════════════════════════╗
║     PJN Notificaciones Monitor        ║
║     Sistema de Alertas Judiciales     ║
╚═══════════════════════════════════════╝
  `);

  // Verificar configuración
  if (!checkConfig()) {
    process.exit(1);
  }

  logger.info('🚀 Iniciando PJN Monitor...');

  try {
    // Inicializar monitor
    monitor = new PJNMonitor();
    await monitor.initialize();

    // Mostrar información del sistema
    console.log(`
✅ Sistema inicializado correctamente

📊 Configuración:
- Intervalo de verificación: ${process.env.CHECK_INTERVAL_MINUTES || 30} minutos
- Modo headless: ${process.env.HEADLESS_MODE || 'false'}
- Generación de PDFs: Habilitada
- Notificaciones Telegram: Habilitada

🔄 Estado:
- Monitor: Iniciando...
- Autenticación: Configurada
- Base de datos: Inicializada
- Bot Telegram: Conectado

⏰ Iniciando monitoreo automático...
    `);

    // Iniciar monitoreo automático
    await monitor.iniciarMonitoreo();

    const status = monitor.getStatus();
    
    console.log(`
🎉 SISTEMA COMPLETAMENTE OPERATIVO

📋 Estado del monitor:
- Próxima verificación: ${status.nextCheck?.toLocaleString('es-AR') || 'Calculando...'}
- Total verificaciones: ${status.totalChecks}
- Verificaciones exitosas: ${status.successfulChecks}
- Verificaciones fallidas: ${status.failedChecks}

📱 Comandos disponibles en Telegram:
/start - Iniciar conversación con el bot
/status - Ver estado del sistema  
/test - Enviar mensaje de prueba
/help - Ver ayuda completa

🔍 Comandos del sistema:
npm run test:login - Probar autenticación
npm run test:scraper - Probar detección
npm run test:telegram - Probar notificaciones
npm run check:now - Verificación manual

🤖 El sistema monitoreará automáticamente las notificaciones y te alertará por Telegram.
    `);

    // Configurar manejo de señales para cierre graceful
    process.on('SIGINT', async () => {
      console.log('\n🛑 Cerrando sistema...');
      await shutdown();
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Cerrando sistema...');
      await shutdown();
    });

    // Mantener el proceso activo
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Rejection:', reason);
    });

    process.on('uncaughtException', async (error) => {
      logger.error('Uncaught Exception:', error);
      await shutdown();
      process.exit(1);
    });

  } catch (error) {
    logger.error('💥 Error al iniciar el sistema:', error);
    
    console.log(`
❌ ERROR DE INICIALIZACIÓN

${error}

🔧 Posibles soluciones:
1. Verifica las credenciales en .env
2. Ejecuta: npm run test:login
3. Ejecuta: npm run test:telegram  
4. Instala dependencias del sistema: sudo apt-get install libnspr4 libnss3 libasound2
5. Revisa los logs en logs/

Para soporte, revisa CLAUDE.md y README.md
    `);
    
    process.exit(1);
  }
}

async function shutdown() {
  try {
    if (monitor) {
      logger.info('🛑 Cerrando monitor...');
      await monitor.shutdown();
    }
    logger.info('✅ Sistema cerrado correctamente');
    process.exit(0);
  } catch (error) {
    logger.error('Error durante el cierre:', error);
    process.exit(1);
  }
}

// Ejecutar
main().catch(error => {
  logger.error('💥 Error fatal:', error);
  process.exit(1);
});
