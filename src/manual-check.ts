#!/usr/bin/env node

import { checkConfig, logger } from './config';
import { PJNMonitor } from './monitor/pjn-monitor';
import dayjs from 'dayjs';

/**
 * Script para ejecutar una verificación manual inmediata
 * Ejecutar con: npm run check:now
 */
async function ejecutarVerificacionManual() {
  console.log(`
╔═══════════════════════════════════════╗
║        VERIFICACIÓN MANUAL            ║
║     PJN Notificaciones Monitor        ║
╚═══════════════════════════════════════╝

🔍 Ejecutando verificación inmediata...
📅 ${dayjs().format('DD/MM/YYYY HH:mm:ss')}
  `);

  // Verificar configuración
  if (!checkConfig()) {
    process.exit(1);
  }

  const monitor = new PJNMonitor();

  try {
    // Inicializar monitor
    logger.info('🚀 Inicializando sistema...');
    await monitor.initialize();

    console.log('✅ Sistema inicializado');

    // Ejecutar verificación manual
    logger.info('🔍 Ejecutando verificación manual...');
    const resultado = await monitor.ejecutarVerificacionManual();

    // Mostrar resultados
    console.log(`
📊 RESULTADOS DE LA VERIFICACIÓN

${resultado.success ? '✅' : '❌'} Estado: ${resultado.success ? 'EXITOSA' : 'ERROR'}
⏱️  Duración: ${resultado.duracion}ms
📅 Timestamp: ${dayjs(resultado.timestamp).format('DD/MM/YYYY HH:mm:ss')}

📋 Expedientes encontrados: ${resultado.expedientesEncontrados}
🆕 Nuevas notificaciones: ${resultado.nuevasNotificaciones}
📱 Notificaciones enviadas: ${resultado.notificacionesEnviadas}
    `);

    if (resultado.errores.length > 0) {
      console.log('❌ ERRORES ENCONTRADOS:');
      resultado.errores.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    // Mostrar estadísticas del sistema
    logger.info('📊 Obteniendo estadísticas del sistema...');
    const estadisticas = await monitor.getEstadisticas();

    console.log(`
📊 ESTADÍSTICAS DEL SISTEMA

🔄 Monitor:
- Total verificaciones: ${estadisticas.monitor.totalChecks}
- Exitosas: ${estadisticas.monitor.successfulChecks}
- Fallidas: ${estadisticas.monitor.failedChecks}
- Última verificación: ${estadisticas.monitor.lastCheck ? dayjs(estadisticas.monitor.lastCheck).format('DD/MM/YYYY HH:mm:ss') : 'Nunca'}

📋 Scraper:
- Total expedientes: ${estadisticas.scraper.totalExpedientes}
- Con notificaciones: ${estadisticas.scraper.expedientesConNotificaciones}
- Pendientes de envío: ${estadisticas.scraper.notificacionesPendientes}
- Enviadas: ${estadisticas.scraper.notificacionesEnviadas}

📄 PDFs:
- Total archivos: ${estadisticas.pdfs.totalPDFs}
- Espacio utilizado: ${Math.round(estadisticas.pdfs.espacioUtilizado / 1024 / 1024)} MB
${estadisticas.pdfs.pdfMasReciente ? `- Más reciente: ${estadisticas.pdfs.pdfMasReciente}` : ''}
    `);

    if (resultado.success) {
      if (resultado.nuevasNotificaciones > 0) {
        console.log(`
🎉 VERIFICACIÓN COMPLETADA

Se encontraron ${resultado.nuevasNotificaciones} nuevas notificaciones.
${resultado.notificacionesEnviadas > 0 ? 
  `✅ ${resultado.notificacionesEnviadas} notificaciones enviadas por Telegram.` : 
  '⚠️ No se pudieron enviar notificaciones por Telegram.'}

Revisa tu Telegram para ver las notificaciones.
        `);
      } else {
        console.log(`
✅ VERIFICACIÓN COMPLETADA

No se encontraron nuevas notificaciones.
El sistema está funcionando correctamente.

💡 Para probar el sistema:
- npm run test:login (probar autenticación)
- npm run test:scraper (probar detección)  
- npm run test:telegram (probar notificaciones)
        `);
      }
    } else {
      console.log(`
❌ VERIFICACIÓN FALLÓ

La verificación no se completó exitosamente.

🔧 Pasos para solucionar:
1. Revisa los errores mostrados arriba
2. Ejecuta: npm run test:login
3. Verifica la conectividad a internet
4. Revisa los logs en logs/error.log
5. Verifica las credenciales en .env

Para soporte, consulta CLAUDE.md y README.md
      `);
    }

  } catch (error) {
    logger.error('💥 Error durante verificación manual:', error);
    
    console.log(`
❌ ERROR FATAL

${error}

🔧 Posibles causas:
1. Problemas de configuración (.env)
2. Credenciales incorrectas del PJN
3. Bot de Telegram mal configurado
4. Dependencias del sistema faltantes
5. Problemas de conectividad

🛠️ Pasos de diagnóstico:
1. Ejecuta: npm run test:login
2. Ejecuta: npm run test:telegram
3. Verifica las variables en .env
4. Instala dependencias: sudo apt-get install libnspr4 libnss3 libasound2
5. Revisa logs/error.log

Para más ayuda, consulta la documentación.
    `);

  } finally {
    // Limpiar recursos
    logger.info('🧹 Limpiando recursos...');
    await monitor.shutdown();
    
    console.log(`
🏁 Verificación manual finalizada
📅 ${dayjs().format('DD/MM/YYYY HH:mm:ss')}

Para monitoreo continuo, ejecuta: npm run dev
    `);
  }
}

// Ejecutar verificación manual
ejecutarVerificacionManual().catch(error => {
  logger.error('💥 Error fatal en verificación manual:', error);
  console.error('\n❌ Error fatal:', error.message);
  process.exit(1);
});