#!/bin/bash

# Script de instalación para WSL Ubuntu
# Ejecutar desde el directorio del proyecto

echo "🚀 Instalando PJN Notificaciones Monitor en WSL..."
echo ""

# Verificar que estamos en WSL
if ! grep -q Microsoft /proc/version; then
    echo "⚠️  Advertencia: No parece que estés en WSL"
    read -p "¿Continuar de todos modos? (s/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        exit 1
    fi
fi

# Actualizar sistema
echo "📦 Actualizando sistema..."
sudo apt update -qq

# Instalar dependencias del sistema para Playwright
echo "📦 Instalando dependencias del sistema..."
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
    libasound2 \
    libatspi2.0-0 \
    libgtk-3-0 \
    libpango-1.0-0 \
    libcairo2 \
    libxss1 \
    fonts-liberation \
    xvfb

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado"
    echo "Por favor instala Node.js 20+ primero:"
    echo "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo "sudo apt-get install -y nodejs"
    exit 1
fi

echo "✅ Node.js $(node -v) detectado"

# Instalar dependencias del proyecto
echo "📦 Instalando dependencias de Node.js..."
npm install

# Instalar navegadores de Playwright
echo "🌐 Instalando navegadores de Playwright..."
npx playwright install chromium
npx playwright install-deps chromium

# Crear archivo .env si no existe
if [ ! -f .env ]; then
    echo "📝 Creando archivo .env..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANTE: Edita el archivo .env con tus credenciales"
    echo "   nano .env"
    echo ""
fi

# Configurar permisos
echo "🔐 Configurando permisos..."
chmod -R 755 data/
chmod -R 755 logs/

# Instrucciones para X Server (opcional)
echo ""
echo "📺 Para ver el navegador durante el desarrollo (opcional):"
echo "   1. Instala VcXsrv en Windows"
echo "   2. Ejecuta XLaunch con 'Disable access control'"
echo "   3. En WSL ejecuta: export DISPLAY=:0"
echo ""

# Verificar instalación
echo "🔍 Verificando instalación..."
npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ ¡Instalación completada exitosamente!"
    echo ""
    echo "📋 Próximos pasos:"
    echo "   1. Edita .env con tus credenciales: nano .env"
    echo "   2. Crea un bot de Telegram con @BotFather"
    echo "   3. Prueba el login: npm run test:login"
    echo "   4. Ejecuta el monitor: npm run dev"
    echo ""
else
    echo "❌ Error durante la compilación. Revisa los mensajes anteriores."
    exit 1
fi
