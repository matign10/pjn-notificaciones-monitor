import { NotificationScraper } from './scraper/notification-scraper';
import { TelegramBot } from './telegram/telegram-bot';
import { logger } from './config';

/**
 * Script para probar el envío completo de Telegram con PDF
 */
async function probarTelegramConPDF() {
  logger.info('🚀 Probando envío de notificación por Telegram con PDF...');
  
  const scraper = new NotificationScraper();
  const telegramBot = new TelegramBot();
  
  try {
    // Inicializar componentes
    await scraper.initialize();
    await telegramBot.initialize();
    
    // Obtener notificaciones
    logger.info('📋 Obteniendo notificaciones...');
    const resultado = await scraper.ejecutarScraping();
    
    if (resultado.expedientesEncontrados.length === 0) {
      logger.warn('❌ No se encontraron notificaciones para enviar');
      return;
    }
    
    // Tomar la primera notificación como prueba
    const notificacionPrueba = resultado.expedientesEncontrados[0];
    logger.info(`🎯 Enviando notificación de prueba: ${notificacionPrueba.numero}`);
    logger.info(`📝 Carátula: ${notificacionPrueba.caratula}`);
    
    // Descargar PDF si hay enlace
    let rutaPDF: string | null = null;
    if (notificacionPrueba.enlacePDF) {
      logger.info('📥 Descargando PDF de la notificación...');
      rutaPDF = await scraper.descargarPDFNotificacion(notificacionPrueba);
      
      if (rutaPDF) {
        logger.info(`✅ PDF descargado: ${rutaPDF}`);
      } else {
        logger.warn('⚠️ No se pudo descargar el PDF, se enviará sin adjunto');
      }
    } else {
      logger.info('ℹ️ No hay enlace PDF para esta notificación');
    }
    
    // Preparar el mensaje de notificación
    const notificacion = {
      expediente: notificacionPrueba.numero,
      caratula: notificacionPrueba.caratula,
      fecha: new Date(),
      mensaje: 'Esta es una notificación de prueba enviada desde el sistema automatizado de monitoreo PJN.'
    };
    
    // Enviar notificación por Telegram
    logger.info('📨 Enviando mensaje por Telegram...');
    
    if (rutaPDF) {
      // Enviar con PDF adjunto
      await telegramBot.enviarNotificacionConPDF(notificacion, rutaPDF);
      logger.info('✅ Notificación enviada por Telegram CON PDF adjunto');
    } else {
      // Enviar solo el mensaje
      await telegramBot.enviarNotificacion(notificacion);
      logger.info('✅ Notificación enviada por Telegram SIN PDF adjunto');
    }
    
    logger.info('🎉 ¡Prueba completada exitosamente!');
    logger.info('');
    logger.info('=== RESUMEN DE LA PRUEBA ===');
    logger.info(`📧 Notificación: ${notificacion.expediente}`);
    logger.info(`📄 PDF adjunto: ${rutaPDF ? 'SÍ' : 'NO'}`);
    logger.info(`📱 Telegram: ENVIADO`);
    
  } catch (error) {
    logger.error('💥 Error durante la prueba:', error);
  } finally {
    await scraper.cleanup();
  }
}

probarTelegramConPDF().catch(error => {
  logger.error('💥 Error fatal:', error);
  process.exit(1);
});