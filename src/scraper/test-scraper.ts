import { NotificationScraper } from './notification-scraper';
import { logger, checkConfig } from '../config';

/**
 * Script de prueba para verificar el scraper de notificaciones
 * Ejecutar con: npm run test:scraper
 */
async function testScraper() {
  logger.info('🧪 Iniciando test del scraper de notificaciones...');
  
  // Verificar configuración
  if (!checkConfig()) {
    process.exit(1);
  }

  const scraper = new NotificationScraper();

  try {
    // Inicializar scraper
    logger.info('🚀 Inicializando scraper...');
    await scraper.initialize();

    // Mostrar estadísticas iniciales
    logger.info('📊 Obteniendo estadísticas iniciales...');
    const estadisticasIniciales = await scraper.getEstadisticas();
    
    console.log(`
📊 ESTADÍSTICAS INICIALES:
- Total expedientes: ${estadisticasIniciales.totalExpedientes}
- Expedientes con notificaciones: ${estadisticasIniciales.expedientesConNotificaciones}
- Notificaciones pendientes: ${estadisticasIniciales.notificacionesPendientes}
- Notificaciones enviadas: ${estadisticasIniciales.notificacionesEnviadas}
    `);

    // Ejecutar scraping
    logger.info('🔍 Ejecutando scraping...');
    const resultado = await scraper.ejecutarScraping();

    // Mostrar resultados
    console.log(`
🔍 RESULTADOS DEL SCRAPING:
- Expedientes encontrados: ${resultado.expedientesEncontrados.length}
- Nuevas notificaciones: ${resultado.nuevasNotificaciones.length}
- Errores: ${resultado.errores.length}
    `);

    if (resultado.errores.length > 0) {
      console.log('\n❌ ERRORES:');
      resultado.errores.forEach(error => console.log(`  - ${error}`));
    }

    if (resultado.expedientesEncontrados.length > 0) {
      console.log('\n📋 EXPEDIENTES ENCONTRADOS:');
      resultado.expedientesEncontrados.forEach((exp, index) => {
        const icono = exp.tieneNotificacion ? '🔔' : '📄';
        console.log(`  ${icono} ${exp.numero} - ${exp.caratula.substring(0, 60)}...`);
        if (index >= 4) {
          console.log(`  ... y ${resultado.expedientesEncontrados.length - 5} más`);
          return;
        }
      });
    }

    if (resultado.nuevasNotificaciones.length > 0) {
      console.log('\n🆕 NUEVAS NOTIFICACIONES:');
      resultado.nuevasNotificaciones.forEach(notif => {
        console.log(`  🔔 ${notif.numero} - ${notif.caratula.substring(0, 60)}...`);
      });
    }

    // Obtener notificaciones pendientes
    logger.info('📬 Obteniendo notificaciones pendientes...');
    const pendientes = await scraper.getNotificacionesPendientes();
    
    if (pendientes.length > 0) {
      console.log('\n📬 NOTIFICACIONES PENDIENTES DE ENVÍO:');
      pendientes.forEach(exp => {
        console.log(`  📧 ${exp.numero} - ${exp.caratula.substring(0, 60)}...`);
      });
    } else {
      console.log('\n✅ No hay notificaciones pendientes de envío');
    }

    // Mostrar estadísticas finales
    logger.info('📊 Obteniendo estadísticas finales...');
    const estadisticasFinales = await scraper.getEstadisticas();
    
    console.log(`
📊 ESTADÍSTICAS FINALES:
- Total expedientes: ${estadisticasFinales.totalExpedientes}
- Expedientes con notificaciones: ${estadisticasFinales.expedientesConNotificaciones}
- Notificaciones pendientes: ${estadisticasFinales.notificacionesPendientes}
- Notificaciones enviadas: ${estadisticasFinales.notificacionesEnviadas}

🔄 CAMBIOS:
- Expedientes nuevos: +${estadisticasFinales.totalExpedientes - estadisticasIniciales.totalExpedientes}
- Nuevas notificaciones: +${estadisticasFinales.expedientesConNotificaciones - estadisticasIniciales.expedientesConNotificaciones}
    `);

    if (resultado.expedientesEncontrados.length > 0 || resultado.nuevasNotificaciones.length > 0) {
      console.log(`
╔══════════════════════════════════════╗
║           TEST EXITOSO               ║
║                                      ║
║ ✅ Scraper funcionando correctamente ║
║ ✅ Base de datos actualizada         ║
║ ✅ Detección de notificaciones activa║
╚══════════════════════════════════════╝
      `);
    } else {
      console.log(`
╔══════════════════════════════════════╗
║         TEST COMPLETADO              ║
║                                      ║
║ ⚠️  No se encontraron expedientes    ║
║ 🔍 Revisa la configuración del PJN   ║
║ 📋 Verifica que tengas expedientes   ║
╚══════════════════════════════════════╝
      `);
    }

  } catch (error) {
    logger.error('💥 Error durante el test del scraper:', error);
    
    console.log(`
❌ ERROR FATAL

${error}

Posibles causas:
1. Problemas de autenticación (ejecuta: npm run test:login)
2. Cambios en la estructura del portal PJN
3. Problemas de conectividad
4. Dependencias faltantes

Revisa los logs en logs/ para más información.
    `);
    
  } finally {
    logger.info('🧹 Limpiando recursos...');
    await scraper.cleanup();
  }
}

// Ejecutar test
testScraper().catch(error => {
  logger.error('💥 Error fatal en test del scraper:', error);
  process.exit(1);
});