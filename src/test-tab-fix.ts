import { NotificationScraper } from './scraper/notification-scraper';
import { logger } from './config';

/**
 * Script para probar la corrección del problema de pestañas
 * Verifica que el sistema lee correctamente de la página de notificaciones
 */
async function probarCorreccionPestanas() {
  logger.info('🔍 Probando corrección de pestañas...');
  
  const scraper = new NotificationScraper();
  
  try {
    // Inicializar el scraper
    await scraper.initialize();
    
    // Ejecutar scraping
    logger.info('📋 Ejecutando scraping...');
    const resultado = await scraper.ejecutarScraping();
    
    logger.info('=== RESULTADO DEL SCRAPING ===');
    logger.info(`Expedientes encontrados: ${resultado.expedientesEncontrados.length}`);
    logger.info(`Nuevas notificaciones: ${resultado.nuevasNotificaciones.length}`);
    logger.info(`Errores: ${resultado.errores.length}`);
    
    if (resultado.errores.length > 0) {
      logger.error('Errores encontrados:');
      resultado.errores.forEach((error, index) => {
        logger.error(`${index + 1}. ${error}`);
      });
    }
    
    logger.info('\\n=== EXPEDIENTES DETECTADOS ===');
    resultado.expedientesEncontrados.forEach((exp, index) => {
      logger.info(`${index + 1}. ${exp.numero} - ${exp.caratula}`);
      logger.info(`   Tiene notificación: ${exp.tieneNotificacion ? '✅' : '❌'}`);
      if (exp.elementoNotificacion) {
        logger.info(`   Elemento detector: ${exp.elementoNotificacion}`);
      }
    });
    
    if (resultado.nuevasNotificaciones.length > 0) {
      logger.info('\\n=== NUEVAS NOTIFICACIONES ===');
      resultado.nuevasNotificaciones.forEach((notif, index) => {
        logger.info(`${index + 1}. ${notif.numero} - ${notif.caratula}`);
      });
    }
    
    // Obtener estadísticas finales
    const estadisticas = await scraper.getEstadisticas();
    logger.info('\\n=== ESTADÍSTICAS ===');
    logger.info(`Total expedientes: ${estadisticas.totalExpedientes}`);
    logger.info(`Con notificaciones: ${estadisticas.expedientesConNotificaciones}`);
    logger.info(`Pendientes: ${estadisticas.notificacionesPendientes}`);
    logger.info(`Enviadas: ${estadisticas.notificacionesEnviadas}`);
    
    // Verificar que los datos son de notificaciones reales
    logger.info('\\n=== VERIFICACIÓN DE DATOS ===');
    const notificacionesReales = [
      'Ferias',
      'La Salada'
    ];
    
    const tieneNotificacionesReales = resultado.expedientesEncontrados.some(exp => 
      notificacionesReales.some(real => 
        exp.caratula.toLowerCase().includes(real.toLowerCase())
      )
    );
    
    if (tieneNotificacionesReales) {
      logger.info('✅ ÉXITO: Se detectaron notificaciones reales mencionadas por el usuario');
    } else {
      logger.warn('⚠️ ADVERTENCIA: No se detectaron las notificaciones reales mencionadas por el usuario');
      logger.warn('   Esto podría indicar que aún se está leyendo la página incorrecta');
    }
    
    // Verificar que NO se detecten elementos de "Entradas"
    const tieneElementosEntradas = resultado.expedientesEncontrados.some(exp => 
      exp.caratula.toLowerCase().includes('garcia, fernando') ||
      exp.caratula.toLowerCase().includes('gonzalez, milagros')
    );
    
    if (tieneElementosEntradas) {
      logger.error('❌ ERROR: Se detectaron elementos de la página "Entradas"');
      logger.error('   Esto confirma que el sistema sigue leyendo la página incorrecta');
    } else {
      logger.info('✅ CORRECTO: No se detectaron elementos de la página "Entradas"');
    }
    
  } catch (error) {
    logger.error('💥 Error durante la prueba:', error);
  } finally {
    await scraper.cleanup();
  }
}

probarCorreccionPestanas().catch(error => {
  logger.error('💥 Error fatal:', error);
  process.exit(1);
});