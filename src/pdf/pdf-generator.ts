import { Page } from 'playwright';
import { PJNAuth } from '../auth/pjn-auth';
import { Expediente } from '../database/database';
import { config, logger } from '../config';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import dayjs from 'dayjs';

export interface PDFGenerationResult {
  success: boolean;
  filePath?: string;
  error?: string;
  fileSize?: number;
}

export interface PDFContent {
  titulo: string;
  expediente: string;
  caratula: string;
  fecha: Date;
  contenido: string;
  metadata?: {
    url?: string;
    tipoNotificacion?: string;
    juzgado?: string;
  };
}

export class PDFGenerator {
  private auth: PJNAuth;
  private pdfsDir: string;

  constructor(auth?: PJNAuth) {
    this.auth = auth || new PJNAuth({
      username: config.pjn.username,
      password: config.pjn.password,
      loginUrl: config.pjn.loginUrl,
      portalUrl: config.pjn.portalUrl,
      headless: config.app.headlessMode
    });
    
    this.pdfsDir = path.join(config.app.dataDir, 'pdfs');
  }

  /**
   * Inicializa el generador de PDFs
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Inicializando PDFGenerator...');
      
      // Crear directorio de PDFs si no existe
      await fs.mkdir(this.pdfsDir, { recursive: true });
      
      logger.info('PDFGenerator inicializado correctamente');
      
    } catch (error) {
      logger.error('Error al inicializar PDFGenerator:', error);
      throw error;
    }
  }

  /**
   * Genera un PDF para una notificación específica
   */
  async generarPDFNotificacion(expediente: Expediente): Promise<PDFGenerationResult> {
    try {
      logger.info(`📄 Generando PDF para expediente: ${expediente.numero}`);

      // Obtener página autenticada
      const page = await this.auth.getAuthenticatedPage();
      if (!page) {
        return {
          success: false,
          error: 'No se pudo obtener página autenticada'
        };
      }

      // Intentar capturar el contenido de la notificación
      const contenido = await this.capturarContenidoNotificacion(page, expediente);
      
      if (!contenido) {
        return {
          success: false,
          error: 'No se pudo capturar el contenido de la notificación'
        };
      }

      // Generar PDF con el contenido
      const pdfResult = await this.crearPDFDesdeContenido(contenido);
      
      return pdfResult;

    } catch (error) {
      logger.error(`Error al generar PDF para expediente ${expediente.numero}:`, error);
      return {
        success: false,  
        error: (error as Error).toString()
      };
    }
  }

  /**
   * Captura el contenido de una notificación específica
   */
  private async capturarContenidoNotificacion(page: Page, expediente: Expediente): Promise<PDFContent | null> {
    try {
      logger.info(`🔍 Capturando contenido para expediente: ${expediente.numero}`);

      // Buscar el expediente en la página actual o navegar a él
      const expedienteEncontrado = await this.buscarYAccederExpediente(page, expediente);
      
      if (!expedienteEncontrado) {
        logger.warn(`No se pudo acceder al expediente: ${expediente.numero}`);
        return null;
      }

      // Capturar contenido de la notificación
      const contenidoHTML = await this.extraerContenidoNotificacion(page, expediente);
      
      const contenido: PDFContent = {
        titulo: `Notificación - Expediente ${expediente.numero}`,
        expediente: expediente.numero,
        caratula: expediente.caratula,
        fecha: expediente.fechaNotificacion || new Date(),
        contenido: contenidoHTML,
        metadata: {
          url: page.url(),
          tipoNotificacion: 'Notificación Judicial'
        }
      };

      return contenido;

    } catch (error) {
      logger.error('Error al capturar contenido de notificación:', error);
      return null;
    }
  }

  /**
   * Busca y accede a un expediente específico
   */
  private async buscarYAccederExpediente(page: Page, expediente: Expediente): Promise<boolean> {
    try {
      logger.info(`🔎 Buscando expediente: ${expediente.numero}`);

      // Buscar enlace o botón del expediente
      const posiblesSelectores = [
        `a:has-text("${expediente.numero}")`,
        `button:has-text("${expediente.numero}")`,
        `tr:has-text("${expediente.numero}") a`,
        `tr:has-text("${expediente.numero}") button`,
        `[data-expediente="${expediente.numero}"]`,
        `[href*="${expediente.numero}"]`
      ];

      for (const selector of posiblesSelectores) {
        try {
          const elemento = await page.locator(selector).first();
          if (await elemento.isVisible()) {
            logger.info(`✅ Expediente encontrado con selector: ${selector}`);
            
            // Hacer clic para acceder al expediente
            await elemento.click();
            await page.waitForTimeout(2000);
            
            // Verificar que hemos accedido al expediente correcto
            const contenidoPagina = await page.textContent('body') || '';
            if (contenidoPagina.includes(expediente.numero)) {
              logger.info('✅ Acceso al expediente confirmado');
              return true;
            }
          }
        } catch (error) {
          logger.debug(`Selector ${selector} no funcionó`);
        }
      }

      // Si no encontramos el expediente directamente, intentar con campo de búsqueda
      return await this.buscarExpedienteConCampoBusqueda(page, expediente.numero);

    } catch (error) {
      logger.error('Error al buscar expediente:', error);
      return false;
    }
  }

  /**
   * Busca un expediente usando el campo de búsqueda
   */
  private async buscarExpedienteConCampoBusqueda(page: Page, numeroExpediente: string): Promise<boolean> {
    try {
      logger.info(`🔍 Intentando buscar expediente con campo de búsqueda: ${numeroExpediente}`);

      const posiblesCamposBusqueda = [
        'input[name="search"]',
        'input[name="buscar"]',
        'input[name="expediente"]',
        'input[name="numero"]',
        'input[type="search"]',
        'input[placeholder*="buscar"]',
        'input[placeholder*="expediente"]',
        'input[placeholder*="número"]'
      ];

      for (const campo of posiblesCamposBusqueda) {
        try {
          const inputBusqueda = await page.locator(campo).first();
          if (await inputBusqueda.isVisible()) {
            logger.info(`Campo de búsqueda encontrado: ${campo}`);
            
            // Limpiar y escribir número de expediente
            await inputBusqueda.clear();
            await inputBusqueda.fill(numeroExpediente);
            
            // Buscar botón de búsqueda
            const posiblesBotonesBusqueda = [
              'button[type="submit"]',
              'button:has-text("Buscar")',
              'button:has-text("Search")',
              'input[type="submit"]',
              '.btn-search',
              '.search-btn'
            ];

            let busquedaEjecutada = false;
            for (const boton of posiblesBotonesBusqueda) {
              try {
                const btnBusqueda = await page.locator(boton).first();
                if (await btnBusqueda.isVisible()) {
                  await btnBusqueda.click();
                  busquedaEjecutada = true;
                  break;
                }
              } catch (error) {
                // Continuar con el siguiente botón
              }
            }

            // Si no encontramos botón, intentar con Enter
            if (!busquedaEjecutada) {
              await inputBusqueda.press('Enter');
            }

            await page.waitForTimeout(3000);
            
            // Verificar si encontramos el expediente
            const contenido = await page.textContent('body') || '';
            if (contenido.includes(numeroExpediente)) {
              logger.info('✅ Expediente encontrado mediante búsqueda');
              return true;
            }
          }
        } catch (error) {
          logger.debug(`Campo de búsqueda ${campo} no funcionó`);
        }
      }

      return false;

    } catch (error) {
      logger.error('Error al buscar con campo de búsqueda:', error);
      return false;
    }
  }

  /**
   * Extrae el contenido de la notificación de la página
   */
  private async extraerContenidoNotificacion(page: Page, expediente: Expediente): Promise<string> {
    try {
      logger.info('📝 Extrayendo contenido de notificación...');

      // Primero intentar capturar la página completa como imagen y convertir a PDF
      const screenshotPath = path.join(this.pdfsDir, `screenshot-${expediente.numero}-${Date.now()}.png`);
      await page.screenshot({ 
        path: screenshotPath,
        fullPage: true,
        type: 'png'
      });

      // Extraer texto de la notificación
      let contenidoTexto = '';

      // Buscar contenido específico de notificación
      const selectoresNotificacion = [
        '.notificacion-content',
        '.notification-body',
        '.expediente-detail',
        '.contenido-notificacion',
        '.main-content',
        '.content-area',
        'main',
        '.container'
      ];

      for (const selector of selectoresNotificacion) {
        try {
          const elemento = await page.locator(selector).first();
          if (await elemento.isVisible()) {
            const texto = await elemento.textContent();
            if (texto && texto.length > contenidoTexto.length) {
              contenidoTexto = texto;
            }
          }
        } catch (error) {
          // Continuar con el siguiente selector
        }
      }

      // Si no encontramos contenido específico, usar el body completo
      if (!contenidoTexto || contenidoTexto.length < 50) {
        contenidoTexto = await page.textContent('body') || '';
      }

      // Limpiar y formatear el texto
      contenidoTexto = this.limpiarTextoNotificacion(contenidoTexto);

      // Agregar información de la captura
      const timestamp = dayjs().format('DD/MM/YYYY HH:mm:ss');
      const infoCaptura = `
════════════════════════════════════════
NOTIFICACIÓN JUDICIAL CAPTURADA
════════════════════════════════════════
Expediente: ${expediente.numero}
Carátula: ${expediente.caratula}
Fecha de captura: ${timestamp}
URL: ${page.url()}
────────────────────────────────────────

${contenidoTexto}

────────────────────────────────────────
Captura generada automáticamente por PJN Monitor
`;

      return infoCaptura;

    } catch (error) {
      logger.error('Error al extraer contenido de notificación:', error);
      return `Error al extraer contenido: ${error}`;
    }
  }

  /**
   * Limpia y formatea el texto de la notificación
   */
  private limpiarTextoNotificacion(texto: string): string {
    return texto
      .replace(/\s+/g, ' ')  // Normalizar espacios
      .replace(/\t+/g, ' ')  // Reemplazar tabs
      .replace(/\n\s*\n/g, '\n\n')  // Normalizar saltos de línea
      .trim();
  }

  /**
   * Crea un PDF a partir del contenido capturado
   */
  private async crearPDFDesdeContenido(contenido: PDFContent): Promise<PDFGenerationResult> {
    try {
      logger.info(`📄 Creando PDF para: ${contenido.expediente}`);

      // Crear nuevo documento PDF
      const pdfDoc = await PDFDocument.create();
      
      // Configurar metadatos
      pdfDoc.setTitle(contenido.titulo);
      pdfDoc.setSubject(`Notificación judicial - Expediente ${contenido.expediente}`);
      pdfDoc.setAuthor('PJN Monitor');
      pdfDoc.setCreator('PJN Notificaciones Monitor');
      pdfDoc.setCreationDate(contenido.fecha);

      // Agregar página
      const page = pdfDoc.addPage();
      const { width, height } = page.getSize();
      
      // Configurar fuentes
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // Configurar estilos
      const titleFontSize = 16;
      const headerFontSize = 12;
      const bodyFontSize = 10;
      const lineHeight = 14;
      const margin = 50;
      const maxWidth = width - (margin * 2);

      let yPosition = height - margin;

      // Título principal
      page.drawText(contenido.titulo, {
        x: margin,
        y: yPosition,
        size: titleFontSize,
        font: fontBold,
        color: rgb(0, 0, 0.8)
      });
      yPosition -= titleFontSize + 10;

      // Línea separadora
      page.drawLine({
        start: { x: margin, y: yPosition },
        end: { x: width - margin, y: yPosition },
        thickness: 1,
        color: rgb(0.5, 0.5, 0.5)
      });
      yPosition -= 20;

      // Información del expediente
      const infoExpediente = [
        `Expediente: ${contenido.expediente}`,
        `Carátula: ${contenido.caratula}`,
        `Fecha: ${dayjs(contenido.fecha).format('DD/MM/YYYY HH:mm')}`,
        contenido.metadata?.url ? `URL: ${contenido.metadata.url}` : null
      ].filter(Boolean);

      for (const info of infoExpediente) {
        if (info) {
          page.drawText(info, {
            x: margin,
            y: yPosition,
            size: headerFontSize,
            font: fontBold,
            color: rgb(0, 0, 0)
          });
          yPosition -= headerFontSize + 5;
        }
      }

      yPosition -= 15;

      // Contenido principal
      const lineasContenido = this.dividirTextoEnLineas(contenido.contenido, maxWidth, fontRegular, bodyFontSize);
      
      for (const linea of lineasContenido) {
        if (yPosition < margin + lineHeight) {
          // Agregar nueva página si nos quedamos sin espacio
          pdfDoc.addPage();
          yPosition = height - margin;
        }

        page.drawText(linea, {
          x: margin,
          y: yPosition,
          size: bodyFontSize,
          font: fontRegular,
          color: rgb(0, 0, 0)
        });
        yPosition -= lineHeight;
      }

      // Generar nombre de archivo
      const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
      const numeroLimpio = contenido.expediente.replace(/[^a-zA-Z0-9]/g, '-');
      const nombreArchivo = `notificacion-${numeroLimpio}-${timestamp}.pdf`;
      const rutaArchivo = path.join(this.pdfsDir, nombreArchivo);

      // Guardar PDF
      const pdfBytes = await pdfDoc.save();
      await fs.writeFile(rutaArchivo, pdfBytes);

      const stats = await fs.stat(rutaArchivo);

      logger.info(`✅ PDF generado exitosamente: ${nombreArchivo} (${stats.size} bytes)`);

      return {
        success: true,
        filePath: rutaArchivo,
        fileSize: stats.size
      };

    } catch (error) {
      logger.error('Error al crear PDF:', error);
      return {
        success: false,
        error: (error as Error).toString()
      };
    }
  }

  /**
   * Divide texto en líneas que caben en el ancho especificado
   */
  private dividirTextoEnLineas(texto: string, maxWidth: number, font: any, fontSize: number): string[] {
    const lineas: string[] = [];
    const palabras = texto.split(' ');
    let lineaActual = '';

    for (const palabra of palabras) {
      const lineaPrueba = lineaActual ? `${lineaActual} ${palabra}` : palabra;
      const anchoLinea = font.widthOfTextAtSize(lineaPrueba, fontSize);

      if (anchoLinea <= maxWidth) {
        lineaActual = lineaPrueba;
      } else {
        if (lineaActual) {
          lineas.push(lineaActual);
          lineaActual = palabra;
        } else {
          // Palabra muy larga, dividirla
          lineas.push(palabra);
        }
      }
    }

    if (lineaActual) {
      lineas.push(lineaActual);
    }

    return lineas;
  }

  /**
   * Genera PDF usando captura de pantalla como alternativa
   */
  async generarPDFPorCaptura(expediente: Expediente, page: Page): Promise<PDFGenerationResult> {
    try {
      logger.info(`📸 Generando PDF por captura para: ${expediente.numero}`);

      const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
      const numeroLimpio = expediente.numero.replace(/[^a-zA-Z0-9]/g, '-');
      const nombreArchivo = `captura-${numeroLimpio}-${timestamp}.pdf`;
      const rutaArchivo = path.join(this.pdfsDir, nombreArchivo);

      // Generar PDF directamente desde la página
      await page.pdf({
        path: rutaArchivo,
        format: 'A4',
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',  
          left: '15mm'
        },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `<div style="font-size: 10px; margin-left: 15mm;">
          <strong>Expediente ${expediente.numero}</strong> - Capturado el ${dayjs().format('DD/MM/YYYY HH:mm')}
        </div>`,
        footerTemplate: `<div style="font-size: 10px; margin-left: 15mm;">
          Generado por PJN Monitor - Página <span class="pageNumber"></span> de <span class="totalPages"></span>
        </div>`
      });

      const stats = await fs.stat(rutaArchivo);

      logger.info(`✅ PDF por captura generado: ${nombreArchivo} (${stats.size} bytes)`);

      return {
        success: true,
        filePath: rutaArchivo,
        fileSize: stats.size
      };

    } catch (error) {
      logger.error('Error al generar PDF por captura:', error);
      return {
        success: false,
        error: (error as Error).toString()
      };
    }
  }

  /**
   * Limpia archivos PDF antiguos
   */
  async limpiarPDFsAntiguos(diasMaximos: number = 30): Promise<void> {
    try {
      logger.info(`🧹 Limpiando PDFs anteriores a ${diasMaximos} días...`);

      const archivos = await fs.readdir(this.pdfsDir);
      const fechaLimite = dayjs().subtract(diasMaximos, 'day');
      let archivosEliminados = 0;

      for (const archivo of archivos) {
        if (archivo.endsWith('.pdf')) {
          const rutaArchivo = path.join(this.pdfsDir, archivo);
          const stats = await fs.stat(rutaArchivo);
          
          if (dayjs(stats.mtime).isBefore(fechaLimite)) {
            await fs.unlink(rutaArchivo);
            archivosEliminados++;
            logger.debug(`PDF eliminado: ${archivo}`);
          }
        }
      }

      logger.info(`✅ Limpieza completada: ${archivosEliminados} archivos eliminados`);

    } catch (error) {
      logger.error('Error al limpiar PDFs antiguos:', error);
    }
  }

  /**
   * Obtiene estadísticas de PDFs generados
   */
  async getEstadisticasPDFs(): Promise<{
    totalPDFs: number;
    espacioUtilizado: number;
    pdfMasReciente?: string;
    pdfMasAntiguo?: string;
  }> {
    try {
      const archivos = await fs.readdir(this.pdfsDir);
      const pdfFiles = archivos.filter(f => f.endsWith('.pdf'));
      
      let espacioTotal = 0;
      let fechaMasReciente = new Date(0);
      let fechaMasAntigua = new Date();
      let pdfMasReciente = '';
      let pdfMasAntiguo = '';

      for (const archivo of pdfFiles) {
        const rutaArchivo = path.join(this.pdfsDir, archivo);
        const stats = await fs.stat(rutaArchivo);
        
        espacioTotal += stats.size;
        
        if (stats.mtime > fechaMasReciente) {
          fechaMasReciente = stats.mtime;
          pdfMasReciente = archivo;
        }
        
        if (stats.mtime < fechaMasAntigua) {
          fechaMasAntigua = stats.mtime;
          pdfMasAntiguo = archivo;
        }
      }

      return {
        totalPDFs: pdfFiles.length,
        espacioUtilizado: espacioTotal,
        pdfMasReciente: pdfMasReciente || undefined,
        pdfMasAntiguo: pdfMasAntiguo || undefined
      };

    } catch (error) {
      logger.error('Error al obtener estadísticas de PDFs:', error);
      return {
        totalPDFs: 0,
        espacioUtilizado: 0
      };
    }
  }
}