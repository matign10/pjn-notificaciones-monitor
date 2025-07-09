import { PJNAuth } from './pjn-auth';
import { config, logger, checkConfig } from '../config';

/**
 * Script de prueba para verificar el login en el PJN
 * Ejecutar con: npm run test:login
 */
async function testLogin() {
  logger.info('🧪 Iniciando test de login PJN...');
  
  // Verificar configuración
  if (!checkConfig()) {
    process.exit(1);
  }

  const auth = new PJNAuth({
    username: config.pjn.username,
    password: config.pjn.password,
    loginUrl: config.pjn.loginUrl,
    portalUrl: config.pjn.portalUrl,
    headless: false // Siempre visible para testing
  });

  try {
    // Inicializar navegador
    logger.info('🚀 Inicializando navegador...');
    await auth.initialize();

    // Probar login
    logger.info('🔑 Probando login...');
    const loginSuccess = await auth.login();

    if (loginSuccess) {
      logger.info('✅ Login exitoso!');
      
      // Probar navegación al portal
      logger.info('🌐 Probando navegación al portal...');
      const portalSuccess = await auth.navigateToPortal();
      
      if (portalSuccess) {
        logger.info('✅ Navegación al portal exitosa!');
        
        // Probar verificación de sesión
        logger.info('🔍 Verificando validez de sesión...');
        const sessionValid = await auth.isSessionValid();
        
        if (sessionValid) {
          logger.info('✅ Sesión válida confirmada!');
          
          // Obtener página autenticada
          const page = await auth.getAuthenticatedPage();
          if (page) {
            logger.info('✅ Página autenticada obtenida!');
            
            // Tomar screenshot final
            await page.screenshot({ 
              path: config.app.dataDir + '/test-success.png',
              fullPage: true 
            });
            
            logger.info('📸 Screenshot guardado en data/test-success.png');
            
            console.log(`
╔══════════════════════════════════════╗
║            TEST EXITOSO              ║
║                                      ║
║ ✅ Login funcionando correctamente   ║
║ ✅ Cookies guardadas                 ║
║ ✅ Sesión persistente                ║
║ ✅ Portal accesible                  ║
╚══════════════════════════════════════╝
            `);
            
          } else {
            logger.error('❌ No se pudo obtener página autenticada');
          }
        } else {
          logger.error('❌ Sesión no válida');
        }
      } else {
        logger.error('❌ Error al navegar al portal');
      }
    } else {
      logger.error('❌ Login falló');
      console.log(`
❌ ERROR DE LOGIN

Posibles causas:
1. Credenciales incorrectas en .env
2. Cambios en la página de login del PJN
3. Problemas de conectividad

Revisa el archivo de log para más detalles.
      `);
    }

    // Pausa para inspección manual (solo en modo no headless)
    if (!config.app.headlessMode) {
      logger.info('🔍 Navegador abierto para inspección. Presiona Ctrl+C para cerrar.');
      const page = await auth.getAuthenticatedPage();
      if (page) {
        await page.pause();
      }
    }

  } catch (error) {
    logger.error('💥 Error durante el test de login:', error);
    
    console.log(`
❌ ERROR FATAL

${error}

Revisa los logs en logs/ para más información.
    `);
    
  } finally {
    logger.info('🧹 Limpiando recursos...');
    await auth.cleanup();
  }
}

// Ejecutar test
testLogin().catch(error => {
  logger.error('💥 Error fatal en test:', error);
  process.exit(1);
});
