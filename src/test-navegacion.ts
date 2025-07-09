import { PJNAuth } from './auth/pjn-auth';
import { config, logger, checkConfig } from './config';
import path from 'path';

/**
 * Script de prueba para navegación específica a notificaciones
 */
async function testNavegacion() {
  logger.info('🧪 Iniciando test de navegación a notificaciones...');
  
  if (!checkConfig()) {
    process.exit(1);
  }

  const auth = new PJNAuth({
    username: config.pjn.username,
    password: config.pjn.password,
    loginUrl: config.pjn.loginUrl,
    portalUrl: config.pjn.portalUrl,
    headless: true
  });

  try {
    // Inicializar navegador
    logger.info('🚀 Inicializando navegador...');
    await auth.initialize();

    // Hacer login manualmente sin depender de waitForNavigation
    logger.info('🔑 Realizando login manual...');
    
    const page = await auth.getAuthenticatedPage();
    if (!page) {
      throw new Error('No se pudo obtener página inicial');
    }

    // Navegar a login URL
    const loginUrl = `${config.pjn.loginUrl}?client_id=pjn-portal&redirect_uri=${encodeURIComponent(config.pjn.portalUrl)}`;
    await page.goto(loginUrl);
    
    // Llenar formulario
    await page.fill('input[name="username"]', config.pjn.username);
    await page.fill('input[name="password"]', config.pjn.password);
    
    // Hacer clic en login
    await page.click('button[type="submit"]');
    
    // Esperar un tiempo fijo en lugar de navegación
    await page.waitForTimeout(10000);
    
    // Verificar si estamos en el portal
    const currentUrl = page.url();
    logger.info(`URL actual después del login: ${currentUrl}`);
    
    // Intentar navegar directamente al portal si no estamos ahí
    if (!currentUrl.includes('portalpjn.pjn.gov.ar')) {
      logger.info('No estamos en el portal, navegando directamente...');
      try {
        await page.goto(config.pjn.portalUrl);
        await page.waitForTimeout(5000);
      } catch (error) {
        logger.warn('Error navegando al portal:', error);
      }
    }

    logger.info('✅ Login exitoso, analizando página actual...');

    // Esperar un poco para que cargue completamente
    await page.waitForTimeout(3000);

    // Tomar screenshot del portal principal
    await page.screenshot({ 
      path: path.join(config.app.dataDir, 'portal-principal-debug.png'),
      fullPage: true 
    });

    logger.info('📸 Screenshot del portal principal guardado');

    // Analizar contenido de la página
    const contenido = await page.textContent('body') || '';
    logger.info('📄 Contenido de la página:');
    console.log(contenido.substring(0, 500) + '...');

    // Buscar elementos de navegación
    logger.info('🔍 Analizando elementos de navegación...');
    
    // Buscar todos los enlaces
    const enlaces = await page.locator('a').all();
    logger.info(`Encontrados ${enlaces.length} enlaces`);
    
    for (const [index, enlace] of enlaces.entries()) {
      if (index > 20) break; // Limitar para no spamear logs
      
      try {
        const texto = await enlace.textContent() || '';
        const href = await enlace.getAttribute('href') || '';
        
        if (texto.trim()) {
          logger.info(`Enlace ${index}: "${texto}" -> ${href}`);
          
          if (texto.toLowerCase().includes('notificacion') ||
              texto.toLowerCase().includes('avisos') ||
              texto.toLowerCase().includes('mensajes')) {
            logger.info(`🎯 POSIBLE ENLACE DE NOTIFICACIONES: "${texto}" -> ${href}`);
          }
        }
      } catch (error) {
        // Ignorar errores en enlaces individuales
      }
    }

    // Buscar botones
    const botones = await page.locator('button').all();
    logger.info(`Encontrados ${botones.length} botones`);
    
    for (const [index, boton] of botones.entries()) {
      if (index > 10) break;
      
      try {
        const texto = await boton.textContent() || '';
        if (texto.trim()) {
          logger.info(`Botón ${index}: "${texto}"`);
          
          if (texto.toLowerCase().includes('notificacion') ||
              texto.toLowerCase().includes('avisos') ||
              texto.toLowerCase().includes('mensajes')) {
            logger.info(`🎯 POSIBLE BOTÓN DE NOTIFICACIONES: "${texto}"`);
          }
        }
      } catch (error) {
        // Ignorar errores en botones individuales
      }
    }

    // Buscar elementos con clases de navegación
    const navElements = await page.locator('.nav, .navbar, .menu, .tabs, .tab').all();
    logger.info(`Encontrados ${navElements.length} elementos de navegación`);
    
    for (const [index, nav] of navElements.entries()) {
      try {
        const texto = await nav.textContent() || '';
        if (texto.trim()) {
          logger.info(`Nav ${index}: "${texto.substring(0, 100)}..."`);
        }
      } catch (error) {
        // Ignorar errores
      }
    }

    logger.info('✅ Análisis de navegación completado. Revisa los logs para encontrar el enlace de notificaciones.');

  } catch (error) {
    logger.error('💥 Error durante test de navegación:', error);
  } finally {
    logger.info('🧹 Limpiando recursos...');
    await auth.cleanup();
  }
}

testNavegacion().catch(error => {
  logger.error('💥 Error fatal:', error);
  process.exit(1);
});