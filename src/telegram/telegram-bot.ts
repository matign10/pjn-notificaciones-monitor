import { Telegraf, Context } from 'telegraf';
import { config, logger } from '../config';
import { Expediente } from '../database/database';
// import fs from 'fs/promises'; // Removido con PDFs
// import path from 'path'; // Removido con PDFs
import dayjs from 'dayjs';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export interface NotificationMessage {
  expediente: string;
  caratula: string;
  fecha: Date;
  mensaje?: string;
  urgente?: boolean;
}

export interface TelegramSendResult {
  success: boolean;
  messageId?: number;
  error?: string;
}

export class TelegramBot {
  private bot: Telegraf;
  private config: TelegramConfig;
  private isInitialized: boolean = false;

  constructor(telegramConfig?: TelegramConfig) {
    this.config = telegramConfig || {
      botToken: config.telegram.botToken,
      chatId: config.telegram.chatId
    };

    this.bot = new Telegraf(this.config.botToken);
    this.configurarBot();
  }

  /**
   * Configura los comandos y handlers del bot
   */
  private configurarBot(): void {
    // Comando /start
    this.bot.start((ctx: Context) => {
      ctx.reply(`🏛️ PJN Notificaciones Monitor

¡Hola! Soy el bot que te mantendrá informado sobre nuevas notificaciones judiciales.

📋 Comandos disponibles:
/status - Ver estado del sistema
/estadisticas - Ver estadísticas de notificaciones  
/test - Enviar mensaje de prueba
/help - Mostrar esta ayuda

🔔 Te notificaré automáticamente cuando se detecten nuevas notificaciones en tus expedientes del PJN.`);
    });

    // Comando /help
    this.bot.help((ctx: Context) => {
      ctx.reply(`📚 Ayuda - PJN Monitor

🤖 Este bot monitorea automáticamente el Portal PJN y te envía alertas cuando detecta nuevas notificaciones judiciales.

📋 Comandos:
/start - Iniciar el bot
/status - Estado del monitoreo
/estadisticas - Ver estadísticas
/test - Mensaje de prueba
/help - Esta ayuda

⚙️ Configuración:
El bot verifica notificaciones cada ${config.app.checkIntervalMinutes} minutos automáticamente.

🆘 Soporte:
Si tienes problemas, revisa los logs del sistema o contacta al administrador.`);
    });

    // Comando /status
    this.bot.command('status', (ctx: Context) => {
      ctx.reply(`📊 Estado del Sistema

🔄 Sistema: Activo
⏰ Última verificación: ${dayjs().format('DD/MM/YYYY HH:mm:ss')}
📅 Próxima verificación: En ${config.app.checkIntervalMinutes} minutos
🏛️ Portal PJN: Monitoreando

✅ Bot funcionando correctamente`);
    });

    // Comando /test
    this.bot.command('test', async (ctx: Context) => {
      try {
        const mensajePrueba = this.formatearMensajeNotificacion({
          expediente: 'TEST-2024-001',
          caratula: 'PRUEBA DE FUNCIONAMIENTO DEL BOT - TEST',
          fecha: new Date(),
          mensaje: 'Este es un mensaje de prueba para verificar que el bot funciona correctamente.',
          urgente: false
        });

        await ctx.reply(mensajePrueba, { parse_mode: 'HTML' });
        
        logger.info(`Mensaje de prueba enviado al chat ${ctx.chat?.id}`);
        
      } catch (error) {
        logger.error('Error al enviar mensaje de prueba:', error);
        ctx.reply('❌ Error al enviar mensaje de prueba. Revisa los logs.');
      }
    });

    // Comando /estadisticas
    this.bot.command('estadisticas', (ctx: Context) => {
      ctx.reply(`📊 Estadísticas (Próximamente)

Esta función estará disponible en la próxima actualización.
Por ahora, puedes revisar los logs del sistema para ver la actividad.`);
    });

    // Manejo de errores
    this.bot.catch((err: any, ctx: Context) => {
      logger.error('Error en bot de Telegram:', err);
      ctx.reply('❌ Ha ocurrido un error. Por favor, intenta nuevamente.');
    });

    logger.info('Bot de Telegram configurado');
  }

  /**
   * Inicializa el bot de Telegram
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Inicializando bot de Telegram...');

      // Verificar que el bot funcione
      const botInfo = await this.bot.telegram.getMe();
      logger.info(`Bot conectado: @${botInfo.username} (${botInfo.first_name})`);

      // Verificar que el chat existe
      await this.verificarChat();

      this.isInitialized = true;
      logger.info('Bot de Telegram inicializado correctamente');

    } catch (error) {
      logger.error('Error al inicializar bot de Telegram:', error);
      throw error;
    }
  }

  /**
   * Verifica que el chat configurado sea válido
   */
  private async verificarChat(): Promise<void> {
    try {
      const chat = await this.bot.telegram.getChat(this.config.chatId);
      logger.info(`Chat verificado: ${chat.type} - ${chat.id}`);
    } catch (error) {
      logger.error(`Error al verificar chat ${this.config.chatId}:`, error);
      throw new Error(`Chat ID inválido: ${this.config.chatId}. Verifica que el bot tenga acceso al chat.`);
    }
  }

  /**
   * Envía una notificación sobre un expediente
   */
  async enviarNotificacion(notificacion: NotificationMessage): Promise<TelegramSendResult> {
    try {
      if (!this.isInitialized) {
        throw new Error('Bot no inicializado');
      }

      logger.info(`📤 Enviando notificación por Telegram: ${notificacion.expediente}`);

      const mensaje = this.formatearMensajeNotificacion(notificacion);

      // Enviar mensaje principal
      const mensajeEnviado = await this.bot.telegram.sendMessage(
        this.config.chatId,
        mensaje,
        { 
          parse_mode: 'HTML'
        }
      );

      // Funcionalidad de PDFs removida

      logger.info(`✅ Notificación enviada exitosamente. Message ID: ${mensajeEnviado.message_id}`);

      return {
        success: true,
        messageId: mensajeEnviado.message_id
      };

    } catch (error) {
      logger.error('Error al enviar notificación por Telegram:', error);
      return {
        success: false,
        error: (error as Error).toString()
      };
    }
  }

  // Funcionalidad de PDFs removida

  /**
   * Formatea el mensaje de notificación
   */
  private formatearMensajeNotificacion(notificacion: NotificationMessage): string {
    const icono = notificacion.urgente ? '🚨' : '🔔';
    const fecha = dayjs(notificacion.fecha).format('DD/MM/YYYY HH:mm');
    
    let mensaje = `${icono} <b>NUEVA NOTIFICACIÓN JUDICIAL</b>

📋 <b>Expediente:</b> <code>${notificacion.expediente}</code>
📄 <b>Carátula:</b> ${this.escaparHTML(notificacion.caratula)}
📅 <b>Fecha:</b> ${fecha}`;


    // Funcionalidad de PDFs removida

    mensaje += `\n\n🤖 <i>Notificación generada automáticamente por PJN Monitor</i>`;

    if (notificacion.urgente) {
      mensaje += `\n\n⚠️ <b>ATENCIÓN: Notificación marcada como urgente</b>`;
    }

    return mensaje;
  }

  /**
   * Escapa caracteres HTML para Telegram
   */
  private escaparHTML(texto: string): string {
    return texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Funcionalidad de PDFs removida

  /**
   * Formatea el tamaño de archivo en formato legible
   */
  private formatearTamano(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Envía un resumen de notificaciones
   */
  async enviarResumen(expedientes: Expediente[]): Promise<TelegramSendResult> {
    try {
      if (!this.isInitialized) {
        throw new Error('Bot no inicializado');
      }

      if (expedientes.length === 0) {
        const mensaje = `📊 <b>Resumen de Verificación</b>

✅ <b>Sistema operativo</b>
🔍 <b>Última verificación:</b> ${dayjs().format('DD/MM/YYYY HH:mm')}
📋 <b>Resultado:</b> No se encontraron nuevas notificaciones

🤖 <i>El monitoreo continúa activo</i>`;

        const mensajeEnviado = await this.bot.telegram.sendMessage(
          this.config.chatId,
          mensaje,
          { parse_mode: 'HTML' }
        );

        return {
          success: true,
          messageId: mensajeEnviado.message_id
        };
      }

      const mensaje = `📊 <b>RESUMEN DE NOTIFICACIONES</b>

🔔 <b>Nuevas notificaciones encontradas:</b> ${expedientes.length}
📅 <b>Fecha:</b> ${dayjs().format('DD/MM/YYYY HH:mm')}

📋 <b>Expedientes:</b>
${expedientes.map((exp, index) => 
  `${index + 1}. <code>${exp.numero}</code>\n   ${this.escaparHTML(exp.caratula.substring(0, 80))}...`
).join('\n\n')}

🤖 <i>Monitoreo de notificaciones activo</i>`;

      const mensajeEnviado = await this.bot.telegram.sendMessage(
        this.config.chatId,
        mensaje,
        { parse_mode: 'HTML' }
      );

      return {
        success: true,
        messageId: mensajeEnviado.message_id
      };

    } catch (error) {
      logger.error('Error al enviar resumen por Telegram:', error);
      return {
        success: false,
        error: (error as Error).toString()
      };
    }
  }

  /**
   * Envía un mensaje de estado del sistema
   */
  async enviarEstadoSistema(estadisticas: {
    totalExpedientes: number;
    expedientesConNotificaciones: number;
    notificacionesPendientes: number;
    notificacionesEnviadas: number;
  }): Promise<TelegramSendResult> {
    try {
      const mensaje = `📊 <b>ESTADO DEL SISTEMA PJN MONITOR</b>

🔄 <b>Sistema:</b> Operativo
📅 <b>Último reporte:</b> ${dayjs().format('DD/MM/YYYY HH:mm:ss')}

📊 <b>Estadísticas:</b>
📋 Expedientes monitoreados: ${estadisticas.totalExpedientes}
🔔 Con notificaciones: ${estadisticas.expedientesConNotificaciones}
📤 Pendientes de envío: ${estadisticas.notificacionesPendientes}
✅ Enviadas: ${estadisticas.notificacionesEnviadas}

⏰ <b>Próxima verificación:</b> En ${config.app.checkIntervalMinutes} minutos

🤖 <i>Monitoreo automático activo</i>`;

      const mensajeEnviado = await this.bot.telegram.sendMessage(
        this.config.chatId,
        mensaje,
        { parse_mode: 'HTML' }
      );

      return {
        success: true,
        messageId: mensajeEnviado.message_id
      };

    } catch (error) {
      logger.error('Error al enviar estado del sistema:', error);
      return {
        success: false,
        error: (error as Error).toString()
      };
    }
  }

  /**
   * Envía un mensaje de error crítico
   */
  async enviarErrorCritico(error: string, contexto?: string): Promise<TelegramSendResult> {
    try {
      const mensaje = `🚨 <b>ERROR CRÍTICO - PJN MONITOR</b>

❌ <b>Error:</b> ${this.escaparHTML(error)}
📅 <b>Timestamp:</b> ${dayjs().format('DD/MM/YYYY HH:mm:ss')}
${contexto ? `🔍 <b>Contexto:</b> ${this.escaparHTML(contexto)}` : ''}

⚠️ <b>El monitoreo puede estar interrumpido</b>
🔧 <b>Acción requerida:</b> Revisar logs y reiniciar sistema si es necesario

🤖 <i>Mensaje automático del sistema</i>`;

      const mensajeEnviado = await this.bot.telegram.sendMessage(
        this.config.chatId,
        mensaje,
        { parse_mode: 'HTML' }
      );

      return {
        success: true,
        messageId: mensajeEnviado.message_id
      };

    } catch (telegramError) {
      logger.error('Error al enviar error crítico por Telegram:', telegramError);
      return {
        success: false,
        error: (telegramError as Error).toString()
      };
    }
  }

  /**
   * Prueba la conectividad del bot
   */
  async probarConectividad(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Enviar mensaje de prueba
      const mensaje = `🧪 <b>Test de Conectividad</b>

✅ Bot funcionando correctamente
📅 ${dayjs().format('DD/MM/YYYY HH:mm:ss')}

🤖 <i>Este es un mensaje de prueba automático</i>`;

      await this.bot.telegram.sendMessage(
        this.config.chatId,
        mensaje,
        { parse_mode: 'HTML' }
      );

      logger.info('✅ Test de conectividad de Telegram exitoso');
      return true;

    } catch (error) {
      logger.error('❌ Test de conectividad de Telegram falló:', error);
      return false;
    }
  }

  /**
   * Inicia el bot en modo webhook o polling (para comandos interactivos)
   */
  async iniciarBot(): Promise<void> {
    try {
      logger.info('Iniciando bot de Telegram en modo polling...');
      
      // Para desarrollo/testing, usar polling
      this.bot.launch();

      logger.info('✅ Bot de Telegram iniciado y escuchando comandos');

    } catch (error) {
      logger.error('Error al iniciar bot de Telegram:', error);
      throw error;
    }
  }

  /**
   * Detiene el bot
   */
  async detenerBot(): Promise<void> {
    try {
      this.bot.stop();
      logger.info('Bot de Telegram detenido');
    } catch (error) {
      logger.error('Error al detener bot de Telegram:', error);
    }
  }

  /**
   * Verifica el estado del bot
   */
  isActive(): boolean {
    return this.isInitialized;
  }
}