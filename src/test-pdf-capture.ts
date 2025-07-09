import { NotificationScraper } from './scraper/notification-scraper';
import { logger } from './config';

/**
 * Script para probar la captura de PDFs desde los enlaces de notificaciones
 */
async function probarCapturaPDFs() {
  logger.info('🔍 Probando captura de PDFs desde notificaciones...');
  
  const scraper = new NotificationScraper();
  
  try {
    // Inicializar el scraper
    await scraper.initialize();
    
    // Ejecutar scraping para obtener notificaciones con enlaces PDF
    logger.info('📋 Ejecutando scraping para obtener notificaciones...');
    const resultado = await scraper.ejecutarScraping();
    
    logger.info('=== RESULTADO DEL SCRAPING ===');
    logger.info(`Expedientes encontrados: ${resultado.expedientesEncontrados.length}`);
    logger.info(`Nuevas notificaciones: ${resultado.nuevasNotificaciones.length}`);
    
    // Buscar notificaciones con enlaces PDF
    const notificacionesConPDF = resultado.expedientesEncontrados.filter(exp => exp.enlacePDF);
    logger.info(`Notificaciones con enlace PDF: ${notificacionesConPDF.length}`);
    
    if (notificacionesConPDF.length === 0) {
      logger.warn('No se encontraron notificaciones con enlaces PDF');
      return;
    }
    
    // Probar descarga de PDF con la primera notificación encontrada
    const primeraNotificacion = notificacionesConPDF[0];
    logger.info(`\n🎯 Probando descarga de PDF para: ${primeraNotificacion.numero}`);
    logger.info(`Enlace PDF: ${primeraNotificacion.enlacePDF}`);
    
    const rutaPDF = await scraper.descargarPDFNotificacion(primeraNotificacion);
    
    if (rutaPDF) {
      logger.info(`✅ PDF descargado exitosamente: ${rutaPDF}`);
      
      // Verificar que el archivo existe
      const fs = await import('fs/promises');
      const stats = await fs.stat(rutaPDF);
      logger.info(`📊 Tamaño del archivo: ${stats.size} bytes`);
      logger.info(`📅 Fecha de creación: ${stats.birthtime}`);
      
      if (stats.size > 0) {
        logger.info('🎉 ¡PDF descargado correctamente!');
      } else {
        logger.error('❌ El archivo PDF está vacío');
      }
    } else {
      logger.error('❌ Error al descargar PDF');
    }
    
    // Mostrar todas las notificaciones con sus enlaces
    logger.info('\n=== TODAS LAS NOTIFICACIONES CON ENLACES PDF ===');
    notificacionesConPDF.forEach((notif, index) => {
      logger.info(`${index + 1}. ${notif.numero}`);
      logger.info(`   Carátula: ${notif.caratula.substring(0, 80)}...`);
      logger.info(`   Enlace PDF: ${notif.enlacePDF}`);
      logger.info('');
    });
    
    logger.info('\n=== RESUMEN ===');
    logger.info(`Total notificaciones: ${resultado.expedientesEncontrados.length}`);
    logger.info(`Con enlaces PDF: ${notificacionesConPDF.length}`);
    logger.info(`Tasa de éxito: ${Math.round((notificacionesConPDF.length / resultado.expedientesEncontrados.length) * 100)}%`);
    
  } catch (error) {
    logger.error('💥 Error durante la prueba:', error);
  } finally {
    await scraper.cleanup();
  }
}

probarCapturaPDFs().catch(error => {
  logger.error('💥 Error fatal:', error);
  process.exit(1);
});