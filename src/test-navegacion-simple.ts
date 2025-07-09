import { chromium, Page } from 'playwright';
import { config, logger, checkConfig } from './config';
import path from 'path';

/**
 * Script de prueba simplificado para navegación específica a notificaciones
 */
async function testNavegacionSimple() {
  logger.info('🧪 Iniciando test de navegación simplificado...');
  
  if (!checkConfig()) {
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: false, // Modo visible para debugging
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
    // Navegar a login URL
    const loginUrl = `${config.pjn.loginUrl}?client_id=pjn-portal&redirect_uri=${encodeURIComponent(config.pjn.portalUrl)}`;
    logger.info(`Navegando a: ${loginUrl}`);
    await page.goto(loginUrl);
    
    // Tomar screenshot de la página de login
    await page.screenshot({ 
      path: path.join(config.app.dataDir, 'login-page-debug.png'),
      fullPage: true 
    });
    
    // Llenar formulario
    logger.info('Llenando formulario de login...');
    await page.fill('input[name="username"]', config.pjn.username);
    await page.fill('input[name="password"]', config.pjn.password);
    
    // Hacer clic en login - probar varios selectores
    logger.info('Clickeando botón de login...');
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("INGRESAR")',
      'input[value="INGRESAR"]',
      '.btn-primary',
      '#kc-login'
    ];
    
    let submitClicked = false;
    for (const selector of submitSelectors) {
      try {
        await page.click(selector, { timeout: 5000 });
        logger.info(`✅ Botón encontrado con selector: ${selector}`);
        submitClicked = true;
        break;
      } catch (error) {
        logger.info(`❌ Selector ${selector} no funcionó`);
      }
    }
    
    if (!submitClicked) {
      throw new Error('No se pudo encontrar el botón de login');
    }
    
    // Esperar un tiempo fijo para que procese el login
    logger.info('Esperando respuesta del servidor...');
    await page.waitForTimeout(15000);
    
    // Verificar URL actual
    const currentUrl = page.url();
    logger.info(`URL actual: ${currentUrl}`);
    
    // Intentar navegar al portal si no estamos ahí
    if (!currentUrl.includes('portalpjn.pjn.gov.ar')) {
      logger.info('Navegando directamente al portal...');
      await page.goto(config.pjn.portalUrl);
      await page.waitForTimeout(5000);
    }
    
    // Tomar screenshot
    await page.screenshot({ 
      path: path.join(config.app.dataDir, 'portal-estado-actual.png'),
      fullPage: true 
    });
    
    logger.info('📸 Screenshot guardado');
    
    // Obtener el contenido de la página
    const htmlContent = await page.content();
    
    // Buscar indicadores de login exitoso
    const loginExitoso = htmlContent.includes('portal') || 
                        htmlContent.includes('usuario') || 
                        htmlContent.includes('expediente') ||
                        htmlContent.includes('notificacion');
    
    if (loginExitoso) {
      logger.info('✅ Login parece exitoso, analizando contenido...');
      
      // Buscar todos los enlaces que contengan "notificacion"
      const enlaces = await page.$$eval('a', links => 
        links.map(link => ({
          text: link.textContent?.trim() || '',
          href: link.href || '',
          visible: link.offsetWidth > 0 && link.offsetHeight > 0
        }))
      );
      
      logger.info(`Encontrados ${enlaces.length} enlaces totales`);
      
      const enlacesSospechosos = enlaces.filter(link => 
        link.text.toLowerCase().includes('notificacion') ||
        link.text.toLowerCase().includes('avisos') ||
        link.text.toLowerCase().includes('mensajes') ||
        link.href.toLowerCase().includes('notificacion')
      );
      
      if (enlacesSospechosos.length > 0) {
        logger.info('🎯 Enlaces relacionados con notificaciones:');
        enlacesSospechosos.forEach((link, index) => {
          logger.info(`  ${index + 1}. "${link.text}" -> ${link.href} (visible: ${link.visible})`);
        });
      } else {
        logger.info('❌ No se encontraron enlaces obvios de notificaciones');
      }
      
      // Buscar elementos con texto "notificacion"
      const elementosConTexto = await page.$$eval('*', elements => 
        Array.from(elements)
          .filter(el => el.textContent?.toLowerCase().includes('notificacion'))
          .map(el => ({
            tagName: el.tagName,
            text: el.textContent?.trim().substring(0, 100) || '',
            className: el.className || '',
            id: el.id || ''
          }))
      );
      
      if (elementosConTexto.length > 0) {
        logger.info('🔍 Elementos que contienen "notificacion":');
        elementosConTexto.slice(0, 10).forEach((el, index) => {
          logger.info(`  ${index + 1}. ${el.tagName} - "${el.text}" (class: ${el.className}, id: ${el.id})`);
        });
      }
      
      // Esperar indefinidamente para inspección manual
      logger.info('🔍 Navegador abierto para inspección manual. Presiona Ctrl+C para cerrar.');
      await page.waitForTimeout(300000); // 5 minutos
      
    } else {
      logger.error('❌ Login falló o no se pudo acceder al portal');
      
      // Buscar mensajes de error
      const errores = await page.$$eval('.error, .alert, .message', elements => 
        elements.map(el => el.textContent?.trim())
      );
      
      if (errores.length > 0) {
        logger.error('Errores encontrados:');
        errores.forEach(error => logger.error(`  - ${error}`));
      }
    }

  } catch (error) {
    logger.error('💥 Error durante test:', error);
  } finally {
    logger.info('🧹 Cerrando navegador...');
    await browser.close();
  }
}

testNavegacionSimple().catch(error => {
  logger.error('💥 Error fatal:', error);
  process.exit(1);
});