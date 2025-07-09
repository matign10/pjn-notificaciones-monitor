import { NotificationScraper } from './scraper/notification-scraper';
import { logger } from './config';
import fs from 'fs/promises';
import path from 'path';

/**
 * Prueba descarga directa desde la API
 */
async function testAPIPDF() {
  logger.info('🚀 Probando descarga desde API...');
  
  const scraper = new NotificationScraper();
  
  try {
    await scraper.initialize();
    
    const auth = (scraper as any).auth;
    const page = await auth.getAuthenticatedPage();
    
    if (!page) {
      throw new Error('No se pudo obtener página autenticada');
    }
    
    // Primero obtener la lista de notificaciones
    logger.info('📋 Obteniendo lista de notificaciones desde API...');
    
    const response = await page.context().request.get(
      'https://notif.pjn.gov.ar/api/notificaciones?bandeja=RECIBIDAS&fechaDesde=08052025&fechaHasta=08072025&page=0&pageSize=10'
    );
    
    const data = await response.json();
    logger.info(`📊 Notificaciones encontradas: ${data.content?.length || 0}`);
    
    if (data.content && data.content.length > 0) {
      const primeraNotificacion = data.content[0];
      logger.info('Primera notificación:', {
        id: primeraNotificacion.id,
        numeroExpediente: primeraNotificacion.numeroExpediente,
        caratula: primeraNotificacion.caratula
      });
      
      // Construir URL del PDF basado en el ID
      const pdfUrl = `https://notif.pjn.gov.ar/api/notificaciones/RECIBIDAS/${primeraNotificacion.id}/pdf`;
      logger.info(`🎯 URL del PDF: ${pdfUrl}`);
      
      // Intentar descargar el PDF
      logger.info('📥 Descargando PDF...');
      
      try {
        const pdfResponse = await page.context().request.get(pdfUrl);
        const pdfBuffer = await pdfResponse.body();
        
        logger.info(`📊 Respuesta recibida:`);
        logger.info(`  Status: ${pdfResponse.status()}`);
        logger.info(`  Content-Type: ${pdfResponse.headers()['content-type']}`);
        logger.info(`  Tamaño: ${pdfBuffer.length} bytes`);
        
        // Verificar si es un PDF válido
        const header = pdfBuffer.slice(0, 4).toString();
        if (header.startsWith('%PDF')) {
          // Es un PDF válido, guardarlo
          const downloadPath = path.join(process.cwd(), 'data', 'downloads');
          await fs.mkdir(downloadPath, { recursive: true });
          
          const pdfPath = path.join(downloadPath, `api_${primeraNotificacion.id}.pdf`);
          await fs.writeFile(pdfPath, pdfBuffer);
          
          logger.info(`✅ PDF guardado exitosamente: ${pdfPath}`);
          
          // Verificar el archivo
          const stats = await fs.stat(pdfPath);
          logger.info(`📄 Archivo verificado: ${stats.size} bytes`);
          
          // Analizar contenido del PDF
          const pdfContent = pdfBuffer.toString('latin1');
          
          // Buscar fuentes
          const fonts = [];
          const fontMatches = pdfContent.matchAll(/\/BaseFont\s*\/([^\s\]]+)/g);
          for (const match of fontMatches) {
            fonts.push(match[1]);
          }
          
          logger.info(`🔤 Fuentes encontradas en el PDF: ${[...new Set(fonts)].join(', ')}`);
          
          // Si tiene fuentes problemáticas, advertir
          if (fonts.some(f => f.includes('Myriad'))) {
            logger.warn('⚠️ El PDF contiene fuentes Myriad Pro que pueden no renderizarse correctamente');
          }
          
        } else {
          // No es un PDF, probablemente un error
          logger.error('❌ La respuesta no es un PDF válido');
          logger.info(`Contenido: ${pdfBuffer.toString().substring(0, 200)}`);
        }
        
      } catch (error) {
        logger.error('Error descargando PDF:', error);
      }
      
      // Probar también con otras notificaciones
      logger.info('\n📋 Probando con otras notificaciones...');
      for (let i = 1; i < Math.min(3, data.content.length); i++) {
        const notif = data.content[i];
        const url = `https://notif.pjn.gov.ar/api/notificaciones/RECIBIDAS/${notif.id}/pdf`;
        
        try {
          const resp = await page.context().request.get(url);
          const buffer = await resp.body();
          logger.info(`  Notificación ${i}: ${notif.numeroExpediente} - ${resp.status()} - ${buffer.length} bytes`);
        } catch (error) {
          logger.error(`  Error con notificación ${i}:`, error);
        }
      }
    }
    
  } catch (error) {
    logger.error('💥 Error:', error);
  } finally {
    await scraper.cleanup();
  }
}

testAPIPDF().catch(error => {
  logger.error('💥 Error fatal:', error);
  process.exit(1);
});