# PJN Notificaciones Monitor

Sistema automatizado para monitorear notificaciones judiciales del Poder Judicial de la Nación Argentina (PJN) y enviar alertas por Telegram.

## 🚀 Características

- ✅ Monitoreo automático cada 30 minutos
- ✅ Detección de nuevas notificaciones judiciales
- ✅ Alertas instantáneas por Telegram
- ✅ Autenticación persistente con SSO
- ✅ Base de datos local para tracking de estado
- ✅ Ejecución en GitHub Actions (sin servidor)

## 🚀 Instalación en WSL Ubuntu

### Pre-requisitos

1. **WSL Ubuntu** instalado en Windows
2. **Node.js 20+** 
3. **Bot de Telegram** (crear uno con @BotFather)
4. **Credenciales del PJN**

### Configuración del Entorno WSL

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependencias del sistema para Playwright
sudo apt install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2

# Para ver el navegador durante desarrollo (opcional)
# Instalar VcXsrv en Windows y ejecutarlo
# En WSL:
export DISPLAY=:0
```

### Instalación del Proyecto

```bash
# Clonar o navegar al directorio del proyecto
cd /mnt/c/Users/matia/OneDrive/Escritorio/pjn-notificaciones-monitor

# Instalar dependencias
npm install

# Instalar navegadores de Playwright
npx playwright install chromium

# Copiar archivo de configuración
cp .env.example .env

# Editar .env con tus credenciales
nano .env
```

## 📝 Configuración

### 1. Credenciales PJN
Edita el archivo `.env` y agrega:
```
PJN_USERNAME=tu_cuit_o_usuario
PJN_PASSWORD=tu_contraseña
```

### 2. Bot de Telegram

1. Habla con [@BotFather](https://t.me/botfather) en Telegram
2. Crea un nuevo bot con `/newbot`
3. Copia el token y agrégalo a `.env`
4. Obtén tu Chat ID hablando con [@userinfobot](https://t.me/userinfobot)
5. Agrega el Chat ID a `.env`

## 🔧 Comandos Disponibles

### Desarrollo Local
```bash
# Desarrollo
npm run dev              # Ejecutar en modo desarrollo
npm run build           # Compilar TypeScript

# Testing
npm run test:login      # Probar autenticación
npm run test:scraper    # Probar detección de notificaciones
npm run test:telegram   # Probar envío de mensajes

# Monitoreo
npm run monitor         # Ejecutar monitor continuo (local)
npm run check:manual    # Verificación manual única
```

### Comandos del Bot de Telegram
- `/start` - Iniciar conversación con el bot
- `/status` - Ver estado del sistema
- `/test` - Enviar mensaje de prueba
- `/help` - Ver ayuda

## 🐛 Debugging en WSL

### Ver el navegador

1. Instala [VcXsrv](https://sourceforge.net/projects/vcxsrv/) en Windows
2. Ejecuta XLaunch con estas opciones:
   - Multiple windows
   - Start no client
   - Disable access control
3. En WSL:
```bash
export DISPLAY=:0
# Verificar que funciona
xclock  # Debería mostrar un reloj
```

### Logs

```bash
# Ver logs en tiempo real
tail -f logs/app.log

# Ver solo errores
tail -f logs/error.log
```

## 📁 Estructura del Proyecto

```
├── src/
│   ├── auth/          # Autenticación SSO
│   ├── scraper/       # Detección de notificaciones
│   ├── telegram/      # Bot de Telegram
│   └── index.ts       # Entry point
├── data/
│   ├── cookies/       # Sesiones guardadas
│   └── pdfs/          # PDFs generados
├── logs/              # Archivos de log
└── CLAUDE.md          # Contexto para Claude Code
```

## 🤖 Comandos para Claude Code

```bash
# Desde el directorio del proyecto
cd /mnt/c/Users/matia/OneDrive/Escritorio/pjn-notificaciones-monitor

# Iniciar Claude Code con el contexto del proyecto
claude .

# Comandos útiles:
claude "Implementar el login SSO del PJN con manejo de cookies"
claude "Crear función para detectar notificaciones nuevas"
claude "Configurar el bot de Telegram para enviar PDFs"
```

## ⚠️ Notas Importantes

1. **Rate Limiting**: El sistema respeta un intervalo de 30 minutos entre verificaciones
2. **Sesiones**: Las cookies se guardan para evitar logins repetidos
3. **PDFs**: Se generan y guardan localmente antes de enviar
4. **Seguridad**: Nunca commitear el archivo `.env` con credenciales

## 🆘 Troubleshooting

### Error: "Cannot find Chrome"
```bash
npx playwright install chromium
```

### Error: "Display not found"
```bash
# Opción 1: Ejecutar sin display
export HEADLESS_MODE=true

# Opción 2: Configurar X Server (VcXsrv)
export DISPLAY=:0
```

### Permisos en WSL
```bash
# Si hay problemas de permisos
chmod -R 755 data/
chmod -R 755 logs/
```

## 📞 Soporte

Si encuentras problemas, revisa:
1. Los logs en `logs/error.log`
2. Que el bot de Telegram esté activo
3. Que las credenciales del PJN sean correctas
4. Que tengas conexión a internet estable
