import { Page } from 'playwright';
import { PJNAuth } from '../auth/pjn-auth';
import { PJNDatabase, Expediente } from '../database/database';
import { SupabaseDatabase } from '../database/supabase-database';
import { config, logger } from '../config';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
// import fs from 'fs/promises'; // Removido con PDFs

export interface ExpedienteDetectado {
  numero: string;
  caratula: string;
  tieneNotificacion: boolean;
  urlExpediente?: string;
  elementoNotificacion?: string;
}

export interface ResultadoScraping {
  expedientesEncontrados: ExpedienteDetectado[];
  nuevasNotificaciones: ExpedienteDetectado[];
  errores: string[];
}

export class NotificationScraper {
  private auth: PJNAuth;
  private db: PJNDatabase;

  constructor() {
    this.auth = new PJNAuth({
      username: config.pjn.username,
      password: config.pjn.password,
      loginUrl: config.pjn.loginUrl,
      portalUrl: config.pjn.portalUrl,
      headless: config.app.headlessMode
    });
    
    this.db = new SupabaseDatabase(); // Usar Supabase en lugar de SQLite
  }

  /**
   * Inicializa el scraper
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Inicializando NotificationScraper...');
      
      await this.db.initialize();
      await this.auth.initialize();
      
      logger.info('NotificationScraper inicializado correctamente');
      
    } catch (error) {
      logger.error('Error al inicializar NotificationScraper:', error);
      throw error;
    }
  }

  /**
   * Ejecuta el scraping completo
   */
  async ejecutarScraping(): Promise<ResultadoScraping> {
    const resultado: ResultadoScraping = {
      expedientesEncontrados: [],
      nuevasNotificaciones: [],
      errores: []
    };

    try {
      logger.info('🔍 Iniciando scraping de notificaciones...');

      // Verificar si ya tenemos una sesión válida
      let page = await this.auth.getAuthenticatedPage();
      
      if (!page) {
        // Si no hay sesión, inicializar desde cero
        logger.info('No hay sesión válida, inicializando nueva...');
        await this.auth.initialize();
        
        // Intentar login
        const loginSuccess = await this.auth.login();
        if (!loginSuccess) {
          throw new Error('No se pudo realizar login');
        }
        
        page = await this.auth.getAuthenticatedPage();
        if (!page) {
          throw new Error('No se pudo obtener página después del login');
        }
      }

      logger.info('✅ Página autenticada obtenida correctamente');

      // Navegar a la solapa de notificaciones
      const paginaNotificaciones = await this.navegarANotificaciones(page);
      if (!paginaNotificaciones) {
        throw new Error('No se pudo acceder a la página de notificaciones');
      }

      // Tomar screenshot de la página de notificaciones
      await paginaNotificaciones.screenshot({ 
        path: path.join(config.app.dataDir, 'notificaciones-page.png'),
        fullPage: true 
      });

      // Detectar notificaciones en la página específica
      const expedientesDetectados = await this.detectarNotificacionesEnPagina(paginaNotificaciones);
      resultado.expedientesEncontrados = expedientesDetectados;

      logger.info(`Expedientes encontrados: ${expedientesDetectados.length}`);
      logger.info(`Expedientes con notificaciones: ${expedientesDetectados.filter(e => e.tieneNotificacion).length}`);

      // Comparar con estado anterior y detectar nuevas notificaciones
      const nuevasNotificaciones = await this.compararConEstadoAnterior(expedientesDetectados);
      resultado.nuevasNotificaciones = nuevasNotificaciones;

      logger.info(`Nuevas notificaciones detectadas: ${nuevasNotificaciones.length}`);

      // Actualizar base de datos
      await this.actualizarEstadoExpedientes(expedientesDetectados);

      return resultado;

    } catch (error) {
      const errorMsg = `Error durante scraping: ${error}`;
      logger.error(errorMsg);
      resultado.errores.push(errorMsg);
      return resultado;
    }
  }

  /**
   * Navega específicamente a la solapa de notificaciones
   */
  private async navegarANotificaciones(page: Page): Promise<Page | null> {
    try {
      logger.info('Navegando a la solapa de Notificaciones...');

      // Tomar screenshot del portal principal para análisis
      await page.screenshot({ 
        path: path.join(config.app.dataDir, 'portal-principal.png'),
        fullPage: true 
      });

      // Buscar elementos que contengan "Notificaciones" - con el selector específico encontrado primero
      const posiblesSelectores = [
        '#list-item-buttonNotificaciones',
        'button:has-text("Notificaciones")',
        'div:has-text("Notificaciones")',
        'a:has-text("Notificaciones")',
        'li:has-text("Notificaciones") a',
        'li:has-text("Notificaciones") button',
        '.tab:has-text("Notificaciones")',
        '.nav-item:has-text("Notificaciones")',
        '.menu-item:has-text("Notificaciones")',
        '[title*="notificacion" i]',
        '[title*="Notificacion" i]',
        'a[href*="notificacion"]',
        'a[href*="notificaciones"]',
        // También buscar variantes en español
        'a:has-text("Avisos")',
        'a:has-text("Comunicaciones")',
        'a:has-text("Mensajes")',
        // Selectores más genéricos por posición
        '.navbar a:nth-child(2)',
        '.nav a:nth-child(2)',
        '.tab:nth-child(2)',
        'ul.nav li:nth-child(2) a'
      ];

      for (const selector of posiblesSelectores) {
        try {
          logger.info(`Probando selector: ${selector}`);
          
          const elemento = await page.locator(selector).first();
          if (await elemento.isVisible()) {
            logger.info(`✅ Elemento encontrado con selector: ${selector}`);
            
            // Hacer clic en el elemento - esto abrirá una nueva pestaña
            logger.info(`🎯 Haciendo clic en elemento para abrir notificaciones...`);
            
            // Escuchar por nuevas páginas/pestañas
            const paginaAntes = this.auth.getPage();
            const contexto = paginaAntes?.context();
            
            if (!contexto) {
              throw new Error('No se pudo obtener el contexto del navegador');
            }
            
            // Capturar nuevas páginas que se abran
            const nuevaPaginaPromise = new Promise<Page>((resolve) => {
              contexto.on('page', (nuevaPagina) => {
                resolve(nuevaPagina);
              });
            });
            
            // Hacer clic en el elemento
            await elemento.click();
            
            // Esperar por la nueva página (con timeout)
            let paginaNotificaciones: Page;
            try {
              logger.info('⏳ Esperando que se abra la nueva pestaña de notificaciones...');
              paginaNotificaciones = await Promise.race([
                nuevaPaginaPromise,
                new Promise<Page>((_, reject) => 
                  setTimeout(() => reject(new Error('Timeout esperando nueva pestaña')), 10000)
                )
              ]);
            } catch (error) {
              logger.warn(`❌ No se abrió nueva pestaña con selector: ${selector}`);
              continue;
            }
            
            // Esperar a que la nueva página cargue completamente
            await paginaNotificaciones.waitForLoadState('networkidle', { timeout: 15000 });
            
            const urlNuevaPagina = paginaNotificaciones.url();
            logger.info(`📍 Nueva pestaña abierta en: ${urlNuevaPagina}`);
            
            // Verificar si es la página de notificaciones
            if (urlNuevaPagina.includes('notif.pjn.gov.ar')) {
              logger.info(`✅ Navegación a notificaciones exitosa con: ${selector}`);
              logger.info(`🎯 URL de notificaciones: ${urlNuevaPagina}`);
              
              // Actualizar la página actual del auth para usar la de notificaciones
              await this.auth.setPage(paginaNotificaciones);
              
              return paginaNotificaciones;
            }
            
            // Si no es la página correcta, cerrar la nueva pestaña
            await paginaNotificaciones.close();
            logger.warn(`❌ Nueva pestaña no es de notificaciones: ${urlNuevaPagina}`);
          }
        } catch (error) {
          logger.debug(`Selector ${selector} no funcionó: ${error}`);
        }
      }

      // Si no encontramos con texto, buscar por análisis de menú
      logger.info('Intentando análisis de estructura de menú...');
      const resultadoMenu = await this.analizarEstructuraMenu(page);
      return resultadoMenu ? page : null;

    } catch (error) {
      logger.error('Error al navegar a notificaciones:', error);
      return null;
    }
  }

  /**
   * Analiza la estructura del menú para encontrar notificaciones
   */
  private async analizarEstructuraMenu(page: Page): Promise<boolean> {
    try {
      // Buscar elementos de navegación principales
      const menuSelectors = [
        '.navbar ul li',
        '.nav-tabs li',
        '.nav li',
        '.menu li',
        '.tabs li',
        'ul li'
      ];

      for (const menuSelector of menuSelectors) {
        try {
          const elementos = await page.locator(menuSelector).all();
          
          if (elementos.length > 1) {
            logger.info(`Analizando menú con ${elementos.length} elementos`);
            
            for (const [index, elemento] of elementos.entries()) {
              const texto = await elemento.textContent() || '';
              logger.info(`Elemento ${index}: "${texto}"`);
              
              if (texto.toLowerCase().includes('notificacion') ||
                  texto.toLowerCase().includes('avisos') ||
                  texto.toLowerCase().includes('mensajes')) {
                
                logger.info(`✅ Encontrado elemento de notificaciones: "${texto}"`);
                await elemento.click();
                await page.waitForTimeout(2000);
                return true;
              }
            }
          }
        } catch (error) {
          logger.debug(`Error analizando ${menuSelector}:`, error);
        }
      }

      return false;
    } catch (error) {
      logger.error('Error en análisis de estructura de menú:', error);
      return false;
    }
  }

  /**
   * Detecta notificaciones en la página específica de notificaciones
   */
  private async detectarNotificacionesEnPagina(page: Page): Promise<ExpedienteDetectado[]> {
    try {
      logger.info('Detectando notificaciones en la página específica...');

      const notificaciones: ExpedienteDetectado[] = [];

      // Esperar a que la página cargue completamente
      await page.waitForTimeout(3000);

      // Selectores específicos para notificaciones
      const selectoresNotificaciones = [
        '.notification',
        '.notificacion',
        '.message',
        '.mensaje',
        '.aviso',
        '.comunicacion',
        '.list-item',
        '.table-row',
        'tr[data-notification]',
        'tr[data-notificacion]',
        'tbody tr',
        '.card',
        '.panel',
        '.item'
      ];

      for (const selector of selectoresNotificaciones) {
        try {
          const elementos = await page.locator(selector).all();
          
          if (elementos.length > 0) {
            logger.info(`Encontrados ${elementos.length} elementos con selector: ${selector}`);

            for (const [index, elemento] of elementos.entries()) {
              try {
                const textoCompleto = await elemento.textContent() || '';
                
                if (textoCompleto.trim().length < 10) continue; // Ignorar elementos muy cortos
                
                // Extraer información de la notificación
                const numeroMatch = textoCompleto.match(/(\d{1,6}\/\d{4}|\d{4}-\d{6}-\d{2}|\d{8,12})/);
                const numero = numeroMatch ? numeroMatch[1] : `NOTIF-${Date.now()}-${index}`;

                let caratula = textoCompleto
                  .replace(numero, '')
                  .replace(/\s+/g, ' ')
                  .trim()
                  .substring(0, 200);

                if (!caratula) {
                  caratula = `Notificación del ${new Date().toLocaleDateString()}`;
                }

                // Funcionalidad de PDFs removida

                // En la página de notificaciones, todas son notificaciones
                const notificacion: ExpedienteDetectado = {
                  numero,
                  caratula,
                  tieneNotificacion: true, // Todas las entradas en esta página son notificaciones
                  elementoNotificacion: selector
                };

                notificaciones.push(notificacion);

                logger.info(`📧 Notificación detectada: ${numero} - ${caratula.substring(0, 50)}...`);

              } catch (error) {
                logger.warn(`Error al procesar notificación ${index}:`, error);
              }
            }

            // Si encontramos notificaciones con este selector, no necesitamos probar otros
            if (notificaciones.length > 0) {
              break;
            }
          }
        } catch (error) {
          logger.debug(`Selector ${selector} no funcionó:`, error);
        }
      }

      // Si no encontramos nada específico, analizar todo el contenido
      if (notificaciones.length === 0) {
        logger.warn('No se encontraron notificaciones con selectores específicos, analizando contenido general...');
        return await this.analizarContenidoGeneral(page);
      }

      logger.info(`✅ Detección completada: ${notificaciones.length} notificaciones encontradas`);
      return notificaciones;

    } catch (error) {
      logger.error('Error al detectar notificaciones en página:', error);
      return [];
    }
  }

  /**
   * Analiza contenido general cuando no se encuentran selectores específicos
   */
  private async analizarContenidoGeneral(page: Page): Promise<ExpedienteDetectado[]> {
    try {
      logger.info('Analizando contenido general de la página...');

      const contenidoCompleto = await page.textContent('body') || '';
      
      // Buscar patrones que indiquen notificaciones
      const lineas = contenidoCompleto.split('\n').filter(linea => linea.trim().length > 20);
      const notificaciones: ExpedienteDetectado[] = [];

      for (const [index, linea] of lineas.entries()) {
        if (index > 50) break; // Limitar análisis para evitar ruido

        const lineaLimpia = linea.trim();
        
        // Si la línea contiene palabras clave de notificaciones
        if (lineaLimpia.toLowerCase().includes('notificacion') ||
            lineaLimpia.toLowerCase().includes('expediente') ||
            lineaLimpia.toLowerCase().includes('causa') ||
            /\d{1,6}\/\d{4}/.test(lineaLimpia)) {
          
          const numeroMatch = lineaLimpia.match(/(\d{1,6}\/\d{4}|\d{4}-\d{6}-\d{2}|\d{8,12})/);
          const numero = numeroMatch ? numeroMatch[1] : `CONTENT-${index}`;

          notificaciones.push({
            numero,
            caratula: lineaLimpia.substring(0, 200),
            tieneNotificacion: true,
            elementoNotificacion: 'content-analysis'
          });
        }
      }

      logger.info(`Análisis general encontró ${notificaciones.length} posibles notificaciones`);
      return notificaciones;

    } catch (error) {
      logger.error('Error en análisis de contenido general:', error);
      return [];
    }
  }

  /**
   * Encuentra la URL de la lista de expedientes (método legacy)
   */
  private async encontrarUrlExpedientes(page: Page): Promise<string | null> {
    try {
      logger.info('Buscando URL de expedientes...');

      // Buscar enlaces que contengan palabras clave relacionadas con expedientes
      const posiblesEnlaces = [
        'a[href*="expediente"]',
        'a[href*="causa"]',
        'a[href*="listado"]',
        'a:has-text("Expedientes")',
        'a:has-text("Causas")',
        'a:has-text("Listado")',
        'a:has-text("Mis Expedientes")',
        'button:has-text("Expedientes")',
        'button:has-text("Causas")',
        '.menu-item:has-text("Expedientes")',
        '.nav-item:has-text("Expedientes")'
      ];

      for (const selector of posiblesEnlaces) {
        try {
          const elemento = await page.locator(selector).first();
          if (await elemento.isVisible()) {
            const href = await elemento.getAttribute('href');
            if (href) {
              // Si es una URL relativa, convertirla en absoluta
              if (href.startsWith('/')) {
                return `https://portalpjn.pjn.gov.ar${href}`;
              } else if (href.startsWith('http')) {
                return href;
              }
            } else {
              // Si es un botón, intentar hacer click
              await elemento.click();
              await page.waitForTimeout(2000);
              return page.url();
            }
          }
        } catch (error) {
          logger.debug(`Selector ${selector} no encontrado o no funcional`);
        }
      }

      // Si no encontramos enlace específico, buscar en el contenido de la página
      const currentUrl = page.url();
      if (currentUrl.includes('portalpjn.pjn.gov.ar')) {
        // Ya estamos en el portal, podría ser que los expedientes estén en la página principal
        return currentUrl;
      }

      logger.warn('No se pudo encontrar URL específica de expedientes');
      return null;

    } catch (error) {
      logger.error('Error al buscar URL de expedientes:', error);
      return null;
    }
  }

  /**
   * Detecta expedientes con notificaciones (círculos naranjas con 'n')
   */
  private async detectarExpedientesConNotificaciones(page: Page): Promise<ExpedienteDetectado[]> {
    try {
      logger.info('Detectando expedientes con notificaciones...');

      const expedientes: ExpedienteDetectado[] = [];

      // Esperar a que la página cargue completamente
      await page.waitForTimeout(3000);

      // Posibles selectores para expedientes y notificaciones
      const selectoresExpedientes = [
        '.expediente',
        '.causa',
        '.row-expediente',
        'tr[data-expediente]',
        'tr:has([class*="notificacion"])',
        '.list-item',
        '.card-expediente',
        'tbody tr'
      ];

      // Posibles selectores para indicadores de notificación
      const selectoresNotificacion = [
        '.notificacion',
        '.badge-notificacion',
        '.circle-notification',
        '.icon-notification',
        '[class*="orange"]',
        '[style*="orange"]',
        '[style*="#ff"]',
        '.alert-warning',
        '.badge-warning',
        'span:has-text("n")',
        'span:has-text("N")',
        '[title*="notificacion"]',
        '[title*="Notificacion"]'
      ];

      for (const selectorExp of selectoresExpedientes) {
        try {
          const elementosExpedientes = await page.locator(selectorExp).all();
          
          if (elementosExpedientes.length > 0) {
            logger.info(`Encontrados ${elementosExpedientes.length} elementos con selector: ${selectorExp}`);

            for (const [index, elemento] of elementosExpedientes.entries()) {
              try {
                // Extraer información básica del expediente
                const textoCompleto = await elemento.textContent() || '';
                
                // Intentar extraer número de expediente (patrones comunes)
                const numeroMatch = textoCompleto.match(/(\d{1,6}\/\d{4}|\d{4}-\d{6}-\d{2}|\d{8,12})/);
                const numero = numeroMatch ? numeroMatch[1] : `EXP-${Date.now()}-${index}`;

                // Extraer carátula (generalmente el texto más largo o después del número)
                let caratula = textoCompleto
                  .replace(numero, '')
                  .replace(/\s+/g, ' ')
                  .trim()
                  .substring(0, 200);

                if (!caratula) {
                  caratula = `Expediente ${numero}`;
                }

                // Verificar si tiene notificación
                let tieneNotificacion = false;
                let elementoNotificacion = '';

                for (const selectorNot of selectoresNotificacion) {
                  try {
                    const notifElement = elemento.locator(selectorNot).first();
                    if (await notifElement.isVisible()) {
                      tieneNotificacion = true;
                      elementoNotificacion = selectorNot;
                      logger.info(`🔔 Notificación detectada en expediente ${numero} con selector: ${selectorNot}`);
                      break;
                    }
                  } catch (error) {
                    // Continuar con el siguiente selector
                  }
                }

                // Buscar también por colores y estilos específicos
                if (!tieneNotificacion) {
                  try {
                    const estilos = await elemento.evaluate((el) => {
                      const computed = (globalThis as any).window.getComputedStyle(el);
                      return {
                        backgroundColor: computed.backgroundColor,
                        color: computed.color,
                        borderColor: computed.borderColor
                      };
                    });

                    // Detectar colores naranjas/amarillos típicos de notificaciones
                    const coloresNotificacion = [
                      'rgb(255, 165, 0)', // orange
                      'rgb(255, 140, 0)', // darkorange  
                      'rgb(255, 69, 0)',  // orangered
                      'rgb(255, 215, 0)', // gold
                      'rgb(255, 193, 7)'  // warning bootstrap
                    ];

                    const tieneColorNotificacion = Object.values(estilos).some(color => 
                      coloresNotificacion.some(notifColor => 
                        color.includes(notifColor) || 
                        color.includes('orange') || 
                        color.includes('warning')
                      )
                    );

                    if (tieneColorNotificacion) {
                      tieneNotificacion = true;
                      elementoNotificacion = 'color-detection';
                      logger.info(`🎨 Notificación detectada por color en expediente ${numero}`);
                    }
                  } catch (error) {
                    logger.debug('Error al verificar estilos:', error);
                  }
                }

                const expediente: ExpedienteDetectado = {
                  numero,
                  caratula,
                  tieneNotificacion,
                  elementoNotificacion
                };

                expedientes.push(expediente);

                if (tieneNotificacion) {
                  logger.info(`📋 Expediente con notificación: ${numero} - ${caratula.substring(0, 50)}...`);
                }

              } catch (error) {
                logger.warn(`Error al procesar expediente ${index}:`, error);
              }
            }

            // Si encontramos expedientes con este selector, no necesitamos probar otros
            if (expedientes.length > 0) {
              break;
            }
          }
        } catch (error) {
          logger.debug(`Selector ${selectorExp} no funcionó:`, error);
        }
      }

      // Si no encontramos nada con los selectores, intentar scraping genérico
      if (expedientes.length === 0) {
        logger.warn('No se encontraron expedientes con selectores específicos, intentando scraping genérico...');
        return await this.scrapingGenerico(page);
      }

      logger.info(`✅ Scraping completado: ${expedientes.length} expedientes detectados`);
      return expedientes;

    } catch (error) {
      logger.error('Error al detectar expedientes:', error);
      throw error;
    }
  }

  /**
   * Scraping genérico cuando los selectores específicos no funcionan
   */
  private async scrapingGenerico(page: Page): Promise<ExpedienteDetectado[]> {
    try {
      logger.info('Ejecutando scraping genérico...');

      // Buscar todos los elementos que puedan contener texto de expedientes
      const textoCompleto = await page.textContent('body') || '';
      
      // Buscar patrones de números de expediente
      const numerosExpediente = textoCompleto.match(/\d{1,6}\/\d{4}|\d{4}-\d{6}-\d{2}|\d{8,12}/g) || [];
      
      const expedientesGenericos: ExpedienteDetectado[] = [];
      
      for (const numero of numerosExpediente.slice(0, 10)) { // Limitar a 10 para evitar falsos positivos
        expedientesGenericos.push({
          numero,
          caratula: `Expediente detectado genéricamente: ${numero}`,
          tieneNotificacion: false // No podemos detectar notificaciones de forma genérica
        });
      }

      logger.info(`Scraping genérico encontró ${expedientesGenericos.length} posibles expedientes`);
      return expedientesGenericos;

    } catch (error) {
      logger.error('Error en scraping genérico:', error);
      return [];
    }
  }

  /**
   * Compara expedientes detectados con el estado anterior
   */
  private async compararConEstadoAnterior(expedientesDetectados: ExpedienteDetectado[]): Promise<ExpedienteDetectado[]> {
    try {
      const nuevasNotificaciones: ExpedienteDetectado[] = [];

      for (const expediente of expedientesDetectados) {
        if (expediente.tieneNotificacion) {
          const expedienteAnterior = await this.db.getExpedienteByNumero(expediente.numero);
          
          if (!expedienteAnterior) {
            // Expediente nuevo con notificación
            nuevasNotificaciones.push(expediente);
            logger.info(`🆕 Nueva notificación en expediente nuevo: ${expediente.numero}`);
          } else if (!expedienteAnterior.tieneNotificacion) {
            // Expediente existente que ahora tiene notificación
            nuevasNotificaciones.push(expediente);  
            logger.info(`🔔 Nueva notificación en expediente existente: ${expediente.numero}`);
          } else if (expedienteAnterior.notificacionEnviada) {
            // Podría ser una nueva notificación en un expediente que ya tenía notificaciones
            // Por ahora lo consideramos como nueva notificación
            nuevasNotificaciones.push(expediente);
            logger.info(`🔄 Posible nueva notificación en expediente: ${expediente.numero}`);
          }
        }
      }

      return nuevasNotificaciones;

    } catch (error) {
      logger.error('Error al comparar con estado anterior:', error);
      return [];
    }
  }

  /**
   * Actualiza el estado de los expedientes en la base de datos
   */
  private async actualizarEstadoExpedientes(expedientes: ExpedienteDetectado[]): Promise<void> {
    try {
      const ahora = new Date();

      for (const exp of expedientes) {
        const expedienteDB: Expediente = {
          id: uuidv4(),
          numero: exp.numero,
          caratula: exp.caratula,
          tieneNotificacion: exp.tieneNotificacion,
          ultimaVerificacion: ahora,
          notificacionEnviada: false,
          fechaNotificacion: exp.tieneNotificacion ? ahora : undefined,
          detallesNotificacion: exp.elementoNotificacion
        };

        // Verificar si ya existe
        const existente = await this.db.getExpedienteByNumero(exp.numero);
        if (existente) {
          expedienteDB.id = existente.id;
          // Mantener el estado de notificación enviada si no hay nueva notificación
          if (!exp.tieneNotificacion || existente.tieneNotificacion) {
            expedienteDB.notificacionEnviada = existente.notificacionEnviada;
          }
        }

        await this.db.saveExpediente(expedienteDB);
      }

      logger.info(`Estado actualizado para ${expedientes.length} expedientes`);

    } catch (error) {
      logger.error('Error al actualizar estado de expedientes:', error);
      throw error;
    }
  }

  /**
   * Obtiene expedientes con notificaciones pendientes de enviar
   */
  async getNotificacionesPendientes(): Promise<Expediente[]> {
    try {
      return await this.db.getExpedientesConNotificacionesPendientes();
    } catch (error) {
      logger.error('Error al obtener notificaciones pendientes:', error);
      return [];
    }
  }

  /**
   * Marca una notificación como enviada
   */
  async marcarNotificacionEnviada(expedienteId: string): Promise<void> {
    try {
      await this.db.marcarNotificacionEnviada(expedienteId);
    } catch (error) {
      logger.error('Error al marcar notificación como enviada:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas del scraper
   */
  async getEstadisticas(): Promise<{
    totalExpedientes: number;
    expedientesConNotificaciones: number;  
    notificacionesPendientes: number;
    notificacionesEnviadas: number;
  }> {
    try {
      return await this.db.getEstadisticas();
    } catch (error) {
      logger.error('Error al obtener estadísticas:', error);
      return {
        totalExpedientes: 0,
        expedientesConNotificaciones: 0,
        notificacionesPendientes: 0,
        notificacionesEnviadas: 0
      };
    }
  }

  // Funcionalidad de descarga de PDFs removida por problemas de compatibilidad
  async descargarPDFNotificacion(expediente: any): Promise<string | null> {
    return null;
  }

  /**
   * Limpia recursos
   */
  async cleanup(): Promise<void> {
    try {
      await this.auth.cleanup();
      await this.db.close();
      logger.info('Recursos del NotificationScraper liberados');
    } catch (error) {
      logger.warn('Error al limpiar recursos del scraper:', error);
    }
  }
}