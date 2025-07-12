import { NotificationScraper } from '../scraper/notification-scraper';
// import { PDFGenerator } from '../pdf/pdf-generator'; // Removido
import { TelegramBot } from '../telegram/telegram-bot';
import { PJNDatabase } from '../database/database';
import { config, logger } from '../config';
import { PJNAuth } from '../auth/pjn-auth';
import * as cron from 'node-cron';
import dayjs from 'dayjs';

export interface MonitorConfig {
  checkInterval: string; // Cron expression
  enableTelegramNotifications: boolean;
  maxRetries: number;
  retryDelay: number; // milliseconds
}

export interface MonitorStatus {
  isRunning: boolean;
  lastCheck: Date | null;
  nextCheck: Date | null;
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  lastError: string | null;
}

export interface VerificationResult {
  success: boolean;
  timestamp: Date;
  expedientesEncontrados: number;
  nuevasNotificaciones: number;
  notificacionesEnviadas: number;
  errores: string[];
  duracion: number; // milliseconds
}

export class PJNMonitor {
  private scraper: NotificationScraper;
  private telegramBot: TelegramBot;
  private db: PJNDatabase;
  private auth: PJNAuth;
  
  private config: MonitorConfig;
  private status: MonitorStatus;
  private cronJob: cron.ScheduledTask | null = null;
  private isVerifying: boolean = false;

  constructor(monitorConfig?: Partial<MonitorConfig>) {
    this.config = {
      checkInterval: `*/${config.app.checkIntervalMinutes} * * * *`,
      enableTelegramNotifications: true,
      maxRetries: 3,
      retryDelay: 30000, // 30 seconds
      ...monitorConfig
    };

    this.status = {
      isRunning: false,
      lastCheck: null,
      nextCheck: null,
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      lastError: null
    };

    // Inicializar componentes
    this.auth = new PJNAuth({
      username: config.pjn.username,
      password: config.pjn.password,
      loginUrl: config.pjn.loginUrl,
      portalUrl: config.pjn.portalUrl,
      headless: config.app.headlessMode
    });

    this.scraper = new NotificationScraper();
    this.telegramBot = new TelegramBot();
    this.db = new PJNDatabase();
  }

  /**
   * Inicializa el monitor completo
   */
  async initialize(): Promise<void> {
    try {
      logger.info('🚀 Inicializando PJN Monitor completo...');

      // Inicializar base de datos
      logger.info('💾 Inicializando base de datos...');
      await this.db.initialize();

      // Inicializar autenticación
      logger.info('🔑 Inicializando autenticación...');
      await this.auth.initialize();

      // Inicializar scraper
      logger.info('🔍 Inicializando scraper...');
      await this.scraper.initialize();

      // Funcionalidad de PDFs removida

      // Inicializar bot de Telegram
      if (this.config.enableTelegramNotifications) {
        logger.info('📱 Inicializando bot de Telegram...');
        await this.telegramBot.initialize();
        
        // Enviar mensaje de inicio
        await this.telegramBot.enviarEstadoSistema({
          totalExpedientes: 0,
          expedientesConNotificaciones: 0,
          notificacionesPendientes: 0,
          notificacionesEnviadas: 0
        });
      }

      logger.info('✅ PJN Monitor inicializado completamente');

    } catch (error) {
      logger.error('💥 Error al inicializar PJN Monitor:', error);
      throw error;
    }
  }

  /**
   * Inicia el monitoreo programado
   */
  async iniciarMonitoreo(): Promise<void> {
    try {
      if (this.status.isRunning) {
        logger.warn('⚠️ El monitoreo ya está en ejecución');
        return;
      }

      logger.info(`⏰ Iniciando monitoreo programado: ${this.config.checkInterval}`);

      // Verificar expresión cron
      if (!cron.validate(this.config.checkInterval)) {
        throw new Error(`Expresión cron inválida: ${this.config.checkInterval}`);
      }

      // Crear tarea programada
      this.cronJob = cron.schedule(this.config.checkInterval, async () => {
        await this.ejecutarVerificacion();
      }, {
        scheduled: false,
        timezone: 'America/Argentina/Buenos_Aires'
      });

      // Calcular próxima ejecución
      this.calcularProximaEjecucion();

      // Iniciar la tarea
      this.cronJob.start();
      this.status.isRunning = true;

      logger.info(`✅ Monitoreo iniciado. Próxima verificación: ${dayjs(this.status.nextCheck).format('DD/MM/YYYY HH:mm:ss')}`);

      // Ejecutar verificación inicial inmediatamente
      logger.info('🔍 Ejecutando verificación inicial...');
      await this.ejecutarVerificacion();

    } catch (error) {
      logger.error('💥 Error al iniciar monitoreo:', error);
      throw error;
    }
  }

  /**
   * Detiene el monitoreo programado
   */
  async detenerMonitoreo(): Promise<void> {
    try {
      if (!this.status.isRunning) {
        logger.warn('⚠️ El monitoreo no está en ejecución');
        return;
      }

      logger.info('🛑 Deteniendo monitoreo...');

      if (this.cronJob) {
        this.cronJob.stop();
        this.cronJob = null;
      }

      this.status.isRunning = false;
      this.status.nextCheck = null;

      // Notificar por Telegram si está configurado
      if (this.config.enableTelegramNotifications) {
        await this.telegramBot.enviarErrorCritico(
          'Monitoreo detenido manualmente',
          'El sistema de monitoreo ha sido detenido'
        );
      }

      logger.info('✅ Monitoreo detenido');

    } catch (error) {
      logger.error('Error al detener monitoreo:', error);
    }
  }

  /**
   * Ejecuta una verificación completa
   */
  async ejecutarVerificacion(): Promise<VerificationResult> {
    if (this.isVerifying) {
      logger.warn('⚠️ Verificación ya en progreso, saltando...');
      return this.crearResultadoError('Verificación ya en progreso');
    }

    const inicioVerificacion = Date.now();
    this.isVerifying = true;

    const resultado: VerificationResult = {
      success: false,
      timestamp: new Date(),
      expedientesEncontrados: 0,
      nuevasNotificaciones: 0,
      notificacionesEnviadas: 0,
      errores: [],
      duracion: 0
    };

    try {
      logger.info('🔍 === INICIANDO VERIFICACIÓN PROGRAMADA ===');
      this.status.totalChecks++;
      this.status.lastCheck = new Date();

      // 1. Ejecutar scraping
      logger.info('📋 Ejecutando scraping de notificaciones...');
      const resultadoScraping = await this.scraper.ejecutarScraping();
      
      resultado.expedientesEncontrados = resultadoScraping.expedientesEncontrados.length;
      resultado.nuevasNotificaciones = resultadoScraping.nuevasNotificaciones.length;
      resultado.errores.push(...resultadoScraping.errores);

      if (resultadoScraping.errores.length > 0) {
        logger.warn(`⚠️ Errores durante scraping: ${resultadoScraping.errores.length}`);
      }

      // 2. Procesar nuevas notificaciones
      if (resultadoScraping.nuevasNotificaciones.length > 0) {
        logger.info(`🆕 Procesando ${resultadoScraping.nuevasNotificaciones.length} nuevas notificaciones...`);

        for (const notificacion of resultadoScraping.nuevasNotificaciones) {
          await this.procesarNotificacion(notificacion, resultado);
        }

        // Resumen por Telegram deshabilitado - solo enviar notificaciones individuales
        // if (this.config.enableTelegramNotifications && resultado.notificacionesEnviadas > 0) {
        //   await this.enviarResumenNotificaciones(resultadoScraping.nuevasNotificaciones);
        // }

      } else {
        logger.info('✅ No se encontraron nuevas notificaciones');
      }

      // 3. Obtener estadísticas finales
      const estadisticas = await this.scraper.getEstadisticas();
      
      logger.info(`📊 Estadísticas: ${estadisticas.totalExpedientes} expedientes, ${estadisticas.expedientesConNotificaciones} con notificaciones`);

      // 4. Enviar estado del sistema solo si hay notificaciones nuevas
      if (this.config.enableTelegramNotifications && resultado.notificacionesEnviadas > 0) {
        await this.telegramBot.enviarEstadoSistema({
          totalExpedientes: estadisticas.totalExpedientes,
          expedientesConNotificaciones: estadisticas.expedientesConNotificaciones,
          notificacionesPendientes: estadisticas.notificacionesPendientes,
          notificacionesEnviadas: estadisticas.notificacionesEnviadas
        });
      }

      // 5. Marcar como exitosa
      resultado.success = true;
      this.status.successfulChecks++;
      this.status.lastError = null;

      logger.info(`✅ === VERIFICACIÓN COMPLETADA EXITOSAMENTE ===`);

    } catch (error) {
      const errorMsg = `Error durante verificación: ${error}`;
      logger.error(`💥 ${errorMsg}`);
      
      resultado.errores.push(errorMsg);
      this.status.failedChecks++;
      this.status.lastError = errorMsg;

      // Notificar error crítico por Telegram
      if (this.config.enableTelegramNotifications) {
        await this.telegramBot.enviarErrorCritico(
          errorMsg,
          'Error durante verificación programada'
        ).catch(telegramError => {
          logger.error('Error al enviar notificación de error por Telegram:', telegramError);
        });
      }

    } finally {
      resultado.duracion = Date.now() - inicioVerificacion;
      this.isVerifying = false;
      this.calcularProximaEjecucion();

      logger.info(`⏱️ Verificación completada en ${resultado.duracion}ms`);
    }

    return resultado;
  }

  /**
   * Procesa una notificación individual
   */
  private async procesarNotificacion(
    notificacion: any,
    resultado: VerificationResult
  ): Promise<void> {
    try {
      logger.info(`📤 Procesando notificación: ${notificacion.numero}`);

      // Buscar expediente en la base de datos
      const expediente = await this.db.getExpedienteByNumero(notificacion.numero);
      if (!expediente) {
        logger.warn(`⚠️ Expediente no encontrado en BD: ${notificacion.numero}`);
        return;
      }

      // Funcionalidad de PDFs removida

      // Enviar notificación por Telegram si está habilitado
      if (this.config.enableTelegramNotifications) {
        logger.info(`📱 Enviando notificación por Telegram: ${expediente.numero}`);

        const mensajeTelegram = {
          expediente: expediente.numero,
          caratula: expediente.caratula,
          fecha: expediente.fechaNotificacion || new Date(),
          mensaje: expediente.detallesNotificacion,
          urgente: false
        };

        const resultadoTelegram = await this.telegramBot.enviarNotificacion(mensajeTelegram);
        
        if (resultadoTelegram.success) {
          resultado.notificacionesEnviadas++;
          
          // Marcar como enviada en la base de datos
          await this.scraper.marcarNotificacionEnviada(expediente.id);
          
          logger.info(`✅ Notificación enviada por Telegram: ${expediente.numero}`);
        } else {
          logger.warn(`⚠️ Error al enviar por Telegram: ${resultadoTelegram.error}`);
          resultado.errores.push(`Error Telegram ${expediente.numero}: ${resultadoTelegram.error}`);
        }
      }

    } catch (error) {
      const errorMsg = `Error al procesar notificación ${notificacion.numero}: ${error}`;
      logger.error(errorMsg);
      resultado.errores.push(errorMsg);
    }
  }

  /**
   * Envía un resumen de las notificaciones procesadas
   */
  private async enviarResumenNotificaciones(notificaciones: any[]): Promise<void> {
    try {
      if (!this.config.enableTelegramNotifications) return;

      // Convertir a formato de expedientes para el resumen
      const expedientes = notificaciones.map(notif => ({
        id: '',
        numero: notif.numero,
        caratula: notif.caratula,
        tieneNotificacion: true,
        ultimaVerificacion: new Date(),
        notificacionEnviada: false
      }));

      await this.telegramBot.enviarResumen(expedientes);

    } catch (error) {
      logger.error('Error al enviar resumen por Telegram:', error);
    }
  }

  /**
   * Ejecuta una verificación manual inmediata
   */
  async ejecutarVerificacionManual(): Promise<VerificationResult> {
    logger.info('🔍 Ejecutando verificación manual...');
    return await this.ejecutarVerificacion();
  }

  /**
   * Calcula la próxima ejecución basada en la expresión cron
   */
  private calcularProximaEjecucion(): void {
    if (!this.cronJob) return;

    try {
      // Para simplificar, calcular basado en el intervalo en minutos
      const intervaloMinutos = config.app.checkIntervalMinutes;
      this.status.nextCheck = dayjs().add(intervaloMinutos, 'minute').toDate();
    } catch (error) {
      logger.warn('Error al calcular próxima ejecución:', error);
    }
  }

  /**
   * Crea un resultado de error
   */
  private crearResultadoError(mensaje: string): VerificationResult {
    return {
      success: false,
      timestamp: new Date(),
      expedientesEncontrados: 0,
      nuevasNotificaciones: 0,
      notificacionesEnviadas: 0,
      errores: [mensaje],
      duracion: 0
    };
  }

  /**
   * Obtiene el estado actual del monitor
   */
  getStatus(): MonitorStatus {
    return { ...this.status };
  }

  /**
   * Obtiene estadísticas del sistema
   */
  async getEstadisticas(): Promise<{
    monitor: MonitorStatus;
    scraper: any;
    pdfs: any;
  }> {
    try {
      const estadisticasScraper = await this.scraper.getEstadisticas();
      const estadisticasPDFs = { totalPDFs: 0, espacioUtilizado: 0 }; // PDFs removidos

      return {
        monitor: this.getStatus(),
        scraper: estadisticasScraper,
        pdfs: estadisticasPDFs
      };

    } catch (error) {
      logger.error('Error al obtener estadísticas:', error);
      throw error;
    }
  }

  /**
   * Limpia recursos y detiene el monitor
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('🛑 Cerrando PJN Monitor...');

      // Detener monitoreo
      await this.detenerMonitoreo();

      // Limpiar recursos
      await this.scraper.cleanup();
      await this.auth.cleanup();
      await this.db.close();

      // Detener bot de Telegram si está activo
      if (this.config.enableTelegramNotifications) {
        await this.telegramBot.detenerBot();
      }

      logger.info('✅ PJN Monitor cerrado correctamente');

    } catch (error) {
      logger.error('Error al cerrar PJN Monitor:', error);
    }
  }

  /**
   * Alias para shutdown() - para compatibilidad
   */
  async cleanup(): Promise<void> {
    await this.shutdown();
  }
}