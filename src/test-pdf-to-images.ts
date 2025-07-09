import { NotificationScraper } from './scraper/notification-scraper';
import { logger } from './config';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Convertir PDF con fuentes problemáticas a PDF con imágenes
 */
async function testPDFToImages() {
  logger.info('🚀 Probando conversión de PDF a imágenes...');
  
  try {
    // Usar el PDF que ya descargamos anteriormente
    const pdfPath = '/home/matia/pjn-notificaciones-monitor/data/pdfs/250000949463_1752017982829.pdf';
    
    // Verificar que el archivo existe
    try {
      await fs.access(pdfPath);
    } catch (error) {
      logger.error(`PDF no encontrado: ${pdfPath}`);
      return;
    }
    
    const stats = await fs.stat(pdfPath);
    logger.info(`📄 PDF original: ${stats.size} bytes`);
    
    // Crear directorio para imágenes
    const imagesDir = path.join(process.cwd(), 'data', 'pdf-images');
    await fs.mkdir(imagesDir, { recursive: true });
    
    // Opción 1: Usar pdftoppm (si está disponible)
    logger.info('🖼️ Intentando convertir con pdftoppm...');
    try {
      const outputPattern = path.join(imagesDir, 'page');
      await execAsync(`pdftoppm -png -r 150 "${pdfPath}" "${outputPattern}"`);
      logger.info('✅ Conversión con pdftoppm exitosa');
      
      // Listar imágenes generadas
      const files = await fs.readdir(imagesDir);
      const imageFiles = files.filter(f => f.endsWith('.png'));
      logger.info(`📊 Imágenes generadas: ${imageFiles.length}`);
      
      if (imageFiles.length > 0) {
        // Crear un nuevo PDF con las imágenes
        logger.info('📄 Creando nuevo PDF desde imágenes...');
        
        // Usar img2pdf si está disponible
        try {
          const sortedImages = imageFiles
            .sort()
            .map(f => path.join(imagesDir, f))
            .map(p => `"${p}"`)
            .join(' ');
          
          const outputPDF = path.join(process.cwd(), 'data', 'pdfs', `converted_${Date.now()}.pdf`);
          
          await execAsync(`img2pdf ${sortedImages} -o "${outputPDF}"`);
          
          const convertedStats = await fs.stat(outputPDF);
          logger.info(`✅ PDF convertido creado: ${outputPDF} (${convertedStats.size} bytes)`);
          
          // Verificar el nuevo PDF
          const fileType = await execAsync(`file "${outputPDF}"`);
          logger.info(`🔍 Tipo de archivo: ${fileType.stdout.trim()}`);
          
        } catch (error) {
          logger.error('Error creando PDF desde imágenes:', error);
        }
      }
    } catch (error) {
      logger.warn('pdftoppm no disponible:', error.message);
    }
    
    // Opción 2: Usar ImageMagick convert
    logger.info('🖼️ Intentando con ImageMagick...');
    try {
      const outputPattern = path.join(imagesDir, 'magick-page-%d.png');
      await execAsync(`convert -density 150 "${pdfPath}" "${outputPattern}"`);
      logger.info('✅ Conversión con ImageMagick exitosa');
      
      const files = await fs.readdir(imagesDir);
      const magickImages = files.filter(f => f.startsWith('magick-page-'));
      logger.info(`📊 Imágenes ImageMagick: ${magickImages.length}`);
      
      if (magickImages.length > 0) {
        // Crear PDF con ImageMagick
        const sortedImages = magickImages
          .sort((a, b) => {
            const numA = parseInt(a.match(/page-(\d+)\.png$/)?.[1] || '0');
            const numB = parseInt(b.match(/page-(\d+)\.png$/)?.[1] || '0');
            return numA - numB;
          })
          .map(f => path.join(imagesDir, f))
          .map(p => `"${p}"`)
          .join(' ');
        
        const outputPDF = path.join(process.cwd(), 'data', 'pdfs', `magick_converted_${Date.now()}.pdf`);
        
        await execAsync(`convert ${sortedImages} "${outputPDF}"`);
        
        const convertedStats = await fs.stat(outputPDF);
        logger.info(`✅ PDF ImageMagick creado: ${outputPDF} (${convertedStats.size} bytes)`);
      }
    } catch (error) {
      logger.warn('ImageMagick no disponible:', error.message);
    }
    
    // Opción 3: Verificar qué herramientas están disponibles
    logger.info('\n🔍 Verificando herramientas disponibles...');
    
    const tools = ['pdftoppm', 'convert', 'img2pdf', 'gs', 'mutool'];
    for (const tool of tools) {
      try {
        const result = await execAsync(`which ${tool}`);
        logger.info(`✅ ${tool}: ${result.stdout.trim()}`);
      } catch (error) {
        logger.info(`❌ ${tool}: no disponible`);
      }
    }
    
  } catch (error) {
    logger.error('💥 Error:', error);
  }
}

testPDFToImages().catch(error => {
  logger.error('💥 Error fatal:', error);
  process.exit(1);
});