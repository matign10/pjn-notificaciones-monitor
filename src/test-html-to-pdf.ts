import { NotificationScraper } from './scraper/notification-scraper';
import { logger } from './config';
import fs from 'fs/promises';
import path from 'path';

/**
 * Script para generar PDF desde el contenido HTML de la notificación
 */
async function probarGeneracionPDFDesdeHTML() {
  logger.info('🚀 Probando generación de PDF desde contenido HTML...');
  
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
    
    // Encontrar la primera fila
    const primeraFila = await page.locator('tbody tr').first();
    
    if (await primeraFila.isVisible()) {
      // Obtener datos de la notificación
      const celdas = await primeraFila.locator('td').all();
      const datos: string[] = [];
      
      for (const celda of celdas) {
        const texto = await celda.textContent();
        datos.push(texto?.trim() || '');
      }
      
      logger.info('📊 Datos de la notificación:', datos);
      
      const numero = datos[0];
      const caratula = datos[1];
      
      // Hacer clic en la fila para expandir detalles
      logger.info('🖱️ Haciendo clic en la fila para expandir detalles...');
      await primeraFila.click();
      await page.waitForTimeout(2000);
      
      // Buscar el contenido expandido o modal
      let contenidoNotificacion = '';
      
      // Estrategia 1: Buscar contenido expandido en la tabla
      const filaExpandida = await page.locator(`tr:has-text("${numero}") + tr`).first();
      if (await filaExpandida.isVisible()) {
        contenidoNotificacion = await filaExpandida.textContent() || '';
        logger.info('✅ Contenido expandido encontrado en fila siguiente');
      }
      
      // Estrategia 2: Buscar modal o diálogo
      if (!contenidoNotificacion) {
        const modal = await page.locator('[role="dialog"], .modal, [aria-modal="true"]').first();
        if (await modal.isVisible()) {
          contenidoNotificacion = await modal.textContent() || '';
          logger.info('✅ Contenido encontrado en modal');
        }
      }
      
      // Estrategia 3: Buscar cualquier contenedor con la información
      if (!contenidoNotificacion) {
        const contenedores = await page.locator('.notification-content, .detail-content, .expanded-content').all();
        for (const contenedor of contenedores) {
          if (await contenedor.isVisible()) {
            contenidoNotificacion = await contenedor.textContent() || '';
            logger.info('✅ Contenido encontrado en contenedor');
            break;
          }
        }
      }
      
      // Generar HTML personalizado para el PDF
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: A4;
      margin: 20mm;
    }
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    .header {
      border-bottom: 2px solid #0066cc;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .logo {
      text-align: center;
      margin-bottom: 20px;
    }
    h1 {
      color: #0066cc;
      font-size: 24px;
      margin: 10px 0;
    }
    h2 {
      color: #333;
      font-size: 18px;
      margin: 15px 0 10px 0;
    }
    .info-box {
      background-color: #f5f5f5;
      border: 1px solid #ddd;
      padding: 15px;
      margin: 15px 0;
      border-radius: 5px;
    }
    .field {
      margin: 10px 0;
    }
    .field-label {
      font-weight: bold;
      color: #555;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #ccc;
      font-size: 12px;
      color: #666;
      text-align: center;
    }
    .content {
      margin: 20px 0;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">
      <h1>PODER JUDICIAL DE LA NACIÓN</h1>
      <p>Sistema de Notificaciones Electrónicas</p>
    </div>
  </div>
  
  <h2>NOTIFICACIÓN JUDICIAL</h2>
  
  <div class="info-box">
    <div class="field">
      <span class="field-label">Número de Expediente:</span> ${numero}
    </div>
    <div class="field">
      <span class="field-label">Carátula:</span> ${caratula}
    </div>
    <div class="field">
      <span class="field-label">Fecha de Notificación:</span> ${new Date().toLocaleDateString('es-AR')}
    </div>
  </div>
  
  <h2>Contenido de la Notificación</h2>
  <div class="content">
${contenidoNotificacion || 'Contenido no disponible. Por favor consulte el sistema PJN directamente.'}
  </div>
  
  <div class="footer">
    <p>Este documento es una copia de la notificación electrónica del Sistema PJN</p>
    <p>Generado automáticamente el ${new Date().toLocaleString('es-AR')}</p>
  </div>
</body>
</html>
      `;
      
      // Crear una nueva página con nuestro HTML
      const pdfPage = await page.context().newPage();
      await pdfPage.setContent(htmlContent);
      await pdfPage.waitForLoadState('networkidle');
      
      // Generar PDF
      const pdfPath = path.join('data', 'pdfs', `notificacion_html_${numero.replace(/\//g, '_')}_${Date.now()}.pdf`);
      await fs.mkdir(path.dirname(pdfPath), { recursive: true });
      
      await pdfPage.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: false,
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm'
        }
      });
      
      logger.info(`✅ PDF generado desde HTML: ${pdfPath}`);
      
      // Verificar tamaño
      const stats = await fs.stat(pdfPath);
      logger.info(`📄 Tamaño del PDF: ${stats.size} bytes`);
      
      await pdfPage.close();
    }
    
  } catch (error) {
    logger.error('💥 Error durante la prueba:', error);
  } finally {
    await scraper.cleanup();
  }
}

probarGeneracionPDFDesdeHTML().catch(error => {
  logger.error('💥 Error fatal:', error);
  process.exit(1);
});