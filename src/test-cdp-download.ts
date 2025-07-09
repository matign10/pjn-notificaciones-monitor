import { NotificationScraper } from './scraper/notification-scraper';
import { logger } from './config';
import fs from 'fs/promises';
import path from 'path';

/**
 * Prueba usando Chrome DevTools Protocol para interceptar descargas
 */
async function testCDPDownload() {
  logger.info('🚀 Probando descarga con CDP...');
  
  const scraper = new NotificationScraper();
  
  try {
    await scraper.initialize();
    
    const auth = (scraper as any).auth;
    const browser = (auth as any).browser;
    const page = await auth.getAuthenticatedPage();
    
    if (!page) {
      throw new Error('No se pudo obtener página autenticada');
    }
    
    // Obtener el cliente CDP
    const client = await page.context().newCDPSession(page);
    
    // Configurar directorio de descargas
    const downloadPath = path.join(process.cwd(), 'data', 'downloads');
    await fs.mkdir(downloadPath, { recursive: true });
    
    // Habilitar descarga de archivos
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadPath
    });
    
    // Habilitar interceptación de red
    await client.send('Fetch.enable', {
      patterns: [
        { urlPattern: '*', requestStage: 'Response' }
      ]
    });
    
    // Interceptar respuestas
    client.on('Fetch.requestPaused', async (params) => {
      const { requestId, responseHeaders, resourceType } = params;
      
      // Log de todas las respuestas
      if (params.responseStatusCode) {
        const url = params.request.url;
        logger.info(`📥 Response interceptada: ${url}`);
        
        // Si es un PDF, intentar guardarlo
        const contentType = responseHeaders?.find(h => h.name.toLowerCase() === 'content-type')?.value || '';
        if (contentType.includes('application/pdf') || url.includes('.pdf')) {
          logger.info('🎯 PDF detectado!');
          
          try {
            // Obtener el body de la respuesta
            const response = await client.send('Fetch.getResponseBody', { requestId });
            
            // Decodificar según el encoding
            let data: Buffer;
            if (response.base64Encoded) {
              data = Buffer.from(response.body, 'base64');
            } else {
              data = Buffer.from(response.body);
            }
            
            // Guardar el archivo
            const fileName = `cdp_pdf_${Date.now()}.pdf`;
            const filePath = path.join(downloadPath, fileName);
            await fs.writeFile(filePath, data);
            
            logger.info(`✅ PDF guardado: ${filePath} (${data.length} bytes)`);
          } catch (error) {
            logger.error('Error guardando PDF:', error);
          }
        }
      }
      
      // Continuar con la request
      await client.send('Fetch.continueRequest', { requestId });
    });
    
    // Navegar a notificaciones
    await page.goto('https://notif.pjn.gov.ar/recibidas');
    await page.waitForLoadState('networkidle');
    
    logger.info('📋 Buscando botón "Ver PDF"...');
    
    // Encontrar y hacer clic en el botón
    const botonPDF = await page.locator('button[aria-label*="Ver PDF"]').first();
    
    if (await botonPDF.isVisible()) {
      logger.info('✅ Botón encontrado');
      
      // Configurar listener para nuevas páginas
      page.context().on('page', async (newPage) => {
        logger.info(`📄 Nueva página abierta: ${newPage.url()}`);
        
        // Crear nueva sesión CDP para la nueva página
        const newClient = await newPage.context().newCDPSession(newPage);
        
        // Habilitar descarga en la nueva página también
        await newClient.send('Page.setDownloadBehavior', {
          behavior: 'allow',
          downloadPath: downloadPath
        });
        
        // Esperar un poco
        await newPage.waitForTimeout(5000);
        
        // Intentar print to PDF como última opción
        try {
          const pdf = await newClient.send('Page.printToPDF', {
            printBackground: true,
            format: 'A4'
          });
          
          const pdfBuffer = Buffer.from(pdf.data, 'base64');
          const pdfPath = path.join(downloadPath, `print_to_pdf_${Date.now()}.pdf`);
          await fs.writeFile(pdfPath, pdfBuffer);
          
          logger.info(`✅ PDF generado con printToPDF: ${pdfPath} (${pdfBuffer.length} bytes)`);
        } catch (error) {
          logger.error('Error con printToPDF:', error);
        }
      });
      
      // Hacer clic
      logger.info('🖱️ Haciendo clic en el botón...');
      await botonPDF.click();
      
      // Esperar para capturar actividad
      await page.waitForTimeout(10000);
      
      // Listar archivos descargados
      const files = await fs.readdir(downloadPath);
      logger.info(`\n📁 Archivos en carpeta de descargas: ${files.length}`);
      for (const file of files) {
        const stats = await fs.stat(path.join(downloadPath, file));
        logger.info(`  - ${file} (${stats.size} bytes)`);
      }
    }
    
  } catch (error) {
    logger.error('💥 Error:', error);
  } finally {
    await scraper.cleanup();
  }
}

testCDPDownload().catch(error => {
  logger.error('💥 Error fatal:', error);
  process.exit(1);
});