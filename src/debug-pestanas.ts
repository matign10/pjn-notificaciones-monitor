import { chromium } from 'playwright';
import { config, logger, checkConfig } from './config';
import path from 'path';

/**
 * Script para verificar exactamente qué pestañas se abren y qué contenido tienen
 */
async function debugPestanas() {
  logger.info('🔍 Verificando pestañas y contenido...');
  
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
    
    if (!page.url().includes('portalpjn.pjn.gov.ar')) {
      await page.goto(config.pjn.portalUrl);
      await page.waitForTimeout(5000);
    }
    
    logger.info('✅ Login completado');
    
    // Analizar la pestaña inicial (Entradas)
    logger.info('📋 ANALIZANDO PESTAÑA INICIAL (Entradas)...');
    
    await page.screenshot({ 
      path: path.join(config.app.dataDir, 'pestaña-entradas.png'),
      fullPage: true 
    });
    
    // Obtener las primeras 5 filas de la tabla de entradas
    const filasEntradas = await page.$$eval('tbody tr', rows =>
      rows.slice(0, 5).map((row, index) => ({
        index,
        contenido: row.textContent?.trim().substring(0, 150) || '',
        primeraCelda: row.querySelector('td:first-child')?.textContent?.trim() || ''
      }))
    );
    
    logger.info('📊 Contenido de la pestaña ENTRADAS:');
    filasEntradas.forEach(fila => {
      logger.info(`  Entrada ${fila.index + 1}: [${fila.primeraCelda}] ${fila.contenido}`);
    });
    
    // Preparar para capturar nueva pestaña
    const nuevaPestanaPromise = new Promise<any>((resolve) => {
      context.on('page', (nuevaPagina) => {
        resolve(nuevaPagina);
      });
    });
    
    // Hacer clic en Notificaciones
    logger.info('🎯 Haciendo clic en botón Notificaciones...');
    await page.click('#list-item-buttonNotificaciones');
    
    // Esperar la nueva pestaña
    let paginaNotificaciones;
    try {
      paginaNotificaciones = await Promise.race([
        nuevaPestanaPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 10000)
        )
      ]);
    } catch (error) {
      logger.error('❌ No se abrió nueva pestaña');
      return;
    }
    
    await paginaNotificaciones.waitForLoadState('networkidle', { timeout: 15000 });
    
    const urlNotificaciones = paginaNotificaciones.url();
    logger.info(`📍 Nueva pestaña abierta en: ${urlNotificaciones}`);
    
    // Analizar la pestaña de notificaciones
    logger.info('📋 ANALIZANDO PESTAÑA DE NOTIFICACIONES...');
    
    await paginaNotificaciones.screenshot({ 
      path: path.join(config.app.dataDir, 'pestaña-notificaciones.png'),
      fullPage: true 
    });
    
    // Esperar un poco para que cargue completamente
    await paginaNotificaciones.waitForTimeout(3000);
    
    // Obtener título/encabezado de la página de notificaciones
    const tituloNotificaciones = await paginaNotificaciones.locator('h1, h2, h3, .title, .page-title').allTextContents();
    logger.info(`📄 Títulos en página de notificaciones: ${tituloNotificaciones.join(' | ')}`);
    
    // Verificar si hay tabla de datos en notificaciones
    const tieneTabla = await paginaNotificaciones.locator('table, tbody').count() > 0;
    logger.info(`📊 ¿Tiene tabla de datos?: ${tieneTabla}`);
    
    if (tieneTabla) {
      // Obtener las primeras filas de la tabla de notificaciones
      const filasNotificaciones = await paginaNotificaciones.$$eval('tbody tr', rows =>
        rows.slice(0, 5).map((row, index) => ({
          index,
          contenido: row.textContent?.trim().substring(0, 150) || '',
          primeraCelda: row.querySelector('td:first-child')?.textContent?.trim() || '',
          totalCeldas: row.querySelectorAll('td').length
        }))
      );
      
      logger.info('📊 Contenido de la pestaña NOTIFICACIONES:');
      filasNotificaciones.forEach(fila => {
        logger.info(`  Notif ${fila.index + 1}: [${fila.primeraCelda}] ${fila.contenido} (${fila.totalCeldas} columnas)`);
      });
      
      // Comparar contenidos
      logger.info('🔍 COMPARACIÓN DE CONTENIDOS:');
      if (filasEntradas.length > 0 && filasNotificaciones.length > 0) {
        const contenidoEntrada1 = filasEntradas[0].contenido;
        const contenidoNotif1 = filasNotificaciones[0].contenido;
        
        const sonIguales = contenidoEntrada1 === contenidoNotif1;
        logger.info(`❓ ¿El contenido es idéntico?: ${sonIguales}`);
        
        if (sonIguales) {
          logger.error('🚨 PROBLEMA: El contenido de ambas pestañas es IDÉNTICO');
        } else {
          logger.info('✅ El contenido de las pestañas es DIFERENTE');
        }
      }
    } else {
      // Verificar si hay un mensaje de "sin notificaciones"
      const contenidoCompleto = await paginaNotificaciones.textContent('body') || '';
      const sinNotificaciones = contenidoCompleto.toLowerCase().includes('sin notificacion') ||
                               contenidoCompleto.toLowerCase().includes('no hay notificacion') ||
                               contenidoCompleto.toLowerCase().includes('vacio') ||
                               contenidoCompleto.includes('0 registros');
                               
      if (sinNotificaciones) {
        logger.info('📭 La página de notificaciones está vacía (sin notificaciones)');
      } else {
        logger.info('❓ La página de notificaciones no tiene tabla, analizando contenido...');
        logger.info(`📄 Primeros 500 caracteres: ${contenidoCompleto.substring(0, 500)}`);
      }
    }
    
    // Verificar encabezados de columna si existen
    try {
      const encabezadosNotif = await paginaNotificaciones.$$eval('th, .table-header', headers =>
        headers.map(h => h.textContent?.trim() || '')
      );
      
      if (encabezadosNotif.length > 0) {
        logger.info(`📋 Encabezados de tabla en notificaciones: ${encabezadosNotif.join(' | ')}`);
      }
    } catch (error) {
      logger.info('📋 No se encontraron encabezados de tabla en notificaciones');
    }
    
    // Mantener navegador abierto para inspección manual
    logger.info('🔍 Navegador abierto para inspección manual.');
    logger.info('👁️  Compara visualmente las dos pestañas.');
    logger.info('📝 Presiona Ctrl+C cuando termines de revisar.');
    
    await page.waitForTimeout(300000); // 5 minutos
    
  } catch (error) {
    logger.error('💥 Error durante debug:', error);
  } finally {
    await browser.close();
  }
}

debugPestanas().catch(error => {
  logger.error('💥 Error fatal:', error);
  process.exit(1);
});