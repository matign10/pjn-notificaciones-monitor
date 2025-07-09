import { NotificationScraper } from './scraper/notification-scraper';
import { logger } from './config';
import fs from 'fs/promises';
import path from 'path';

/**
 * Script para debuggear la descarga de PDFs paso a paso
 */
async function debugPDFDownload() {
  logger.info('🔍 Debuggeando descarga de PDF paso a paso...');
  
  const scraper = new NotificationScraper();
  
  try {
    await scraper.initialize();
    
    const auth = (scraper as any).auth;
    const browser = (auth as any).browser;
    const page = await auth.getAuthenticatedPage();
    
    if (!page) {
      throw new Error('No se pudo obtener página autenticada');
    }
    
    // Configurar descarga de archivos
    const downloadPath = path.join(process.cwd(), 'data', 'downloads');
    await fs.mkdir(downloadPath, { recursive: true });
    
    // Navegar a notificaciones
    await page.goto('https://notif.pjn.gov.ar/recibidas');
    await page.waitForLoadState('networkidle');
    
    logger.info('📋 Buscando botón "Ver PDF"...');
    
    // Encontrar el primer botón
    const botonPDF = await page.locator('button[aria-label*="Ver PDF"]').first();
    
    if (await botonPDF.isVisible()) {
      logger.info('✅ Botón encontrado');
      
      // Configurar listeners antes de hacer clic
      const context = page.context();
      
      // Escuchar por nuevas páginas
      context.on('page', async (newPage) => {
        logger.info(`📄 Nueva página abierta: ${newPage.url()}`);
        
        // Esperar a que cargue
        await newPage.waitForLoadState('domcontentloaded');
        
        // Analizar la nueva página
        const url = newPage.url();
        const title = await newPage.title();
        const content = await newPage.content();
        
        logger.info(`  URL: ${url}`);
        logger.info(`  Título: ${title}`);
        logger.info(`  Tamaño HTML: ${content.length} bytes`);
        
        // Buscar elementos PDF
        const pdfElements = {
          embed: await newPage.locator('embed').count(),
          object: await newPage.locator('object').count(),
          iframe: await newPage.locator('iframe').count(),
          canvas: await newPage.locator('canvas').count()
        };
        
        logger.info('  Elementos encontrados:', pdfElements);
        
        // Si hay embed o object, obtener su src
        if (pdfElements.embed > 0) {
          const embedSrc = await newPage.locator('embed').first().getAttribute('src');
          logger.info(`  Embed src: ${embedSrc}`);
          
          if (embedSrc && !embedSrc.startsWith('blob:')) {
            // Intentar descargar directamente
            try {
              const response = await context.request.get(embedSrc);
              const buffer = await response.body();
              const pdfPath = path.join(downloadPath, `embed_${Date.now()}.pdf`);
              await fs.writeFile(pdfPath, buffer);
              logger.info(`✅ PDF descargado desde embed: ${pdfPath} (${buffer.length} bytes)`);
            } catch (error) {
              logger.error('Error descargando desde embed:', error);
            }
          }
        }
        
        if (pdfElements.object > 0) {
          const objectData = await newPage.locator('object').first().getAttribute('data');
          logger.info(`  Object data: ${objectData}`);
        }
        
        // Interceptar requests en la nueva página
        newPage.on('request', request => {
          const url = request.url();
          if (url.includes('pdf') || url.includes('blob')) {
            logger.info(`  📥 Request: ${request.method()} ${url}`);
          }
        });
        
        newPage.on('response', async response => {
          const url = response.url();
          const contentType = response.headers()['content-type'] || '';
          
          if (contentType.includes('pdf') || url.includes('pdf')) {
            logger.info(`  📤 Response PDF: ${response.status()} ${url}`);
            logger.info(`    Content-Type: ${contentType}`);
            logger.info(`    Content-Length: ${response.headers()['content-length']}`);
            
            // Intentar descargar
            try {
              const buffer = await response.body();
              const pdfPath = path.join(downloadPath, `response_${Date.now()}.pdf`);
              await fs.writeFile(pdfPath, buffer);
              logger.info(`  ✅ PDF guardado: ${pdfPath} (${buffer.length} bytes)`);
            } catch (error) {
              logger.error('  Error guardando PDF:', error);
            }
          }
        });
        
        // Esperar un poco para capturar más información
        await newPage.waitForTimeout(5000);
        
        // Intentar encontrar el viewer de PDF
        const viewers = [
          'pdf-viewer',
          'viewer',
          '#viewer',
          '.pdf-viewer',
          '[id*="pdfjs"]',
          '[class*="pdf"]'
        ];
        
        for (const selector of viewers) {
          const viewer = await newPage.locator(selector).first();
          if (await viewer.isVisible()) {
            logger.info(`  Viewer encontrado: ${selector}`);
            break;
          }
        }
        
        // Guardar screenshot
        const screenshotPath = path.join(downloadPath, `pdf_page_${Date.now()}.png`);
        await newPage.screenshot({ path: screenshotPath, fullPage: true });
        logger.info(`  📸 Screenshot guardado: ${screenshotPath}`);
      });
      
      // Escuchar descargas
      page.on('download', async download => {
        logger.info('📥 Descarga detectada!');
        const suggestedFilename = download.suggestedFilename();
        const downloadPath = path.join(downloadPath, suggestedFilename);
        await download.saveAs(downloadPath);
        logger.info(`✅ Archivo descargado: ${downloadPath}`);
      });
      
      // Hacer clic en el botón
      logger.info('🖱️ Haciendo clic en el botón...');
      await botonPDF.click();
      
      // Esperar para capturar toda la actividad
      await page.waitForTimeout(10000);
      
      // Listar todas las páginas abiertas
      const pages = context.pages();
      logger.info(`\n📊 Total de páginas abiertas: ${pages.length}`);
      for (let i = 0; i < pages.length; i++) {
        logger.info(`  Página ${i}: ${pages[i].url()}`);
      }
    }
    
  } catch (error) {
    logger.error('💥 Error durante el debug:', error);
  } finally {
    await scraper.cleanup();
  }
}

debugPDFDownload().catch(error => {
  logger.error('💥 Error fatal:', error);
  process.exit(1);
});