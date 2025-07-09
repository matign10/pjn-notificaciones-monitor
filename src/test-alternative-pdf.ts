import { NotificationScraper } from './scraper/notification-scraper';
import { logger } from './config';
import fs from 'fs/promises';
import path from 'path';

/**
 * Script para probar captura alternativa de PDFs
 */
async function probarCapturaPDFAlternativa() {
  logger.info('🚀 Probando captura alternativa de PDF...');
  
  const scraper = new NotificationScraper();
  
  try {
    // Inicializar
    await scraper.initialize();
    
    // Obtener notificaciones
    logger.info('📋 Obteniendo notificaciones...');
    const resultado = await scraper.ejecutarScraping();
    
    if (resultado.expedientesEncontrados.length === 0) {
      logger.warn('❌ No se encontraron notificaciones');
      return;
    }
    
    // Tomar la primera notificación
    const notificacion = resultado.expedientesEncontrados[0];
    logger.info(`🎯 Procesando notificación: ${notificacion.numero}`);
    
    // Obtener página autenticada
    const auth = (scraper as any).auth;
    const page = await auth.getAuthenticatedPage();
    
    if (!page) {
      throw new Error('No se pudo obtener página autenticada');
    }
    
    // Volver a la página de notificaciones
    await page.goto('https://notif.pjn.gov.ar/recibidas');
    await page.waitForLoadState('networkidle');
    
    // Buscar la fila de la notificación específica
    const filaNotificacion = await page.locator(`tr:has-text("${notificacion.numero}")`).first();
    
    if (await filaNotificacion.isVisible()) {
      logger.info('✅ Fila de notificación encontrada');
      
      // Opción 1: Capturar el contenido visible de la fila y generar PDF
      logger.info('📸 Capturando contenido visible de la notificación...');
      
      // Expandir la fila si es posible
      await filaNotificacion.click();
      await page.waitForTimeout(2000);
      
      // Tomar screenshot de la página completa
      const screenshotPath = path.join('data', 'screenshots', `notificacion_${notificacion.numero.replace(/\//g, '_')}_full.png`);
      await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: true });
      logger.info(`📸 Screenshot completo guardado: ${screenshotPath}`);
      
      // Generar PDF del contenido visible
      const pdfPath = path.join('data', 'pdfs', `notificacion_${notificacion.numero.replace(/\//g, '_')}_contenido.pdf`);
      await page.pdf({ 
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });
      logger.info(`📄 PDF del contenido visible generado: ${pdfPath}`);
      
      // Opción 2: Buscar el botón PDF y analizar su comportamiento
      const botonPDF = await filaNotificacion.locator('button[aria-label*="Ver PDF"]').first();
      if (await botonPDF.isVisible()) {
        logger.info('🔍 Analizando comportamiento del botón PDF...');
        
        // Obtener información del botón
        const onclick = await botonPDF.getAttribute('onclick');
        const dataAttrs = await botonPDF.evaluate(el => {
          const attrs: any = {};
          for (const attr of el.attributes) {
            if (attr.name.startsWith('data-')) {
              attrs[attr.name] = attr.value;
            }
          }
          return attrs;
        });
        
        logger.info(`  - onclick: ${onclick}`);
        logger.info(`  - data attributes:`, dataAttrs);
        
        // Interceptar llamadas de red
        const requests: string[] = [];
        page.on('request', request => {
          if (request.url().includes('pdf') || request.url().includes('notificacion')) {
            requests.push(`${request.method()} ${request.url()}`);
          }
        });
        
        page.on('response', response => {
          if (response.url().includes('pdf') || response.url().includes('notificacion')) {
            logger.info(`📥 Response: ${response.status()} ${response.url()}`);
            logger.info(`   Content-Type: ${response.headers()['content-type']}`);
          }
        });
        
        // Hacer clic y esperar
        await botonPDF.click();
        await page.waitForTimeout(5000);
        
        logger.info('📊 Requests capturados:');
        requests.forEach(req => logger.info(`  - ${req}`));
        
        // Verificar si se abrió algún modal o diálogo
        const dialogos = await page.locator('[role="dialog"], .modal, [aria-modal="true"]').all();
        logger.info(`📊 Diálogos encontrados después del clic: ${dialogos.length}`);
        
        if (dialogos.length > 0) {
          logger.info('📸 Capturando contenido del diálogo...');
          const dialogScreenshot = path.join('data', 'screenshots', `dialog_${notificacion.numero.replace(/\//g, '_')}.png`);
          await page.screenshot({ path: dialogScreenshot, fullPage: true });
          logger.info(`📸 Screenshot del diálogo guardado: ${dialogScreenshot}`);
        }
      }
    }
    
  } catch (error) {
    logger.error('💥 Error durante la prueba:', error);
  } finally {
    await scraper.cleanup();
  }
}

probarCapturaPDFAlternativa().catch(error => {
  logger.error('💥 Error fatal:', error);
  process.exit(1);
});