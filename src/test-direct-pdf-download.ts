import { NotificationScraper } from './scraper/notification-scraper';
import { logger } from './config';
import fs from 'fs/promises';
import path from 'path';

/**
 * Script para probar descarga directa de PDF con autenticación
 */
async function probarDescargaDirectaPDF() {
  logger.info('🚀 Probando descarga directa de PDF con autenticación...');
  
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
    
    logger.info('📋 Buscando primera notificación...');
    
    // Encontrar el primer botón PDF
    const botonPDF = await page.locator('button[aria-label*="Ver PDF"]').first();
    
    if (await botonPDF.isVisible()) {
      logger.info('✅ Botón PDF encontrado');
      
      // Interceptar la respuesta del PDF
      let pdfUrl = '';
      let pdfData: Buffer | null = null;
      
      page.on('response', async (response) => {
        if (response.url().includes('/pdf') && response.headers()['content-type']?.includes('application/pdf')) {
          pdfUrl = response.url();
          logger.info(`📥 Interceptando PDF: ${pdfUrl}`);
          try {
            pdfData = await response.body();
            logger.info(`✅ PDF capturado: ${pdfData.length} bytes`);
          } catch (error) {
            logger.error('Error capturando body del PDF:', error);
          }
        }
      });
      
      // Hacer clic en el botón
      await botonPDF.click();
      
      // Esperar un poco para que se complete la descarga
      await page.waitForTimeout(3000);
      
      if (pdfData && pdfData.length > 1000) {
        // Guardar el PDF
        const pdfPath = path.join('data', 'pdfs', `test_direct_download_${Date.now()}.pdf`);
        await fs.mkdir(path.dirname(pdfPath), { recursive: true });
        await fs.writeFile(pdfPath, pdfData);
        logger.info(`✅ PDF guardado exitosamente: ${pdfPath} (${pdfData.length} bytes)`);
        
        // Verificar que es un PDF válido
        const header = pdfData.slice(0, 4).toString();
        logger.info(`📄 Header del archivo: ${header} (debería ser %PDF)`);
      } else {
        logger.warn('❌ No se pudo capturar el PDF correctamente');
        
        // Intentar descargar directamente usando el contexto autenticado
        if (pdfUrl) {
          logger.info('🔄 Intentando descarga directa con contexto autenticado...');
          const response = await page.context().request.get(pdfUrl);
          const pdfBuffer = await response.body();
          
          if (pdfBuffer.length > 1000) {
            const pdfPath = path.join('data', 'pdfs', `test_direct_context_${Date.now()}.pdf`);
            await fs.writeFile(pdfPath, pdfBuffer);
            logger.info(`✅ PDF descargado con contexto: ${pdfPath} (${pdfBuffer.length} bytes)`);
          }
        }
      }
      
      // Cerrar cualquier pestaña nueva que se haya abierto
      const pages = page.context().pages();
      if (pages.length > 1) {
        await pages[pages.length - 1].close();
      }
    }
    
  } catch (error) {
    logger.error('💥 Error durante la prueba:', error);
  } finally {
    await scraper.cleanup();
  }
}

probarDescargaDirectaPDF().catch(error => {
  logger.error('💥 Error fatal:', error);
  process.exit(1);
});