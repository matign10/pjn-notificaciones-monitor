import { PJNMonitor } from './monitor/pjn-monitor';
import { config, logger, checkConfig } from './config';
import cron from 'node-cron';

/**
 * Script principal del monitor automático de notificaciones PJN
 */
async function iniciarMonitor() {
  logger.info('🚀 Iniciando Monitor Automático de Notificaciones PJN...');
  
  if (!checkConfig()) {
    logger.error('❌ Configuración inválida, deteniendo...');
    process.exit(1);
  }

  const monitor = new PJNMonitor();

  try {
    // Inicializar el monitor
    await monitor.initialize();
    logger.info('✅ Monitor inicializado correctamente');

    // Ejecutar una verificación inicial
    logger.info('🔍 Ejecutando verificación inicial...');
    await monitor.ejecutarVerificacion();

    // Configurar el scheduler automático
    const intervaloMinutos = config.app.checkIntervalMinutes;
    const cronExpression = `*/${intervaloMinutos} * * * *`; // Cada X minutos
    
    logger.info(`⏰ Configurando scheduler automático cada ${intervaloMinutos} minutos...`);
    logger.info(`📅 Expresión cron: ${cronExpression}`);

    cron.schedule(cronExpression, async () => {
      logger.info(`🔄 [${new Date().toLocaleString()}] Ejecutando verificación programada...`);
      try {
        await monitor.ejecutarVerificacion();
        logger.info('✅ Verificación programada completada');
      } catch (error) {
        logger.error('❌ Error en verificación programada:', error);
      }
    }, {
      scheduled: true,
      timezone: "America/Argentina/Buenos_Aires"
    });

    logger.info('🔄 Scheduler configurado y en funcionamiento');
    logger.info(`⏰ Próxima verificación en ${intervaloMinutos} minutos`);
    logger.info('🛑 Presiona Ctrl+C para detener el monitor');

    // Manejar señales de terminación
    process.on('SIGINT', async () => {
      logger.info('🛑 Recibida señal de terminación...');
      await monitor.cleanup();
      logger.info('👋 Monitor detenido correctamente');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('🛑 Recibida señal de terminación del sistema...');
      await monitor.cleanup();
      logger.info('👋 Monitor detenido correctamente');
      process.exit(0);
    });

    // Mantener el proceso vivo
    process.stdin.resume();

  } catch (error) {
    logger.error('💥 Error al inicializar monitor:', error);
    await monitor.cleanup();
    process.exit(1);
  }
}

// Manejar errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Promesa rechazada no manejada:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('💥 Excepción no capturada:', error);
  process.exit(1);
});

iniciarMonitor().catch(error => {
  logger.error('💥 Error fatal al iniciar monitor:', error);
  process.exit(1);
});