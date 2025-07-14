import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config, logger } from '../config';
import { Expediente, Notificacion, PJNDatabase } from './database';

export class SupabaseDatabase implements PJNDatabase {
  private supabase: SupabaseClient;
  private initialized: boolean = false;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://jbhmbiasavvxrbgwoynf.supabase.co';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiaG1iaWFzYXZ2eHJiZ3dveW5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NTI5MzMsImV4cCI6MjA2ODAyODkzM30.RLIbejK7IY6_flHf5S8U8Ltamz6y0UdpqJIDBm1V-Eg';
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Inicializa la conexión a Supabase
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Inicializando conexión con Supabase...');
      
      // Verificar conexión
      const { error } = await this.supabase.from('expedientes').select('count').limit(1);
      if (error && error.code !== 'PGRST116') { // PGRST116 = tabla vacía, está OK
        throw error;
      }
      
      this.initialized = true;
      logger.info('Conexión con Supabase establecida correctamente');
    } catch (error) {
      logger.error('Error al conectar con Supabase:', error);
      throw error;
    }
  }

  /**
   * Guarda o actualiza un expediente
   */
  async saveExpediente(expediente: Expediente): Promise<void> {
    if (!this.initialized) throw new Error('Base de datos no inicializada');

    try {
      const data = {
        id: expediente.id,
        numero: expediente.numero,
        caratula: expediente.caratula,
        tiene_notificacion: expediente.tieneNotificacion,
        ultima_verificacion: expediente.ultimaVerificacion.toISOString(),
        notificacion_enviada: expediente.notificacionEnviada,
        fecha_notificacion: expediente.fechaNotificacion?.toISOString() || null,
        detalles_notificacion: expediente.detallesNotificacion || null,
        updated_at: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('expedientes')
        .upsert(data, { onConflict: 'id' });

      if (error) throw error;

    } catch (error) {
      logger.error('Error al guardar expediente:', error);
      throw error;
    }
  }

  /**
   * Obtiene un expediente por número
   */
  async getExpedienteByNumero(numero: string): Promise<Expediente | null> {
    if (!this.initialized) throw new Error('Base de datos no inicializada');

    try {
      const { data, error } = await this.supabase
        .from('expedientes')
        .select('*')
        .eq('numero', numero)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No encontrado
        throw error;
      }

      if (!data) return null;

      return {
        id: data.id,
        numero: data.numero,
        caratula: data.caratula,
        tieneNotificacion: data.tiene_notificacion,
        ultimaVerificacion: new Date(data.ultima_verificacion),
        notificacionEnviada: data.notificacion_enviada,
        fechaNotificacion: data.fecha_notificacion ? new Date(data.fecha_notificacion) : undefined,
        detallesNotificacion: data.detalles_notificacion
      };

    } catch (error) {
      logger.error('Error al obtener expediente:', error);
      throw error;
    }
  }

  /**
   * Obtiene todos los expedientes
   */
  async getAllExpedientes(): Promise<Expediente[]> {
    if (!this.initialized) throw new Error('Base de datos no inicializada');

    try {
      const { data, error } = await this.supabase
        .from('expedientes')
        .select('*')
        .order('ultima_verificacion', { ascending: false });

      if (error) throw error;

      return (data || []).map(row => ({
        id: row.id,
        numero: row.numero,
        caratula: row.caratula,
        tieneNotificacion: row.tiene_notificacion,
        ultimaVerificacion: new Date(row.ultima_verificacion),
        notificacionEnviada: row.notificacion_enviada,
        fechaNotificacion: row.fecha_notificacion ? new Date(row.fecha_notificacion) : undefined,
        detallesNotificacion: row.detalles_notificacion
      }));

    } catch (error) {
      logger.error('Error al obtener expedientes:', error);
      throw error;
    }
  }

  /**
   * Obtiene expedientes con notificaciones
   */
  async getExpedientesConNotificaciones(): Promise<Expediente[]> {
    if (!this.initialized) throw new Error('Base de datos no inicializada');

    try {
      const { data, error } = await this.supabase
        .from('expedientes')
        .select('*')
        .eq('tiene_notificacion', true)
        .order('fecha_notificacion', { ascending: false });

      if (error) throw error;

      return (data || []).map(row => ({
        id: row.id,
        numero: row.numero,
        caratula: row.caratula,
        tieneNotificacion: row.tiene_notificacion,
        ultimaVerificacion: new Date(row.ultima_verificacion),
        notificacionEnviada: row.notificacion_enviada,
        fechaNotificacion: row.fecha_notificacion ? new Date(row.fecha_notificacion) : undefined,
        detallesNotificacion: row.detalles_notificacion
      }));

    } catch (error) {
      logger.error('Error al obtener expedientes con notificaciones:', error);
      throw error;
    }
  }

  /**
   * Guarda una notificación
   */
  async saveNotificacion(notificacion: Notificacion): Promise<void> {
    if (!this.initialized) throw new Error('Base de datos no inicializada');

    try {
      const data = {
        id: notificacion.id,
        expediente_id: notificacion.expedienteId,
        fecha: notificacion.fecha.toISOString(),
        contenido: notificacion.contenido,
        pdf_path: notificacion.pdfPath || null,
        enviada: notificacion.enviada,
        fecha_envio: notificacion.fechaEnvio?.toISOString() || null
      };

      const { error } = await this.supabase
        .from('notificaciones')
        .insert(data);

      if (error) throw error;

    } catch (error) {
      logger.error('Error al guardar notificación:', error);
      throw error;
    }
  }

  /**
   * Marca una notificación como enviada
   */
  async marcarNotificacionEnviada(notificacionId: string): Promise<void> {
    if (!this.initialized) throw new Error('Base de datos no inicializada');

    try {
      const { error } = await this.supabase
        .from('notificaciones')
        .update({
          enviada: true,
          fecha_envio: new Date().toISOString()
        })
        .eq('id', notificacionId);

      if (error) throw error;

    } catch (error) {
      logger.error('Error al marcar notificación como enviada:', error);
      throw error;
    }
  }

  /**
   * Obtiene notificaciones de un expediente
   */
  async getNotificacionesByExpediente(expedienteId: string): Promise<Notificacion[]> {
    if (!this.initialized) throw new Error('Base de datos no inicializada');

    try {
      const { data, error } = await this.supabase
        .from('notificaciones')
        .select('*')
        .eq('expediente_id', expedienteId)
        .order('fecha', { ascending: false });

      if (error) throw error;

      return (data || []).map(row => ({
        id: row.id,
        expedienteId: row.expediente_id,
        fecha: new Date(row.fecha),
        contenido: row.contenido,
        pdfPath: row.pdf_path,
        enviada: row.enviada,
        fechaEnvio: row.fecha_envio ? new Date(row.fecha_envio) : undefined
      }));

    } catch (error) {
      logger.error('Error al obtener notificaciones:', error);
      throw error;
    }
  }

  /**
   * Guarda una configuración
   */
  async setConfiguracion(clave: string, valor: string): Promise<void> {
    if (!this.initialized) throw new Error('Base de datos no inicializada');
    
    try {
      const { error } = await this.supabase
        .from('configuraciones')
        .upsert({
          clave,
          valor,
          updated_at: new Date().toISOString()
        }, { onConflict: 'clave' });

      if (error) throw error;

    } catch (error) {
      logger.error('Error al guardar configuración:', error);
      throw error;
    }
  }

  /**
   * Obtiene una configuración
   */
  async getConfiguracion(clave: string): Promise<string | null> {
    if (!this.initialized) throw new Error('Base de datos no inicializada');
    
    try {
      const { data, error } = await this.supabase
        .from('configuraciones')
        .select('valor')
        .eq('clave', clave)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No encontrado
        throw error;
      }

      return data?.valor || null;

    } catch (error) {
      logger.error('Error al obtener configuración:', error);
      throw error;
    }
  }

  /**
   * Resetea la base de datos (para testing)
   */
  async reset(): Promise<void> {
    if (!this.initialized) throw new Error('Base de datos no inicializada');

    try {
      await this.supabase.from('notificaciones').delete().neq('id', '');
      await this.supabase.from('expedientes').delete().neq('id', '');
      await this.supabase.from('configuraciones').delete().neq('clave', '');
      logger.info('✅ Base de datos reseteada para testing');
    } catch (error) {
      logger.error('Error al resetear base de datos:', error);
      throw error;
    }
  }

  /**
   * Cierra la conexión (no necesario en Supabase)
   */
  async close(): Promise<void> {
    logger.info('Conexión con Supabase cerrada');
  }
}