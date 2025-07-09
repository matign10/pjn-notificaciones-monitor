import { PJNDatabase } from './database/database';
import { logger } from './config';

/**
 * Script para resetear la base de datos y probar notificaciones
 * Esto hará que las notificaciones actuales se detecten como "nuevas"
 */
async function resetearBaseDatos() {
  logger.info('🗑️ Reseteando base de datos para testing...');
  
  const db = new PJNDatabase();
  
  try {
    await db.initialize();
    
    // Obtener estadísticas actuales
    const estadisticasAntes = await db.getEstadisticas();
    logger.info(`📊 Estado antes del reset:`);
    logger.info(`  - Total expedientes: ${estadisticasAntes.totalExpedientes}`);
    logger.info(`  - Con notificaciones: ${estadisticasAntes.expedientesConNotificaciones}`);
    logger.info(`  - Pendientes: ${estadisticasAntes.notificacionesPendientes}`);
    logger.info(`  - Enviadas: ${estadisticasAntes.notificacionesEnviadas}`);
    
    // Limpiar todas las tablas
    await db.resetForTesting();
    
    // Verificar el reset
    const estadisticasDespues = await db.getEstadisticas();
    logger.info(`📊 Estado después del reset:`);
    logger.info(`  - Total expedientes: ${estadisticasDespues.totalExpedientes}`);
    logger.info(`  - Con notificaciones: ${estadisticasDespues.expedientesConNotificaciones}`);
    
    logger.info('');
    logger.info('🎯 LISTO PARA PROBAR:');
    logger.info('1. Ejecuta: npm run monitor');
    logger.info('2. El sistema detectará las notificaciones actuales como "nuevas"');
    logger.info('3. Te enviará mensajes por Telegram con cada notificación');
    logger.info('4. Así podrás probar el sistema completo');
    
  } catch (error) {
    logger.error('💥 Error reseteando base de datos:', error);
  } finally {
    await db.close();
  }
}

resetearBaseDatos().catch(error => {
  logger.error('💥 Error fatal:', error);
  process.exit(1);
});