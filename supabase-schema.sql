-- Crear tabla de expedientes
CREATE TABLE IF NOT EXISTS expedientes (
  id TEXT PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,
  caratula TEXT NOT NULL,
  tiene_notificacion BOOLEAN NOT NULL DEFAULT FALSE,
  ultima_verificacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notificacion_enviada BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_notificacion TIMESTAMP WITH TIME ZONE,
  detalles_notificacion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de notificaciones
CREATE TABLE IF NOT EXISTS notificaciones (
  id TEXT PRIMARY KEY,
  expediente_id TEXT NOT NULL REFERENCES expedientes(id),
  fecha TIMESTAMP WITH TIME ZONE NOT NULL,
  contenido TEXT NOT NULL,
  pdf_path TEXT,
  enviada BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_envio TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de configuraciones
CREATE TABLE IF NOT EXISTS configuraciones (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_expedientes_numero ON expedientes(numero);
CREATE INDEX IF NOT EXISTS idx_expedientes_notificacion ON expedientes(tiene_notificacion);
CREATE INDEX IF NOT EXISTS idx_notificaciones_expediente ON notificaciones(expediente_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_enviada ON notificaciones(enviada);

-- Habilitar Row Level Security (RLS)
ALTER TABLE expedientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuraciones ENABLE ROW LEVEL SECURITY;

-- Crear políticas para permitir todas las operaciones con la anon key
CREATE POLICY "Enable all for anon" ON expedientes FOR ALL USING (true);
CREATE POLICY "Enable all for anon" ON notificaciones FOR ALL USING (true);
CREATE POLICY "Enable all for anon" ON configuraciones FOR ALL USING (true);