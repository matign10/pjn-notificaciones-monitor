# PJN Notificaciones Monitor - Contexto para Claude Code

## 🎯 Objetivo del Proyecto
Automatizar la detección de nuevas notificaciones judiciales en el sistema PJN (Poder Judicial de la Nación Argentina) y enviar alertas por Telegram con el contenido en PDF.

## 🔑 Información Clave del Sistema PJN
- **URL Login**: https://sso.pjn.gov.ar/auth/realms/pjn/protocol/openid-connect/auth
- **Portal Principal**: https://portalpjn.pjn.gov.ar/
- **Autenticación**: OpenID Connect con SSO
- **Indicador de Notificaciones**: Círculo naranja con "n" en la lista de expedientes
- **Rol del Usuario**: Abogado con expedientes asignados

## 🛠️ Stack Tecnológico
- **Runtime**: Node.js 20+ en WSL Ubuntu (Windows)
- **Browser Automation**: Playwright (mejor soporte para SSO)
- **Notificaciones**: Telegram Bot API
- **PDF**: Puppeteer o Playwright PDF generation
- **Scheduler**: node-cron (cada 30 minutos)
- **Storage**: SQLite + archivos locales

## 📁 Estructura del Proyecto
```
pjn-notificaciones-monitor/
├── src/
│   ├── auth/          # SSO y manejo de sesiones
│   ├── scraper/       # Detección de notificaciones
│   ├── pdf/           # Generación de PDFs
│   ├── telegram/      # Bot de Telegram
│   └── scheduler/     # Cron jobs
├── data/
│   ├── cookies/       # Sesiones persistentes
│   ├── pdfs/          # PDFs generados
│   └── db/            # SQLite database
├── logs/
├── .env               # Credenciales
└── CLAUDE.md          # Este archivo
```

## 🔐 Variables de Entorno Necesarias
```bash
# PJN Credentials
PJN_USERNAME=
PJN_PASSWORD=

# Telegram Bot
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Config
CHECK_INTERVAL_MINUTES=30
HEADLESS_MODE=false  # false para debugging en WSL
```

## 🚀 Comandos Útiles para Claude Code

### Inicialización
```bash
# Crear estructura completa del proyecto
claude "Crear la estructura de carpetas y archivos base con package.json y tsconfig.json para el proyecto PJN monitor"

# Instalar dependencias
claude "Instalar todas las dependencias necesarias: playwright, telegraf, node-cron, dotenv, winston, sqlite3"
```

### Desarrollo
```bash
# Implementar autenticación SSO
claude "Implementar el sistema de login SSO del PJN con Playwright, guardando cookies para reutilizar sesiones"

# Scraper de notificaciones
claude "Crear scraper que detecte el círculo naranja con 'n' en la lista de expedientes y extraiga la información"

# Generador de PDFs
claude "Implementar función para generar PDF de las notificaciones con Playwright"

# Bot de Telegram
claude "Configurar bot de Telegram con Telegraf para enviar notificaciones con PDFs adjuntos"
```

### Testing en WSL
```bash
# Test de login
claude "Crear script de test para verificar login SSO en modo headed (visible) para debugging en WSL"

# Test de detección
claude "Script para detectar y mostrar en consola las notificaciones encontradas"
```

## 📋 Flujo de Trabajo

1. **Autenticación SSO**
   - Login con credenciales
   - Guardar cookies/tokens
   - Verificar sesión activa

2. **Detección de Notificaciones**
   - Navegar a lista de expedientes
   - Buscar círculos naranjas con "n"
   - Comparar con estado anterior
   - Identificar nuevas notificaciones

3. **Extracción de Contenido**
   - Abrir expediente con notificación
   - Capturar contenido relevante
   - Generar PDF

4. **Envío por Telegram**
   - Formato: Número + Carátula
   - Adjuntar PDF generado
   - Marcar como enviado

## ⚠️ Consideraciones Especiales WSL

1. **Display para Playwright**
   - Usar `xvfb-run` si es necesario
   - O configurar `DISPLAY=:0` con X Server

2. **Rutas de Archivos**
   - Usar rutas Linux: `/mnt/c/Users/...`
   - Evitar rutas Windows directas

3. **Permisos**
   - Asegurar permisos correctos en carpetas data/

4. **Debugging**
   - Iniciar con `headless: false`
   - Usar screenshots para debugging

## 🎯 Próximos Pasos Inmediatos

1. Configurar proyecto base con TypeScript
2. Implementar login SSO con persistencia
3. Crear detector de notificaciones
4. Configurar bot de Telegram
5. Implementar scheduler de 30 minutos
6. Testing completo en WSL

## 💡 Tips para Development

- Siempre probar primero en modo "headed" (navegador visible)
- Guardar screenshots en cada paso crítico
- Implementar retry logic para requests
- Usar selectores específicos del PJN
- Mantener logs detallados
- Respetar rate limits del PJN

---

**Nota**: Este proyecto debe ejecutarse en WSL Ubuntu. Asegurarse de tener configurado el display para ver el navegador durante el desarrollo.
