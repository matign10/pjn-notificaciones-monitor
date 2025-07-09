import { chromium } from 'playwright';
import { config, logger, checkConfig } from './config';
import path from 'path';

/**
 * Script para verificar exactamente qué contenido está detectando el sistema
 */
async function verificarContenido() {
  logger.info('🔍 Verificando contenido de la página de notificaciones...');
  
  if (!checkConfig()) {
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: false, // Visible para inspección
    slowMo: 500,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--start-maximized'
    ]
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59',
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    // Login
    const loginUrl = `${config.pjn.loginUrl}?client_id=pjn-portal&redirect_uri=${encodeURIComponent(config.pjn.portalUrl)}`;
    logger.info(`Navegando a: ${loginUrl}`);
    await page.goto(loginUrl);
    
    await page.fill('input[name="username"]', config.pjn.username);
    await page.fill('input[name="password"]', config.pjn.password);
    
    const submitSelectors = ['input[type="submit"]', 'button[type="submit"]'];
    for (const selector of submitSelectors) {
      try {
        await page.click(selector, { timeout: 5000 });
        break;
      } catch (error) {
        continue;
      }
    }
    
    await page.waitForTimeout(15000);
    
    // Verificar que estamos en el portal
    const currentUrl = page.url();
    logger.info(`URL actual: ${currentUrl}`);
    
    if (!currentUrl.includes('portalpjn.pjn.gov.ar')) {
      await page.goto(config.pjn.portalUrl);
      await page.waitForTimeout(5000);
    }
    
    // Tomar screenshot del estado inicial
    await page.screenshot({ 
      path: path.join(config.app.dataDir, 'estado-inicial.png'),
      fullPage: true 
    });
    
    logger.info('📍 Estado inicial - Portal principal');
    
    // Analizar todos los elementos de navegación disponibles
    logger.info('🔍 Analizando elementos de navegación disponibles...');
    
    const elementosNavegacion = await page.$$eval('*', elements => 
      Array.from(elements)
        .filter(el => {
          const text = el.textContent?.trim() || '';
          return text.includes('otificacion') || 
                 text.includes('ntrada') || 
                 text.includes('visos') || 
                 text.includes('ensajes') ||
                 text.includes('omunicaciones');
        })
        .map(el => ({
          tagName: el.tagName,
          text: el.textContent?.trim().substring(0, 100) || '',
          className: el.className || '',
          id: el.id || '',
          href: el.getAttribute('href') || ''
        }))
    );
    
    logger.info('📋 Elementos de navegación encontrados:');
    elementosNavegacion.forEach((el, index) => {
      logger.info(`  ${index + 1}. ${el.tagName} - "${el.text}" (id: ${el.id}, class: ${el.className})`);
    });
    
    // Hacer clic en el elemento de notificaciones
    logger.info('🎯 Clickeando en Notificaciones...');
    await page.click('#list-item-buttonNotificaciones');
    await page.waitForTimeout(5000);
    
    // Tomar screenshot después del click (con timeout más largo)
    try {
      await page.screenshot({ 
        path: path.join(config.app.dataDir, 'despues-click-notificaciones.png'),
        fullPage: true,
        timeout: 60000
      });
    } catch (error) {
      logger.warn('Error tomando screenshot, continuando...');
    }
    
    // Analizar la URL actual
    const urlDespuesClick = page.url();
    logger.info(`📍 URL después de click: ${urlDespuesClick}`);
    
    // Obtener el título de la página
    const titulo = await page.title();
    logger.info(`📄 Título de la página: ${titulo}`);
    
    // Buscar indicadores de qué sección estamos viendo
    const indicadores = await page.$$eval('h1, h2, h3, .title, .header, .page-title, .breadcrumb', elements =>
      elements.map(el => ({
        tagName: el.tagName,
        text: el.textContent?.trim() || '',
        className: el.className || ''
      }))
    );
    
    logger.info('🏷️ Indicadores de sección/página:');
    indicadores.forEach((ind, index) => {
      logger.info(`  ${index + 1}. ${ind.tagName} - "${ind.text}" (class: ${ind.className})`);
    });
    
    // Analizar la estructura de la tabla/lista
    logger.info('📊 Analizando estructura de datos...');
    
    // Buscar encabezados de tabla
    const encabezados = await page.$$eval('th, .table-header, .header-cell', elements =>
      elements.map(el => el.textContent?.trim() || '')
    );
    
    if (encabezados.length > 0) {
      logger.info('📋 Encabezados de tabla encontrados:');
      encabezados.forEach((enc, index) => {
        logger.info(`  ${index + 1}. "${enc}"`);
      });
    }
    
    // Analizar las primeras 5 filas de datos
    const filas = await page.$$eval('tbody tr', rows =>
      rows.slice(0, 5).map((row, index) => ({
        index,
        contenido: row.textContent?.trim().substring(0, 200) || '',
        celdas: Array.from(row.querySelectorAll('td')).map(td => td.textContent?.trim() || '')
      }))
    );
    
    if (filas.length > 0) {
      logger.info('📋 Primeras 5 filas de datos:');
      filas.forEach(fila => {
        logger.info(`  Fila ${fila.index + 1}: ${fila.contenido}`);
        logger.info(`    Celdas: [${fila.celdas.join(' | ')}]`);
      });
    }
    
    // Buscar indicadores específicos de tipo de contenido
    const contenidoCompleto = await page.textContent('body') || '';
    
    const palabrasClave = {
      'entrada': contenidoCompleto.toLowerCase().split('entrada').length - 1,
      'notificacion': contenidoCompleto.toLowerCase().split('notificacion').length - 1,
      'expediente': contenidoCompleto.toLowerCase().split('expediente').length - 1,
      'aviso': contenidoCompleto.toLowerCase().split('aviso').length - 1,
      'comunicacion': contenidoCompleto.toLowerCase().split('comunicacion').length - 1
    };
    
    logger.info('🔍 Análisis de palabras clave en el contenido:');
    Object.entries(palabrasClave).forEach(([palabra, count]) => {
      logger.info(`  - "${palabra}": ${count} apariciones`);
    });
    
    // Mantener navegador abierto para inspección manual
    logger.info('🔍 Navegador abierto para inspección manual. Presiona Ctrl+C para cerrar.');
    logger.info('👁️  Revisa visualmente si estamos en la sección correcta de notificaciones.');
    
    await page.waitForTimeout(300000); // 5 minutos para inspección
    
  } catch (error) {
    logger.error('💥 Error durante verificación:', error);
  } finally {
    await browser.close();
  }
}

verificarContenido().catch(error => {
  logger.error('💥 Error fatal:', error);
  process.exit(1);
});