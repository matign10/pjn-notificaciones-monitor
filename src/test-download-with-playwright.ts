import { chromium } from 'playwright';
import { logger } from './config';
import fs from 'fs/promises';
import path from 'path';

/**
 * Prueba directa de descarga con Playwright
 */
async function testDownloadWithPlaywright() {
  logger.info('🚀 Probando descarga directa con Playwright...');
  
  const browser = await chromium.launch({
    headless: false,
    downloadsPath: path.join(process.cwd(), 'data', 'downloads')
  });
  
  try {
    const context = await browser.newContext({
      acceptDownloads: true
    });
    
    const page = await context.newPage();
    
    // Cargar cookies guardadas
    const cookiesPath = path.join(process.cwd(), 'data', 'cookies', 'pjn-cookies.json');
    try {
      const cookiesData = await fs.readFile(cookiesPath, 'utf-8');
      const cookies = JSON.parse(cookiesData);
      await context.addCookies(cookies);
      logger.info('Cookies cargadas');
    } catch (error) {
      logger.warn('No se pudieron cargar cookies');
    }
    
    // Navegar directamente a notificaciones
    logger.info('Navegando a notificaciones...');
    await page.goto('https://notif.pjn.gov.ar/recibidas', { waitUntil: 'networkidle' });
    
    // Esperar a que la página cargue
    await page.waitForTimeout(3000);
    
    // Buscar el primer botón de PDF
    const botonPDF = await page.locator('button[aria-label*="Ver PDF"]').first();
    
    if (await botonPDF.isVisible()) {
      logger.info('✅ Botón PDF encontrado');
      
      // Configurar manejo de descargas
      const downloadPromise = page.waitForEvent('download');
      
      // Configurar interceptación de popups
      context.on('page', async (newPage) => {
        logger.info(`🆕 Nueva página/popup detectada: ${newPage.url()}`);
        
        // Esperar a que cargue
        await newPage.waitForLoadState('domcontentloaded').catch(() => {});
        
        // Log de información
        const url = newPage.url();
        logger.info(`  URL final: ${url}`);
        
        // Si la URL contiene PDF o blob, intentar manejarla
        if (url.includes('.pdf') || url.includes('blob:')) {
          logger.info('  🎯 URL de PDF detectada');
          
          // Opción 1: Intentar forzar descarga con JavaScript
          try {
            await newPage.evaluate(() => {
              const link = document.createElement('a');
              link.href = window.location.href;
              link.download = 'notificacion.pdf';
              link.click();
            });
            logger.info('  ✅ Descarga forzada con JS');
          } catch (error) {
            logger.error('  Error forzando descarga:', error);
          }
          
          // Opción 2: Si hay un botón de descarga, hacer clic
          const downloadButton = await newPage.locator('button[aria-label*="download"], button[aria-label*="descargar"], [id*="download"]').first();
          if (await downloadButton.isVisible()) {
            await downloadButton.click();
            logger.info('  ✅ Clic en botón de descarga');
          }
        }
        
        // Buscar elementos específicos del visor de PDF
        const viewerInfo = {
          pdfViewer: await newPage.locator('#viewer, .pdfViewer').count(),
          pdfjs: await newPage.locator('[id*="pdfjs"]').count(),
          embed: await newPage.locator('embed[type="application/pdf"]').count(),
          object: await newPage.locator('object[type="application/pdf"]').count(),
          iframe: await newPage.locator('iframe').count()
        };
        
        logger.info('  Elementos del visor:', viewerInfo);
        
        // Si hay un embed, obtener su src
        if (viewerInfo.embed > 0) {
          const embedElement = await newPage.locator('embed[type="application/pdf"]').first();
          const src = await embedElement.getAttribute('src');
          logger.info(`  Embed src: ${src}`);
          
          // Si el src no es blob, intentar descargarlo
          if (src && !src.startsWith('blob:')) {
            try {
              // Crear enlace de descarga
              await newPage.evaluate((src) => {
                const link = document.createElement('a');
                link.href = src;
                link.download = 'notificacion_embed.pdf';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }, src);
              logger.info('  ✅ Descarga iniciada desde embed');
            } catch (error) {
              logger.error('  Error descargando desde embed:', error);
            }
          }
        }
      });
      
      // Hacer clic en el botón
      logger.info('🖱️ Haciendo clic en "Ver PDF"...');
      await botonPDF.click();
      
      // Esperar por descarga o nueva página
      try {
        const download = await Promise.race([
          downloadPromise,
          page.waitForTimeout(10000).then(() => null)
        ]);
        
        if (download) {
          const fileName = download.suggestedFilename();
          const filePath = path.join(process.cwd(), 'data', 'downloads', fileName);
          await download.saveAs(filePath);
          logger.info(`✅ Archivo descargado: ${filePath}`);
          
          // Verificar el archivo
          const stats = await fs.stat(filePath);
          logger.info(`📄 Tamaño del archivo: ${stats.size} bytes`);
        } else {
          logger.warn('⚠️ No se detectó descarga automática');
        }
      } catch (error) {
        logger.error('Error esperando descarga:', error);
      }
      
      // Esperar un poco más para ver qué pasa
      await page.waitForTimeout(5000);
      
      // Revisar todas las páginas abiertas
      const pages = context.pages();
      logger.info(`\n📊 Páginas abiertas: ${pages.length}`);
      for (const p of pages) {
        logger.info(`  - ${p.url()}`);
      }
    } else {
      logger.error('❌ No se encontró botón de PDF');
    }
    
  } catch (error) {
    logger.error('💥 Error:', error);
  } finally {
    await browser.close();
  }
}

testDownloadWithPlaywright().catch(error => {
  logger.error('💥 Error fatal:', error);
  process.exit(1);
});