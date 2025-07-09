import { NotificationScraper } from './scraper/notification-scraper';
import { logger } from './config';
import path from 'path';

/**
 * Script para debuggear la estructura HTML de la página de notificaciones
 */
async function debugPageStructure() {
  logger.info('🔍 Debuggeando estructura de la página de notificaciones...');
  
  const scraper = new NotificationScraper();
  
  try {
    // Inicializar el scraper
    await scraper.initialize();
    
    // Obtener la página autenticada
    const page = await scraper['auth'].getAuthenticatedPage();
    if (!page) {
      throw new Error('No se pudo obtener página autenticada');
    }

    // Navegar a notificaciones
    await page.goto('https://notif.pjn.gov.ar/recibidas');
    await page.waitForLoadState('networkidle');
    
    // Tomar screenshot
    await page.screenshot({ 
      path: path.join('/home/matia/pjn-notificaciones-monitor/data', 'debug-notifications-page.png'),
      fullPage: true 
    });
    
    logger.info('📸 Screenshot tomado: debug-notifications-page.png');
    
    // Obtener HTML completo de la página
    const htmlContent = await page.content();
    const fs = await import('fs/promises');
    await fs.writeFile('/home/matia/pjn-notificaciones-monitor/data/debug-notifications-page.html', htmlContent);
    
    logger.info('📄 HTML guardado: debug-notifications-page.html');
    
    // Buscar todas las filas de la tabla
    const rows = await page.locator('tbody tr').all();
    logger.info(`🔍 Encontradas ${rows.length} filas en la tabla`);
    
    // Analizar cada fila buscando específicamente la columna de acciones
    for (const [index, row] of rows.entries()) {
      if (index >= 3) break; // Solo las primeras 3 filas para no saturar
      
      logger.info(`\n=== FILA ${index + 1} ===`);
      
      // Obtener texto de la fila
      const rowText = await row.textContent() || '';
      logger.info(`Texto: ${rowText.substring(0, 100)}...`);
      
      // Buscar específicamente la columna de acciones (columna 7)
      const cells = await row.locator('td').all();
      logger.info(`Celdas encontradas: ${cells.length}`);
      
      if (cells.length >= 7) {
        const accionesCell = cells[6]; // Columna 7 (índice 6)
        logger.info(`\n--- COLUMNA DE ACCIONES ---`);
        
        const accionesText = await accionesCell.textContent() || '';
        logger.info(`Texto de acciones: "${accionesText}"`);
        
        // Buscar todos los elementos clickeables en la columna de acciones
        const accionesLinks = await accionesCell.locator('a').all();
        const accionesButtons = await accionesCell.locator('button').all();
        const accionesInputs = await accionesCell.locator('input').all();
        
        logger.info(`Enlaces en acciones: ${accionesLinks.length}`);
        for (const [linkIndex, link] of accionesLinks.entries()) {
          try {
            const href = await link.getAttribute('href');
            const onclick = await link.getAttribute('onclick');
            const text = await link.textContent();
            const title = await link.getAttribute('title');
            const ariaLabel = await link.getAttribute('aria-label');
            
            logger.info(`  Enlace ${linkIndex + 1}:`);
            logger.info(`    Texto: "${text}"`);
            logger.info(`    Href: ${href}`);
            logger.info(`    Onclick: ${onclick}`);
            logger.info(`    Title: ${title}`);
            logger.info(`    Aria-label: ${ariaLabel}`);
          } catch (error) {
            logger.warn(`    Error al analizar enlace ${linkIndex + 1}: ${error}`);
          }
        }
        
        logger.info(`Botones en acciones: ${accionesButtons.length}`);
        for (const [buttonIndex, button] of accionesButtons.entries()) {
          try {
            const onclick = await button.getAttribute('onclick');
            const text = await button.textContent();
            const title = await button.getAttribute('title');
            const value = await button.getAttribute('value');
            const ariaLabel = await button.getAttribute('aria-label');
            const type = await button.getAttribute('type');
            
            logger.info(`  Botón ${buttonIndex + 1}:`);
            logger.info(`    Texto: "${text}"`);
            logger.info(`    Type: ${type}`);
            logger.info(`    Onclick: ${onclick}`);
            logger.info(`    Title: ${title}`);
            logger.info(`    Value: ${value}`);
            logger.info(`    Aria-label: ${ariaLabel}`);
          } catch (error) {
            logger.warn(`    Error al analizar botón ${buttonIndex + 1}: ${error}`);
          }
        }
        
        logger.info(`Inputs en acciones: ${accionesInputs.length}`);
        for (const [inputIndex, input] of accionesInputs.entries()) {
          try {
            const type = await input.getAttribute('type');
            const onclick = await input.getAttribute('onclick');
            const value = await input.getAttribute('value');
            const title = await input.getAttribute('title');
            const ariaLabel = await input.getAttribute('aria-label');
            
            logger.info(`  Input ${inputIndex + 1}:`);
            logger.info(`    Type: ${type}`);
            logger.info(`    Value: "${value}"`);
            logger.info(`    Onclick: ${onclick}`);
            logger.info(`    Title: ${title}`);
            logger.info(`    Aria-label: ${ariaLabel}`);
          } catch (error) {
            logger.warn(`    Error al analizar input ${inputIndex + 1}: ${error}`);
          }
        }
      }
    }
    
    // Buscar elementos específicos que puedan ser botones PDF
    const possiblePDFElements = await page.locator('*').evaluateAll((elements) => {
      return elements
        .filter(el => {
          const text = el.textContent || '';
          const onclick = el.getAttribute('onclick') || '';
          const href = el.getAttribute('href') || '';
          const title = el.getAttribute('title') || '';
          
          return text.toLowerCase().includes('ver') ||
                 text.toLowerCase().includes('pdf') ||
                 onclick.includes('window.open') ||
                 href.includes('blob') ||
                 title.toLowerCase().includes('ver') ||
                 title.toLowerCase().includes('pdf');
        })
        .slice(0, 10) // Limitar a 10 elementos
        .map(el => ({
          tagName: el.tagName,
          text: el.textContent?.substring(0, 50),
          href: el.getAttribute('href'),
          onclick: el.getAttribute('onclick'),
          title: el.getAttribute('title'),
          className: el.className
        }));
    });
    
    logger.info(`\n=== POSIBLES ELEMENTOS PDF ===`);
    logger.info(`Encontrados ${possiblePDFElements.length} elementos posibles`);
    
    possiblePDFElements.forEach((element, index) => {
      logger.info(`\n  Elemento ${index + 1}:`);
      logger.info(`    Tag: ${element.tagName}`);
      logger.info(`    Text: "${element.text}"`);
      logger.info(`    Href: ${element.href}`);
      logger.info(`    Onclick: ${element.onclick}`);
      logger.info(`    Title: ${element.title}`);
      logger.info(`    Class: ${element.className}`);
    });
    
  } catch (error) {
    logger.error('💥 Error durante el debug:', error);
  } finally {
    await scraper.cleanup();
  }
}

debugPageStructure().catch(error => {
  logger.error('💥 Error fatal:', error);
  process.exit(1);
});