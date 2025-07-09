import { NotificationScraper } from './scraper/notification-scraper';
import { logger } from './config';
import { chromium } from 'playwright';

/**
 * Script para debuggear y capturar el contenido real de las notificaciones
 */
async function debugNotificationContent() {
  logger.info('🔍 Debuggeando contenido de notificaciones...');
  
  const scraper = new NotificationScraper();
  
  try {
    // Inicializar
    await scraper.initialize();
    
    // Obtener página autenticada
    const auth = (scraper as any).auth;
    const page = await auth.getAuthenticatedPage();
    
    if (!page) {
      throw new Error('No se pudo obtener página autenticada');
    }
    
    // Navegar a notificaciones
    await page.goto('https://notif.pjn.gov.ar/recibidas');
    await page.waitForLoadState('networkidle');
    
    logger.info('📋 Analizando estructura de la página de notificaciones...');
    
    // Buscar la primera fila de notificación
    const primeraFila = await page.locator('tbody tr').first();
    if (await primeraFila.isVisible()) {
      // Obtener el número de expediente
      const numero = await primeraFila.locator('td').first().textContent();
      logger.info(`📄 Primera notificación encontrada: ${numero}`);
      
      // Buscar el botón de ver PDF
      const botonPDF = await primeraFila.locator('button[aria-label*="Ver PDF"]').first();
      if (await botonPDF.isVisible()) {
        logger.info('✅ Botón PDF encontrado');
        
        // Intentar hacer clic en la fila para expandir detalles
        logger.info('🖱️ Haciendo clic en la fila para ver si expande detalles...');
        await primeraFila.click();
        await page.waitForTimeout(2000);
        
        // Buscar contenido expandido
        const contenidoExpandido = await page.locator('[role="rowgroup"]').all();
        logger.info(`📊 Elementos expandidos encontrados: ${contenidoExpandido.length}`);
        
        // Buscar modales o diálogos
        const modales = await page.locator('[role="dialog"], .modal, .MuiDialog-root').all();
        logger.info(`📊 Modales encontrados: ${modales.length}`);
        
        // Capturar screenshot de la página actual
        await page.screenshot({ path: 'notificacion-expandida.png', fullPage: true });
        logger.info('📸 Screenshot guardado: notificacion-expandida.png');
        
        // Ahora intentar abrir el PDF en la misma pestaña
        logger.info('🔄 Intentando abrir PDF en la misma pestaña...');
        
        // Interceptar navegación
        let pdfUrl = '';
        page.on('request', request => {
          if (request.url().includes('pdf')) {
            pdfUrl = request.url();
            logger.info(`🔗 Request PDF detectado: ${pdfUrl}`);
          }
        });
        
        // Intentar Ctrl+Click para abrir en la misma pestaña
        await botonPDF.click({ modifiers: ['Control'] });
        await page.waitForTimeout(3000);
        
        logger.info(`📍 URL actual después del clic: ${page.url()}`);
        
        // Si la URL cambió, volver atrás
        if (page.url() !== 'https://notif.pjn.gov.ar/recibidas') {
          await page.goBack();
          await page.waitForLoadState('networkidle');
        }
      }
    }
    
    // Buscar si hay algún iframe oculto
    const iframes = await page.locator('iframe').all();
    logger.info(`🔍 iframes encontrados: ${iframes.length}`);
    
    for (let i = 0; i < iframes.length; i++) {
      const src = await iframes[i].getAttribute('src');
      logger.info(`  - iframe ${i}: ${src}`);
    }
    
  } catch (error) {
    logger.error('💥 Error durante el debug:', error);
  } finally {
    await scraper.cleanup();
  }
}

debugNotificationContent().catch(error => {
  logger.error('💥 Error fatal:', error);
  process.exit(1);
});