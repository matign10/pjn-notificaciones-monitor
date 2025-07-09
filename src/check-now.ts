/**
 * Script para ejecutar una verificación inmediata
 * Usado por GitHub Actions y para pruebas manuales
 */

import { PJNMonitor } from './monitor/pjn-monitor';
import { config, logger } from './config';
import dayjs from 'dayjs';

async function ejecutarVerificacion() {
  let monitor: PJNMonitor | null = null;

  try {
    console.log(`
╔════════════════════════════════════════╗
║     PJN - VERIFICACIÓN MANUAL          ║
║     ${dayjs().format('DD/MM/YYYY HH:mm:ss')}          ║
╚════════════════════════════════════════╝
    `);

    // Crear instancia del monitor
    logger.info('Inicializando monitor para verificación única...');
    monitor = new PJNMonitor({
      enableTelegramNotifications: true
    });

    // Inicializar
    await monitor.initialize();

    // Ejecutar verificación
    logger.info('Ejecutando verificación...');
    const resultado = await monitor.ejecutarVerificacion();

    // Mostrar resultados
    console.log(`
📊 RESULTADOS DE LA VERIFICACIÓN

${resultado.success ? '✅' : '❌'} Estado: ${resultado.success ? 'EXITOSA' : 'ERROR'}
⏱️  Duración: ${resultado.duracion}ms
📋 Expedientes encontrados: ${resultado.expedientesEncontrados}
🆕 Nuevas notificaciones: ${resultado.nuevasNotificaciones}
📱 Notificaciones enviadas: ${resultado.notificacionesEnviadas}
    `);

    if (resultado.errores.length > 0) {
      console.log('❌ ERRORES ENCONTRADOS:');
      resultado.errores.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    // En GitHub Actions, salir con código apropiado
    process.exit(resultado.success ? 0 : 1);

  } catch (error) {
    logger.error('Error fatal durante verificación:', error);
    console.error('💥 ERROR FATAL:', error);
    process.exit(1);
  }
}

// Ejecutar
ejecutarVerificacion();