import { BrowserContext, chromium, Browser, Page } from 'playwright';
import { config, logger } from '../config';
import fs from 'fs/promises';
import path from 'path';

export interface PJNAuthConfig {
  username: string;
  password: string;
  loginUrl: string;
  portalUrl: string;
  cookiesPath?: string;
  headless?: boolean;
}

export class PJNAuth {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: PJNAuthConfig;
  private cookiesPath: string;

  constructor(authConfig: PJNAuthConfig) {
    this.config = authConfig;
    this.cookiesPath = authConfig.cookiesPath || 
      path.join(config.app.dataDir, 'cookies', 'session.json');
  }

  /**
   * Inicializa el navegador y contexto
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Inicializando navegador para autenticación PJN...');
      
      this.browser = await chromium.launch({
        headless: this.config.headless ?? config.app.headlessMode,
        slowMo: 500, // Más lento para parecer humano
        args: [
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled', // Ocultar que es automatizado
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--start-maximized'
        ]
      });

      // Crear contexto con configuración más realista
      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0', // Edge user agent como el que funciona
        viewport: { width: 1920, height: 1080 }, // Resolución más común
        locale: 'es-AR',
        timezoneId: 'America/Argentina/Buenos_Aires',
        acceptDownloads: true,
        ignoreHTTPSErrors: true,
        extraHTTPHeaders: {
          'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8'
        }
      });

      // Cargar cookies si existen
      await this.loadCookies();

      this.page = await this.context.newPage();
      
      // Ocultar que es un navegador automatizado
      await this.page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
        Object.defineProperty(navigator, 'languages', {
          get: () => ['es-AR', 'es', 'en'],
        });
      });
      
      logger.info('Navegador inicializado correctamente');

    } catch (error) {
      logger.error('Error al inicializar navegador:', error);
      throw error;
    }
  }

  /**
   * Verifica si la sesión actual es válida
   */
  async isSessionValid(): Promise<boolean> {
    try {
      if (!this.page) {
        return false;
      }

      logger.info('Verificando validez de la sesión...');
      
      // Intentar acceder al portal directamente
      const response = await this.page.goto(this.config.portalUrl, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      if (!response || !response.ok()) {
        logger.warn('No se pudo acceder al portal');
        return false;
      }

      // Verificar si estamos en la página de login (indica sesión expirada)
      const currentUrl = this.page.url();
      const isLoginPage = currentUrl.includes('sso.pjn.gov.ar') && 
                         currentUrl.includes('auth');

      if (isLoginPage) {
        logger.info('Sesión expirada, requiere re-autenticación');
        return false;
      }

      // Verificar elementos del portal que indican sesión activa
      const isPortalLoaded = await this.page.locator('body').isVisible();
      
      if (isPortalLoaded) {
        logger.info('Sesión válida confirmada');
        return true;
      }

      return false;

    } catch (error) {
      logger.warn('Error al verificar sesión:', error);
      return false;
    }
  }

  /**
   * Realiza el login en el sistema PJN
   */
  async login(): Promise<boolean> {
    try {
      if (!this.page) {
        throw new Error('Navegador no inicializado');
      }

      logger.info('Iniciando proceso de login PJN...');

      // Navegar a la URL de login con parámetros completos
      const loginUrlWithParams = `${this.config.loginUrl}?client_id=pjn-portal&redirect_uri=${encodeURIComponent(this.config.portalUrl)}&response_type=code&scope=openid`;
      
      await this.page.goto(loginUrlWithParams, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Tomar screenshot para debugging
      await this.page.screenshot({ 
        path: path.join(config.app.dataDir, 'login-page.png'),
        fullPage: true 
      });

      // Esperar a que aparezca el formulario de login
      await this.page.waitForSelector('input[name="username"], input[id="username"]', { 
        timeout: 10000 
      });

      // Simular comportamiento humano más realista
      await this.page.waitForTimeout(2000); // Pausa inicial

      // Llenar formulario de login de forma más humana
      const usernameSelector = await this.page.locator('input[name="username"], input[id="username"]').first();
      const passwordSelector = await this.page.locator('input[name="password"], input[id="password"]').first();
      
      // Click en el campo usuario y escribir lentamente
      await usernameSelector.click();
      await this.page.waitForTimeout(800);
      await usernameSelector.clear();
      await this.page.waitForTimeout(300);
      await usernameSelector.type(this.config.username, { delay: 150 }); // Más lento
      
      await this.page.waitForTimeout(1500); // Pausa más larga entre campos
      
      // Click en el campo contraseña con estrategia especial para caracteres especiales
      await passwordSelector.click();
      await this.page.waitForTimeout(800);
      await passwordSelector.clear();
      await this.page.waitForTimeout(500);
      
      logger.info('Iniciando escritura de contraseña...');
      
      // Investigar propiedades del campo de contraseña
      const passwordInfo = await passwordSelector.evaluate(el => {
        const input = el as HTMLInputElement;
        return {
          maxLength: input.maxLength,
          type: input.type,
          pattern: input.pattern,
          autocomplete: input.autocomplete,
          name: input.name,
          id: input.id,
          className: input.className
        };
      });
      
      logger.info('Propiedades del campo contraseña:', passwordInfo);
      
      // Captura antes de escribir contraseña
      await this.page.screenshot({ 
        path: path.join(config.app.dataDir, 'paso1-antes-password.png'),
        fullPage: true 
      });
      
      // Método alternativo: usar fill() que es más directo
      try {
        await passwordSelector.fill(this.config.password);
        logger.info('Contraseña establecida con fill()');
      } catch (error) {
        logger.warn('fill() falló, intentando type() caracter por caracter...');
        
        // Si fill falla, intentar caracter por caracter con manejo especial
        const password = this.config.password;
        for (let i = 0; i < password.length; i++) {
          const char = password[i];
          logger.info(`Escribiendo caracter ${i + 1}/${password.length}: ${char === '&' ? '&' : char === '#' ? '#' : char === '$' ? '$' : char}`);
          
          await passwordSelector.type(char, { delay: 300 });
          await this.page.waitForTimeout(100); // Pausa entre caracteres
          
          // Verificar que se escribió correctamente
          const currentValue = await passwordSelector.inputValue();
          if (currentValue.length !== i + 1) {
            logger.warn(`Caracter ${i + 1} no se escribió correctamente. Valor actual: ${currentValue.length} caracteres`);
          }
        }
      }
      
      // Captura después de escribir contraseña
      await this.page.screenshot({ 
        path: path.join(config.app.dataDir, 'paso2-despues-password.png'),
        fullPage: true 
      });
      
      // Verificar valor final
      const finalValue = await passwordSelector.inputValue();
      logger.info(`Contraseña final: ${finalValue.length} caracteres (esperados: ${this.config.password.length})`);
      
      // Si aún no se escribió completa, método de emergencia con JavaScript
      if (finalValue.length !== this.config.password.length) {
        logger.warn('Contraseña incompleta, usando método de emergencia con JavaScript...');
        
        await passwordSelector.evaluate((element, password) => {
          (element as HTMLInputElement).value = password;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }, this.config.password);
        
        // Verificar otra vez
        const emergencyValue = await passwordSelector.inputValue();
        logger.info(`Contraseña con método de emergencia: ${emergencyValue.length} caracteres`);
        
        // Captura después del método de emergencia
        await this.page.screenshot({ 
          path: path.join(config.app.dataDir, 'paso3-emergencia.png'),
          fullPage: true 
        });
      }
      
      logger.info('Contraseña completada');

      await this.page.waitForTimeout(2000); // Pausa más larga antes de enviar

      logger.info('Credenciales ingresadas, enviando formulario...');

      // Buscar y hacer click en el botón de submit
      const submitButton = this.page.locator('button[type="submit"], input[type="submit"], button:has-text("Ingresar"), button:has-text("Iniciar")').first();
      
      // Verificar que el botón esté visible antes de hacer click
      await submitButton.waitFor({ state: 'visible', timeout: 5000 });
      
      // Hacer click más humano
      await submitButton.click();
      await this.page.waitForTimeout(2000); // Más tiempo después del click
      
      logger.info('Botón de login clickeado, esperando respuesta...');
      
      // Esperar respuesta del servidor sin depender de navegación
      await this.page.waitForTimeout(15000); // Esperar 15 segundos fijos
      
      // Verificar si el login fue exitoso
      const currentUrl = this.page.url();
      logger.info(`URL después del login: ${currentUrl}`);

      // Si seguimos en la página de login, probablemente hubo un error
      if (currentUrl.includes('sso.pjn.gov.ar') && currentUrl.includes('auth')) {
        // Verificar si hay mensajes de error
        const errorMessage = await this.page.locator('.alert-danger, .error, .invalid-credentials').first().textContent().catch(() => null);
        
        if (errorMessage) {
          logger.error(`Error de login: ${errorMessage}`);
          return false;
        }
        
        logger.warn('Aún en página de login, verificando...');
        await this.page.waitForTimeout(3000);
        
        // Verificar de nuevo la URL
        if (this.page.url().includes('sso.pjn.gov.ar')) {
          logger.error('Login falló - credenciales incorrectas o error del servidor');
          return false;
        }
      }

      // Si llegamos al portal, el login fue exitoso
      if (currentUrl.includes('portalpjn.pjn.gov.ar')) {
        logger.info('Login exitoso - redirigido al portal');
        
        // Guardar cookies para futuras sesiones
        await this.saveCookies();
        
        return true;
      }

      // Si no estamos en el portal, intentar navegar directamente
      if (!currentUrl.includes('portalpjn.pjn.gov.ar')) {
        logger.info('Navegando directamente al portal...');
        try {
          await this.page.goto(this.config.portalUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await this.page.waitForTimeout(5000);
          
          const portalUrl = this.page.url();
          if (portalUrl.includes('portalpjn.pjn.gov.ar')) {
            logger.info('Navegación directa al portal exitosa');
            await this.saveCookies();
            return true;
          }
        } catch (error) {
          logger.warn('Error navegando al portal:', error);
        }
      }

      // Último intento de verificación
      logger.info('Verificando estado final del login...');
      await this.page.waitForTimeout(2000);
      
      const finalUrl = this.page.url();
      const loginSuccess = finalUrl.includes('portalpjn.pjn.gov.ar') || 
                          !finalUrl.includes('sso.pjn.gov.ar');
      
      if (loginSuccess) {
        await this.saveCookies();
        logger.info('Login completado exitosamente');
        return true;
      }

      logger.error('Login falló - no se pudo acceder al portal');
      return false;

    } catch (error) {
      logger.error('Error durante el proceso de login:', error);
      
      // Guardar screenshot de error para debugging
      if (this.page) {
        await this.page.screenshot({ 
          path: path.join(config.app.dataDir, 'login-error.png'),
          fullPage: true 
        }).catch(() => {});
      }
      
      return false;
    }
  }

  /**
   * Obtiene una página autenticada lista para usar
   */
  async getAuthenticatedPage(): Promise<Page | null> {
    try {
      // Verificar si tenemos una sesión válida
      if (await this.isSessionValid()) {
        logger.info('Sesión válida existente');
        return this.page;
      }

      // Si no hay sesión válida, intentar login
      logger.info('Sesión no válida, intentando login...');
      const loginSuccess = await this.login();
      
      if (!loginSuccess) {
        logger.error('No se pudo establecer sesión autenticada');
        return null;
      }

      return this.page;

    } catch (error) {
      logger.error('Error al obtener página autenticada:', error);
      return null;
    }
  }

  /**
   * Navega al portal principal
   */
  async navigateToPortal(): Promise<boolean> {
    try {
      if (!this.page) {
        logger.error('No hay página disponible');
        return false;
      }

      logger.info('Navegando al portal principal...');
      
      const response = await this.page.goto(this.config.portalUrl, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      if (!response || !response.ok()) {
        logger.error('Error al navegar al portal');
        return false;
      }

      // Verificar que efectivamente estamos en el portal
      const currentUrl = this.page.url();
      if (!currentUrl.includes('portalpjn.pjn.gov.ar')) {
        logger.error('No se pudo acceder al portal - posible redirección a login');
        return false;
      }

      logger.info('Navegación al portal exitosa');
      return true;

    } catch (error) {
      logger.error('Error al navegar al portal:', error);
      return false;
    }
  }

  /**
   * Carga cookies desde el archivo
   */
  private async loadCookies(): Promise<void> {
    try {
      const cookiesExist = await fs.access(this.cookiesPath).then(() => true).catch(() => false);
      
      if (!cookiesExist) {
        logger.info('No se encontraron cookies guardadas');
        return;
      }

      const cookiesData = await fs.readFile(this.cookiesPath, 'utf-8');
      const cookies = JSON.parse(cookiesData);
      
      if (this.context && cookies.length > 0) {
        await this.context.addCookies(cookies);
        logger.info(`Cookies cargadas: ${cookies.length} elementos`);
      }

    } catch (error) {
      logger.warn('Error al cargar cookies:', error);
    }
  }

  /**
   * Guarda cookies en el archivo
   */
  private async saveCookies(): Promise<void> {
    try {
      if (!this.context) {
        return;
      }

      const cookies = await this.context.cookies();
      
      // Crear directorio si no existe
      const cookiesDir = path.dirname(this.cookiesPath);
      await fs.mkdir(cookiesDir, { recursive: true });
      
      await fs.writeFile(this.cookiesPath, JSON.stringify(cookies, null, 2));
      logger.info(`Cookies guardadas: ${cookies.length} elementos`);

    } catch (error) {
      logger.warn('Error al guardar cookies:', error);
    }
  }

  /**
   * Obtiene la página actual
   */
  getPage(): Page | null {
    return this.page;
  }

  /**
   * Establece una nueva página actual (útil para cambiar a nuevas pestañas)
   */
  async setPage(newPage: Page): Promise<void> {
    this.page = newPage;
  }

  /**
   * Cierra el navegador y limpia recursos
   */
  async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }

      if (this.context) {
        await this.context.close();
        this.context = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      logger.info('Recursos de autenticación liberados');

    } catch (error) {
      logger.warn('Error al limpiar recursos:', error);
    }
  }
}