import fs from 'fs/promises';
import { logger } from './config';

/**
 * Analizar protecciones y firmas del PDF
 */
async function analyzePDFProtection() {
  logger.info('🔍 Analizando protecciones del PDF...');
  
  try {
    // Usar el PDF más reciente
    const pdfPath = '/home/matia/pjn-notificaciones-monitor/data/pdfs/250000949463_1752019028461.pdf';
    
    const pdfBuffer = await fs.readFile(pdfPath);
    const pdfContent = pdfBuffer.toString('latin1');
    
    logger.info(`📄 Tamaño del PDF: ${pdfBuffer.length} bytes`);
    
    // Buscar indicadores de protección
    const protectionIndicators = {
      encrypted: pdfContent.includes('/Encrypt'),
      permissions: pdfContent.includes('/P '),
      userPassword: pdfContent.includes('/U '),
      ownerPassword: pdfContent.includes('/O '),
      digitalSignature: pdfContent.includes('/Sig') || pdfContent.includes('/ByteRange'),
      adobeAcrobat: pdfContent.includes('Adobe') || pdfContent.includes('Acrobat'),
      security: pdfContent.includes('/Security'),
      drm: pdfContent.includes('/DRM') || pdfContent.includes('/Rights'),
      certification: pdfContent.includes('/DocMDP') || pdfContent.includes('/UR'),
      adbe: pdfContent.includes('/ADBE'),
      pkcs7: pdfContent.includes('/PKCS7') || pdfContent.includes('/adbe.pkcs7'),
      timestamp: pdfContent.includes('/TSA') || pdfContent.includes('/Timestamp')
    };
    
    logger.info('🔒 Indicadores de protección encontrados:');
    Object.entries(protectionIndicators).forEach(([key, value]) => {
      if (value) {
        logger.info(`  ✅ ${key}: SÍ`);
      } else {
        logger.info(`  ❌ ${key}: NO`);
      }
    });
    
    // Buscar versión del PDF
    const versionMatch = pdfContent.match(/%PDF-(\d+\.\d+)/);
    if (versionMatch) {
      logger.info(`📋 Versión PDF: ${versionMatch[1]}`);
    }
    
    // Buscar información del productor
    const producerMatch = pdfContent.match(/\/Producer\s*\(([^)]+)\)/);
    if (producerMatch) {
      logger.info(`🏭 Productor: ${producerMatch[1]}`);
    }
    
    // Buscar información del creador
    const creatorMatch = pdfContent.match(/\/Creator\s*\(([^)]+)\)/);
    if (creatorMatch) {
      logger.info(`👤 Creador: ${creatorMatch[1]}`);
    }
    
    // Analizar estructura de objetos
    const objMatches = pdfContent.matchAll(/(\d+)\s+(\d+)\s+obj/g);
    const objects = Array.from(objMatches);
    logger.info(`📦 Objetos en el PDF: ${objects.length}`);
    
    // Buscar objetos de páginas
    const pageMatches = pdfContent.matchAll(/\/Type\s*\/Page[^s]/g);
    const pages = Array.from(pageMatches);
    logger.info(`📃 Páginas detectadas: ${pages.length}`);
    
    // Buscar streams de contenido
    const streamMatches = pdfContent.matchAll(/stream\s*\n(.*?)\nendstream/gs);
    const streams = Array.from(streamMatches);
    logger.info(`🌊 Streams de contenido: ${streams.length}`);
    
    // Analizar el primer stream para ver si está encriptado/comprimido
    if (streams.length > 0) {
      const firstStream = streams[0][1];
      const streamSample = firstStream.substring(0, 100);
      
      logger.info('📊 Muestra del primer stream:');
      logger.info(`  Longitud: ${firstStream.length} bytes`);
      logger.info(`  Primeros caracteres: ${JSON.stringify(streamSample)}`);
      
      // Verificar si parece estar comprimido o encriptado
      const hasReadableText = /[a-zA-Z\s]{10,}/.test(streamSample);
      const hasBinaryData = streamSample.includes('\x00') || streamSample.charCodeAt(0) < 32;
      
      logger.info(`  ¿Parece texto legible?: ${hasReadableText ? 'SÍ' : 'NO'}`);
      logger.info(`  ¿Contiene datos binarios?: ${hasBinaryData ? 'SÍ' : 'NO'}`);
    }
    
    // Buscar filtros aplicados a los streams
    const filterMatches = pdfContent.matchAll(/\/Filter\s*\/([A-Za-z0-9]+)/g);
    const filters = Array.from(filterMatches).map(m => m[1]);
    const uniqueFilters = [...new Set(filters)];
    
    if (uniqueFilters.length > 0) {
      logger.info(`🔧 Filtros aplicados: ${uniqueFilters.join(', ')}`);
    }
    
    // Buscar xref table
    const xrefMatch = pdfContent.match(/xref\s*\n/);
    logger.info(`📚 Tabla xref presente: ${xrefMatch ? 'SÍ' : 'NO'}`);
    
    // Buscar trailer
    const trailerMatch = pdfContent.match(/trailer\s*\n/);
    logger.info(`🚛 Trailer presente: ${trailerMatch ? 'SÍ' : 'NO'}`);
    
    // Verificar integridad básica
    const hasStartxref = pdfContent.includes('startxref');
    const hasEOF = pdfContent.includes('%%EOF');
    
    logger.info(`🔍 Verificación de integridad:`);
    logger.info(`  startxref presente: ${hasStartxref ? 'SÍ' : 'NO'}`);
    logger.info(`  %%EOF presente: ${hasEOF ? 'SÍ' : 'NO'}`);
    
    // Conclusiones
    logger.info('\n📋 ANÁLISIS:');
    
    if (protectionIndicators.encrypted) {
      logger.warn('⚠️ El PDF está ENCRIPTADO - esto explica por qué se ve en blanco');
    }
    
    if (protectionIndicators.digitalSignature) {
      logger.warn('⚠️ El PDF tiene FIRMA DIGITAL - puede requerir validación');
    }
    
    if (protectionIndicators.drm || protectionIndicators.certification) {
      logger.warn('⚠️ El PDF tiene protecciones DRM/Certificación - acceso restringido');
    }
    
    if (objects.length === 0 || pages.length === 0) {
      logger.error('❌ El PDF parece estar corrupto - no se encontraron objetos/páginas válidos');
    }
    
  } catch (error) {
    logger.error('💥 Error analizando PDF:', error);
  }
}

analyzePDFProtection().catch(error => {
  logger.error('💥 Error fatal:', error);
  process.exit(1);
});