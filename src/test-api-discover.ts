import { NotificationScraper } from './scraper/notification-scraper';
import { logger } from './config';
import fs from 'fs/promises';
import path from 'path';

/**
 * Descubrir la API de notificaciones
 */
async function discoverAPI() {
  logger.info('🔍 Descubriendo API de notificaciones...');
  
  const scraper = new NotificationScraper();
  
  try {
    await scraper.initialize();
    
    const auth = (scraper as any).auth;
    const page = await auth.getAuthenticatedPage();
    
    if (!page) {
      throw new Error('No se pudo obtener página autenticada');
    }
    
    // Navegar a la página de notificaciones primero
    logger.info('📋 Navegando a notificaciones para capturar llamadas API...');
    
    const requests: any[] = [];
    
    // Interceptar todas las requests
    page.on('request', request => {
      if (request.url().includes('api/notificaciones')) {
        requests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers()
        });
        logger.info(`📥 API Request: ${request.method()} ${request.url()}`);
      }
    });
    
    page.on('response', async response => {
      if (response.url().includes('api/notificaciones')) {
        logger.info(`📤 API Response: ${response.status()} ${response.url()}`);
        if (response.url().includes('?bandeja=RECIBIDAS')) {
          try {
            const data = await response.json();
            logger.info(`📊 Datos de respuesta:`, {
              totalElements: data.totalElements,
              totalPages: data.totalPages,
              numberOfElements: data.numberOfElements,
              contentLength: data.content?.length
            });
            
            if (data.content && data.content.length > 0) {
              const primera = data.content[0];
              logger.info('Primera notificación:', {
                id: primera.id,
                numeroExpediente: primera.numeroExpediente,
                caratula: primera.caratula?.substring(0, 50)
              });
              
              // Intentar descargar PDF de la primera notificación
              const pdfUrl = `https://notif.pjn.gov.ar/api/notificaciones/RECIBIDAS/${primera.id}/pdf`;
              logger.info(`🎯 Intentando PDF: ${pdfUrl}`);
              
              try {
                const pdfResponse = await page.context().request.get(pdfUrl);
                const pdfBuffer = await pdfResponse.body();
                
                logger.info(`PDF Response: ${pdfResponse.status()} - ${pdfBuffer.length} bytes`);
                
                const header = pdfBuffer.slice(0, 10).toString();
                logger.info(`PDF Header: "${header}"`);
                
                if (pdfBuffer.length > 100) {
                  const downloadPath = path.join(process.cwd(), 'data', 'downloads');
                  await fs.mkdir(downloadPath, { recursive: true });
                  
                  const pdfPath = path.join(downloadPath, `test_${primera.id}.pdf`);
                  await fs.writeFile(pdfPath, pdfBuffer);
                  
                  logger.info(`✅ PDF guardado: ${pdfPath}`);
                  
                  // Verificar si es un PDF válido
                  const fileType = await import('child_process').then(cp => 
                    new Promise<string>((resolve) => {
                      cp.exec(`file "${pdfPath}"`, (error, stdout) => {
                        resolve(stdout || 'unknown');
                      });
                    })
                  );
                  
                  logger.info(`Tipo de archivo: ${fileType.trim()}`);
                }
              } catch (pdfError) {
                logger.error('Error descargando PDF:', pdfError);
              }
            }
          } catch (error) {
            logger.error('Error parseando respuesta JSON:', error);
          }
        }
      }
    });
    
    // Navegar a notificaciones
    await page.goto('https://notif.pjn.gov.ar/recibidas');
    await page.waitForTimeout(5000);
    
    logger.info('\n📋 Requests capturadas:');
    requests.forEach(req => {
      logger.info(`  ${req.method} ${req.url}`);
    });
    
    // Probar diferentes rangos de fechas
    const hoy = new Date();
    const fechasAProbar = [
      // Últimos 30 días
      {
        desde: new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000),
        hasta: hoy
      },
      // Últimos 60 días
      {
        desde: new Date(hoy.getTime() - 60 * 24 * 60 * 60 * 1000),
        hasta: hoy
      }
    ];
    
    for (const rango of fechasAProbar) {
      const fechaDesde = rango.desde.toLocaleDateString('es-AR').replace(/\//g, '');
      const fechaHasta = rango.hasta.toLocaleDateString('es-AR').replace(/\//g, '');
      
      const url = `https://notif.pjn.gov.ar/api/notificaciones?bandeja=RECIBIDAS&fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}&page=0&pageSize=10`;
      
      logger.info(`\n🔍 Probando: ${url}`);
      
      try {
        const response = await page.context().request.get(url);
        const data = await response.json();
        
        logger.info(`  Status: ${response.status()}`);
        logger.info(`  Total elementos: ${data.totalElements}`);
        logger.info(`  Elementos en página: ${data.numberOfElements}`);
        
        if (data.content && data.content.length > 0) {
          logger.info('  ✅ Notificaciones encontradas!');
          break;
        }
      } catch (error) {
        logger.error(`  Error: ${error}`);
      }
    }
    
  } catch (error) {
    logger.error('💥 Error:', error);
  } finally {
    await scraper.cleanup();
  }
}

discoverAPI().catch(error => {
  logger.error('💥 Error fatal:', error);
  process.exit(1);
});