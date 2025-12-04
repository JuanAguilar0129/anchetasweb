/*
  # Sistema de Gestión de Ventas e Inventarios de Anchetas
  
  ## Descripción
  Sistema completo con 3 roles: admin_general, admin_punto, vendedor.
  Cada usuario puede tener acceso a uno o varios puntos de venta.
  
  ## 1. Tablas Principales
  
  ### profiles
  - Extiende auth.users con información adicional
  - Campos: id (FK a auth.users), nombre, codigo_usuario, rol
  - Roles: admin_general, admin_punto, vendedor
  
  ### puntos_venta
  - Representa los puntos de venta/tiendas
  - Campos: id, nombre, direccion, activo
  
  ### usuarios_puntos
  - Tabla pivote que relaciona usuarios con puntos de venta
  - Permite que un usuario tenga acceso a múltiples puntos
  - Campos: id, user_id, punto_id
  
  ### productos
  - Catálogo de anchetas/productos
  - Campos: id, nombre, descripcion, precio_venta, imagen_url, activo
  
  ### inventario
  - Stock de productos por punto de venta
  - Campos: id, producto_id, punto_id, cantidad, stock_minimo
  
  ### ventas
  - Registro de ventas realizadas
  - Campos: id, punto_id, vendedor_id, fecha, total, cliente_nombre, cliente_telefono
  
  ### ventas_detalle
  - Detalle de productos vendidos
  - Campos: id, venta_id, producto_id, cantidad, precio_unitario, subtotal
  
  ### compras
  - Registro de compras/entradas de inventario
  - Campos: id, punto_id, usuario_id, fecha, total, proveedor, notas
  
  ### compras_detalle
  - Detalle de productos comprados
  - Campos: id, compra_id, producto_id, cantidad, precio_unitario, subtotal
  
  ## 2. Seguridad (RLS)
  
  - Admin General: Acceso completo a todos los puntos
  - Admin Punto: Solo acceso a sus puntos asignados
  - Vendedor: Solo acceso a su punto asignado (lectura de inventario, crear ventas)
*/

-- Crear tabla de perfiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  codigo_usuario text UNIQUE NOT NULL,
  rol text NOT NULL CHECK (rol IN ('admin_general', 'admin_punto', 'vendedor')),
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear tabla de puntos de venta
CREATE TABLE IF NOT EXISTS puntos_venta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  direccion text DEFAULT '',
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear tabla de relación usuarios-puntos
CREATE TABLE IF NOT EXISTS usuarios_puntos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  punto_id uuid NOT NULL REFERENCES puntos_venta(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, punto_id)
);

-- Crear tabla de productos
CREATE TABLE IF NOT EXISTS productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text DEFAULT '',
  precio_venta decimal(10,2) NOT NULL DEFAULT 0,
  imagen_url text DEFAULT '',
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear tabla de inventario
CREATE TABLE IF NOT EXISTS inventario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  punto_id uuid NOT NULL REFERENCES puntos_venta(id) ON DELETE CASCADE,
  cantidad integer NOT NULL DEFAULT 0,
  stock_minimo integer DEFAULT 5,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(producto_id, punto_id)
);

-- Crear tabla de ventas
CREATE TABLE IF NOT EXISTS ventas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  punto_id uuid NOT NULL REFERENCES puntos_venta(id) ON DELETE RESTRICT,
  vendedor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  fecha timestamptz DEFAULT now(),
  total decimal(10,2) NOT NULL DEFAULT 0,
  cliente_nombre text DEFAULT '',
  cliente_telefono text DEFAULT '',
  notas text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Crear tabla de detalle de ventas
CREATE TABLE IF NOT EXISTS ventas_detalle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id uuid NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad integer NOT NULL,
  precio_unitario decimal(10,2) NOT NULL,
  subtotal decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Crear tabla de compras
CREATE TABLE IF NOT EXISTS compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  punto_id uuid NOT NULL REFERENCES puntos_venta(id) ON DELETE RESTRICT,
  usuario_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  fecha timestamptz DEFAULT now(),
  total decimal(10,2) NOT NULL DEFAULT 0,
  proveedor text DEFAULT '',
  notas text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Crear tabla de detalle de compras
CREATE TABLE IF NOT EXISTS compras_detalle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id uuid NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad integer NOT NULL,
  precio_unitario decimal(10,2) NOT NULL,
  subtotal decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_usuarios_puntos_user ON usuarios_puntos(user_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_puntos_punto ON usuarios_puntos(punto_id);
CREATE INDEX IF NOT EXISTS idx_inventario_punto ON inventario(punto_id);
CREATE INDEX IF NOT EXISTS idx_inventario_producto ON inventario(producto_id);
CREATE INDEX IF NOT EXISTS idx_ventas_punto ON ventas(punto_id);
CREATE INDEX IF NOT EXISTS idx_ventas_vendedor ON ventas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);
CREATE INDEX IF NOT EXISTS idx_compras_punto ON compras(punto_id);
CREATE INDEX IF NOT EXISTS idx_compras_fecha ON compras(fecha);

-- Función auxiliar para verificar si un usuario tiene acceso a un punto
CREATE OR REPLACE FUNCTION user_has_access_to_punto(punto_uuid uuid)
RETURNS boolean AS $$
BEGIN
  -- Admin general tiene acceso a todo
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND rol = 'admin_general' AND activo = true
  ) THEN
    RETURN true;
  END IF;
  
  -- Verificar si el usuario tiene el punto asignado
  RETURN EXISTS (
    SELECT 1 FROM usuarios_puntos
    WHERE user_id = auth.uid() AND punto_id = punto_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función auxiliar para obtener el rol del usuario actual
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text AS $$
  SELECT rol FROM profiles WHERE id = auth.uid() AND activo = true;
$$ LANGUAGE sql SECURITY DEFINER;

-- ==========================================
-- POLÍTICAS RLS (Row Level Security)
-- ==========================================

-- Habilitar RLS en todas las tablas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE puntos_venta ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_puntos ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras_detalle ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- POLÍTICAS: profiles
-- ==========================================

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admin general can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (get_user_role() = 'admin_general');

CREATE POLICY "Admin punto can view profiles of their points"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    get_user_role() = 'admin_punto' AND
    id IN (
      SELECT up2.user_id FROM usuarios_puntos up1
      JOIN usuarios_puntos up2 ON up1.punto_id = up2.punto_id
      WHERE up1.user_id = auth.uid()
    )
  );

CREATE POLICY "Only admin general can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() = 'admin_general');

CREATE POLICY "Admin general can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (get_user_role() = 'admin_general')
  WITH CHECK (get_user_role() = 'admin_general');

-- ==========================================
-- POLÍTICAS: puntos_venta
-- ==========================================

CREATE POLICY "Admin general can view all puntos"
  ON puntos_venta FOR SELECT
  TO authenticated
  USING (get_user_role() = 'admin_general');

CREATE POLICY "Users can view their assigned puntos"
  ON puntos_venta FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT punto_id FROM usuarios_puntos
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Only admin general can insert puntos"
  ON puntos_venta FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() = 'admin_general');

CREATE POLICY "Only admin general can update puntos"
  ON puntos_venta FOR UPDATE
  TO authenticated
  USING (get_user_role() = 'admin_general')
  WITH CHECK (get_user_role() = 'admin_general');

CREATE POLICY "Only admin general can delete puntos"
  ON puntos_venta FOR DELETE
  TO authenticated
  USING (get_user_role() = 'admin_general');

-- ==========================================
-- POLÍTICAS: usuarios_puntos
-- ==========================================

CREATE POLICY "Admin general can view all user-punto assignments"
  ON usuarios_puntos FOR SELECT
  TO authenticated
  USING (get_user_role() = 'admin_general');

CREATE POLICY "Users can view their own punto assignments"
  ON usuarios_puntos FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admin punto can view assignments for their puntos"
  ON usuarios_puntos FOR SELECT
  TO authenticated
  USING (
    get_user_role() = 'admin_punto' AND
    punto_id IN (
      SELECT punto_id FROM usuarios_puntos WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Only admin general can insert user-punto assignments"
  ON usuarios_puntos FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() = 'admin_general');

CREATE POLICY "Only admin general can delete user-punto assignments"
  ON usuarios_puntos FOR DELETE
  TO authenticated
  USING (get_user_role() = 'admin_general');

-- ==========================================
-- POLÍTICAS: productos
-- ==========================================

CREATE POLICY "All authenticated users can view productos"
  ON productos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert productos"
  ON productos FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() IN ('admin_general', 'admin_punto'));

CREATE POLICY "Only admins can update productos"
  ON productos FOR UPDATE
  TO authenticated
  USING (get_user_role() IN ('admin_general', 'admin_punto'))
  WITH CHECK (get_user_role() IN ('admin_general', 'admin_punto'));

CREATE POLICY "Only admin general can delete productos"
  ON productos FOR DELETE
  TO authenticated
  USING (get_user_role() = 'admin_general');

-- ==========================================
-- POLÍTICAS: inventario
-- ==========================================

CREATE POLICY "Users can view inventario of their puntos"
  ON inventario FOR SELECT
  TO authenticated
  USING (user_has_access_to_punto(punto_id));

CREATE POLICY "Admins can insert inventario for their puntos"
  ON inventario FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() IN ('admin_general', 'admin_punto') AND
    user_has_access_to_punto(punto_id)
  );

CREATE POLICY "Admins can update inventario for their puntos"
  ON inventario FOR UPDATE
  TO authenticated
  USING (
    get_user_role() IN ('admin_general', 'admin_punto') AND
    user_has_access_to_punto(punto_id)
  )
  WITH CHECK (
    get_user_role() IN ('admin_general', 'admin_punto') AND
    user_has_access_to_punto(punto_id)
  );

-- ==========================================
-- POLÍTICAS: ventas
-- ==========================================

CREATE POLICY "Users can view ventas of their puntos"
  ON ventas FOR SELECT
  TO authenticated
  USING (user_has_access_to_punto(punto_id));

CREATE POLICY "Users can insert ventas for their puntos"
  ON ventas FOR INSERT
  TO authenticated
  WITH CHECK (user_has_access_to_punto(punto_id));

CREATE POLICY "Admins can update ventas for their puntos"
  ON ventas FOR UPDATE
  TO authenticated
  USING (
    get_user_role() IN ('admin_general', 'admin_punto') AND
    user_has_access_to_punto(punto_id)
  )
  WITH CHECK (
    get_user_role() IN ('admin_general', 'admin_punto') AND
    user_has_access_to_punto(punto_id)
  );

-- ==========================================
-- POLÍTICAS: ventas_detalle
-- ==========================================

CREATE POLICY "Users can view ventas_detalle of their ventas"
  ON ventas_detalle FOR SELECT
  TO authenticated
  USING (
    venta_id IN (
      SELECT id FROM ventas WHERE user_has_access_to_punto(punto_id)
    )
  );

CREATE POLICY "Users can insert ventas_detalle for their ventas"
  ON ventas_detalle FOR INSERT
  TO authenticated
  WITH CHECK (
    venta_id IN (
      SELECT id FROM ventas WHERE user_has_access_to_punto(punto_id)
    )
  );

-- ==========================================
-- POLÍTICAS: compras
-- ==========================================

CREATE POLICY "Users can view compras of their puntos"
  ON compras FOR SELECT
  TO authenticated
  USING (user_has_access_to_punto(punto_id));

CREATE POLICY "Admins can insert compras for their puntos"
  ON compras FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() IN ('admin_general', 'admin_punto') AND
    user_has_access_to_punto(punto_id)
  );

CREATE POLICY "Admins can update compras for their puntos"
  ON compras FOR UPDATE
  TO authenticated
  USING (
    get_user_role() IN ('admin_general', 'admin_punto') AND
    user_has_access_to_punto(punto_id)
  )
  WITH CHECK (
    get_user_role() IN ('admin_general', 'admin_punto') AND
    user_has_access_to_punto(punto_id)
  );

-- ==========================================
-- POLÍTICAS: compras_detalle
-- ==========================================

CREATE POLICY "Users can view compras_detalle of their compras"
  ON compras_detalle FOR SELECT
  TO authenticated
  USING (
    compra_id IN (
      SELECT id FROM compras WHERE user_has_access_to_punto(punto_id)
    )
  );

CREATE POLICY "Admins can insert compras_detalle for their compras"
  ON compras_detalle FOR INSERT
  TO authenticated
  WITH CHECK (
    compra_id IN (
      SELECT id FROM compras WHERE user_has_access_to_punto(punto_id)
    )
  );

-- ==========================================
-- TRIGGERS
-- ==========================================

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_puntos_venta_updated_at
  BEFORE UPDATE ON puntos_venta
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_productos_updated_at
  BEFORE UPDATE ON productos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_inventario_updated_at
  BEFORE UPDATE ON inventario
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
