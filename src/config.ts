import dotenv from 'dotenv';
import winston from 'winston';
import path from 'path';

// Cargar variables de entorno
dotenv.config();

// Configurar logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/app.log') 
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Verificar configuración
export function checkConfig(): boolean {
  const required = [
    'PJN_USERNAME',
    'PJN_PASSWORD',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    logger.error('Faltan variables de entorno:', missing);
    console.error(`
❌ Error de configuración

Faltan las siguientes variables en el archivo .env:
${missing.map(m => `  - ${m}`).join('\n')}

Por favor:
1. Copia .env.example a .env
2. Completa todas las variables requeridas
3. Intenta nuevamente
    `);
    return false;
  }

  logger.info('Configuración verificada correctamente');
  return true;
}

// Configuración de la aplicación
export const config = {
  pjn: {
    username: process.env.PJN_USERNAME!,
    password: process.env.PJN_PASSWORD!,
    loginUrl: 'https://sso.pjn.gov.ar/auth/realms/pjn/protocol/openid-connect/auth',
    portalUrl: 'https://portalpjn.pjn.gov.ar/'
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN!,
    chatId: process.env.TELEGRAM_CHAT_ID!
  },
  app: {
    checkIntervalMinutes: parseInt(process.env.CHECK_INTERVAL_MINUTES || '30'),
    headlessMode: process.env.HEADLESS_MODE === 'true',
    dataDir: path.join(__dirname, '../data'),
    logsDir: path.join(__dirname, '../logs')
  }
};
