import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import { config, logger } from '../config';

export interface Expediente {
  id: string;
  numero: string;
  caratula: string;
  tieneNotificacion: boolean;
  ultimaVerificacion: Date;
  notificacionEnviada: boolean;
  fechaNotificacion?: Date;
  detallesNotificacion?: string;
}

export interface Notificacion {
  id: string;
  expedienteId: string;
  fecha: Date;
  contenido: string;
  pdfPath?: string;
  enviada: boolean;
  fechaEnvio?: Date;
}

export class PJNDatabase {
  private db: Database | null = null;
  private dbPath: string;

  constructor() {
    this.dbPath = path.join(config.app.dataDir, 'db', 'pjn-monitor.db');
  }

  /**
   * Inicializa la base de datos y crea las tablas
   */
  async initialize(): Promise<void> {
    try {
      // Crear directorio si no existe
      const dbDir = path.dirname(this.dbPath);
      const fs = await import('fs/promises');
      await fs.mkdir(dbDir, { recursive: true });

      logger.info('Inicializando base de datos SQLite...');
      
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database
      });

      await this.createTables();
      logger.info('Base de datos inicializada correctamente');

    } catch (error) {
      logger.error('Error al inicializar base de datos:', error);
      throw error;
    }
  }

  /**
   * Crea las tablas necesarias
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Base de datos no inicializada');

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS expedientes (
        id TEXT PRIMARY KEY,
        numero TEXT NOT NULL UNIQUE,
        caratula TEXT NOT NULL,
        tieneNotificacion BOOLEAN NOT NULL DEFAULT 0,
        ultimaVerificacion DATETIME NOT NULL,
        notificacionEnviada BOOLEAN NOT NULL DEFAULT 0,
        fechaNotificacion DATETIME,
        detallesNotificacion TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS notificaciones (
        id TEXT PRIMARY KEY,
        expedienteId TEXT NOT NULL,
        fecha DATETIME NOT NULL,
        contenido TEXT NOT NULL,
        pdfPath TEXT,
        enviada BOOLEAN NOT NULL DEFAULT 0,
        fechaEnvio DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (expedienteId) REFERENCES expedientes (id)
      )
    `);

    // Crear índices para optimizar consultas
    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_expedientes_numero ON expedientes (numero);
      CREATE INDEX IF NOT EXISTS idx_expedientes_notificacion ON expedientes (tieneNotificacion);
      CREATE INDEX IF NOT EXISTS idx_notificaciones_expediente ON notificaciones (expedienteId);
      CREATE INDEX IF NOT EXISTS idx_notificaciones_enviada ON notificaciones (enviada);
    `);

    logger.info('Tablas de base de datos creadas/verificadas');
  }

  /**
   * Guarda o actualiza un expediente
   */
  async saveExpediente(expediente: Expediente): Promise<void> {
    if (!this.db) throw new Error('Base de datos no inicializada');

    try {
      await this.db.run(`
        INSERT OR REPLACE INTO expedientes (
          id, numero, caratula, tieneNotificacion, ultimaVerificacion,
          notificacionEnviada, fechaNotificacion, detallesNotificacion, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        expediente.id,
        expediente.numero,
        expediente.caratula,
        expediente.tieneNotificacion ? 1 : 0,
        expediente.ultimaVerificacion.toISOString(),
        expediente.notificacionEnviada ? 1 : 0,
        expediente.fechaNotificacion?.toISOString(),
        expediente.detallesNotificacion
      ]);

      logger.debug(`Expediente guardado: ${expediente.numero}`);

    } catch (error) {
      logger.error('Error al guardar expediente:', error);
      throw error;
    }
  }

  /**
   * Obtiene un expediente por número
   */
  async getExpedienteByNumero(numero: string): Promise<Expediente | null> {
    if (!this.db) throw new Error('Base de datos no inicializada');

    try {
      const row = await this.db.get(`
        SELECT * FROM expedientes WHERE numero = ?
      `, numero);

      if (!row) return null;

      return {
        id: row.id,
        numero: row.numero,
        caratula: row.caratula,
        tieneNotificacion: row.tieneNotificacion === 1,
        ultimaVerificacion: new Date(row.ultimaVerificacion),
        notificacionEnviada: row.notificacionEnviada === 1,
        fechaNotificacion: row.fechaNotificacion ? new Date(row.fechaNotificacion) : undefined,
        detallesNotificacion: row.detallesNotificacion
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
    if (!this.db) throw new Error('Base de datos no inicializada');

    try {
      const rows = await this.db.all(`
        SELECT * FROM expedientes ORDER BY ultimaVerificacion DESC
      `);

      return rows.map(row => ({
        id: row.id,
        numero: row.numero,
        caratula: row.caratula,
        tieneNotificacion: row.tieneNotificacion === 1,
        ultimaVerificacion: new Date(row.ultimaVerificacion),
        notificacionEnviada: row.notificacionEnviada === 1,
        fechaNotificacion: row.fechaNotificacion ? new Date(row.fechaNotificacion) : undefined,
        detallesNotificacion: row.detallesNotificacion
      }));

    } catch (error) {
      logger.error('Error al obtener expedientes:', error);
      throw error;
    }
  }

  /**
   * Obtiene expedientes con nuevas notificaciones (no enviadas)
   */
  async getExpedientesConNotificacionesPendientes(): Promise<Expediente[]> {
    if (!this.db) throw new Error('Base de datos no inicializada');

    try {
      const rows = await this.db.all(`
        SELECT * FROM expedientes 
        WHERE tieneNotificacion = 1 AND notificacionEnviada = 0
        ORDER BY fechaNotificacion DESC
      `);

      return rows.map(row => ({
        id: row.id,
        numero: row.numero,
        caratula: row.caratula,
        tieneNotificacion: row.tieneNotificacion === 1,
        ultimaVerificacion: new Date(row.ultimaVerificacion),
        notificacionEnviada: row.notificacionEnviada === 1,
        fechaNotificacion: row.fechaNotificacion ? new Date(row.fechaNotificacion) : undefined,
        detallesNotificacion: row.detallesNotificacion
      }));

    } catch (error) {
      logger.error('Error al obtener expedientes con notificaciones pendientes:', error);
      throw error;
    }
  }

  /**
   * Marca una notificación como enviada
   */
  async marcarNotificacionEnviada(expedienteId: string): Promise<void> {
    if (!this.db) throw new Error('Base de datos no inicializada');

    try {
      await this.db.run(`
        UPDATE expedientes 
        SET notificacionEnviada = 1, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `, expedienteId);

      logger.debug(`Notificación marcada como enviada: ${expedienteId}`);

    } catch (error) {
      logger.error('Error al marcar notificación como enviada:', error);
      throw error;
    }
  }

  /**
   * Guarda una notificación
   */
  async saveNotificacion(notificacion: Notificacion): Promise<void> {
    if (!this.db) throw new Error('Base de datos no inicializada');

    try {
      await this.db.run(`
        INSERT OR REPLACE INTO notificaciones (
          id, expedienteId, fecha, contenido, pdfPath, enviada, fechaEnvio
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        notificacion.id,
        notificacion.expedienteId,
        notificacion.fecha.toISOString(),
        notificacion.contenido,
        notificacion.pdfPath,
        notificacion.enviada ? 1 : 0,
        notificacion.fechaEnvio?.toISOString()
      ]);

      logger.debug(`Notificación guardada: ${notificacion.id}`);

    } catch (error) {
      logger.error('Error al guardar notificación:', error);
      throw error;
    }
  }

  /**
   * Obtiene notificaciones de un expediente
   */
  async getNotificacionesByExpediente(expedienteId: string): Promise<Notificacion[]> {
    if (!this.db) throw new Error('Base de datos no inicializada');

    try {
      const rows = await this.db.all(`
        SELECT * FROM notificaciones 
        WHERE expedienteId = ? 
        ORDER BY fecha DESC
      `, expedienteId);

      return rows.map(row => ({
        id: row.id,
        expedienteId: row.expedienteId,
        fecha: new Date(row.fecha),
        contenido: row.contenido,
        pdfPath: row.pdfPath,
        enviada: row.enviada === 1,
        fechaEnvio: row.fechaEnvio ? new Date(row.fechaEnvio) : undefined
      }));

    } catch (error) {
      logger.error('Error al obtener notificaciones:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de la base de datos
   */
  async getEstadisticas(): Promise<{
    totalExpedientes: number;
    expedientesConNotificaciones: number;
    notificacionesPendientes: number;
    notificacionesEnviadas: number;
  }> {
    if (!this.db) throw new Error('Base de datos no inicializada');

    try {
      const totalExpedientes = await this.db.get('SELECT COUNT(*) as count FROM expedientes');
      const expedientesConNotificaciones = await this.db.get('SELECT COUNT(*) as count FROM expedientes WHERE tieneNotificacion = 1');
      const notificacionesPendientes = await this.db.get('SELECT COUNT(*) as count FROM expedientes WHERE tieneNotificacion = 1 AND notificacionEnviada = 0');
      const notificacionesEnviadas = await this.db.get('SELECT COUNT(*) as count FROM notificaciones WHERE enviada = 1');

      return {
        totalExpedientes: totalExpedientes.count,
        expedientesConNotificaciones: expedientesConNotificaciones.count,
        notificacionesPendientes: notificacionesPendientes.count,
        notificacionesEnviadas: notificacionesEnviadas.count
      };

    } catch (error) {
      logger.error('Error al obtener estadísticas:', error);
      throw error;
    }
  }

  /**
   * Resetea todas las tablas para testing
   */
  async resetForTesting(): Promise<void> {
    if (!this.db) throw new Error('Base de datos no inicializada');

    try {
      await this.db.run('DELETE FROM expedientes');
      logger.info('✅ Base de datos reseteada para testing');
    } catch (error) {
      logger.error('Error al resetear base de datos:', error);
      throw error;
    }
  }

  /**
   * Cierra la conexión a la base de datos
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      logger.info('Conexión a base de datos cerrada');
    }
  }
}