# Sistema de Gestión de Ventas e Inventarios de Anchetas

Sistema completo y profesional para gestionar ventas, inventarios y múltiples puntos de venta de anchetas. Desarrollado con React, TypeScript, Tailwind CSS y Supabase.

## Características Principales

### Sistema de Roles y Permisos

El sistema cuenta con 3 roles claramente definidos:

1. **Administrador General**
   - Acceso completo a todos los puntos de venta
   - Puede crear y gestionar puntos de venta
   - Puede crear usuarios y asignar permisos
   - Gestión completa de productos, inventarios, ventas y compras

2. **Administrador de Punto**
   - Acceso solo a los puntos asignados
   - Puede gestionar ventas, compras e inventario de sus puntos
   - Puede crear y editar productos
   - No puede eliminar puntos ni crear nuevos

3. **Vendedor**
   - Acceso solo al punto asignado
   - Puede realizar ventas
   - Puede consultar inventario
   - Permisos limitados de solo lectura en otras secciones

### Módulos Disponibles

#### Dashboard
- Resumen de ventas del día y del mes
- Indicadores de stock disponible y productos con stock bajo
- Filtrado por punto de venta
- Visualización de puntos asignados

#### Ventas
- Interfaz tipo e-commerce para realizar ventas
- Catálogo de productos con imágenes
- Carrito de compras interactivo
- Registro de datos del cliente
- Actualización automática de inventario
- Validación de stock disponible

#### Inventario
- Visualización de stock por punto de venta
- Alertas de stock bajo
- Búsqueda de productos
- Indicadores visuales de estado del stock

#### Compras
- Registro de entradas de inventario
- Asignación por punto de venta
- Registro de proveedor y notas
- Actualización automática de inventario

#### Productos
- Catálogo completo de anchetas
- Gestión de nombre, descripción, precio e imagen
- Vista en formato tarjeta con imágenes
- Activación/desactivación de productos

#### Puntos de Venta
- Creación y gestión de ubicaciones
- Asignación de personal a cada punto
- Control de puntos activos/inactivos

#### Usuarios
- Creación de nuevos usuarios
- Asignación de roles
- Asignación de puntos de venta
- Gestión de permisos

## Tecnologías Utilizadas

- **Frontend**: React 18 + TypeScript
- **Estilos**: Tailwind CSS
- **Base de Datos**: Supabase (PostgreSQL)
- **Autenticación**: Supabase Auth
- **Iconos**: Lucide React
- **Build Tool**: Vite

## Credenciales de Acceso Inicial

El sistema viene con un usuario administrador pre-configurado:

- **Código de Usuario**: `admin`
- **Contraseña**: `admin123`

## Datos de Ejemplo

El sistema incluye:
- 1 punto de venta de ejemplo
- 8 productos de anchetas con imágenes
- Inventario inicial para cada producto

## Despliegue en Producción

### Opción 1: Vercel (Recomendado)

1. Sube el código a GitHub
2. Conecta tu repositorio en [Vercel](https://vercel.com)
3. Configura las variables de entorno:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Despliega

### Opción 2: Netlify

1. Sube el código a GitHub
2. Conecta tu repositorio en [Netlify](https://netlify.com)
3. Configura el build command: `npm run build`
4. Configura el publish directory: `dist`
5. Agrega las variables de entorno
6. Despliega

### Opción 3: GitHub Pages

1. Instala gh-pages: `npm install --save-dev gh-pages`
2. Agrega en package.json:
   ```json
   "homepage": "https://tu-usuario.github.io/tu-repo",
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d dist"
   }
   ```
3. Actualiza vite.config.ts con la base correcta
4. Ejecuta: `npm run deploy`

## Estructura del Proyecto

```
src/
├── components/
│   ├── auth/          # Login y autenticación
│   ├── layout/        # Navbar y Sidebar
│   ├── dashboard/     # Dashboard principal
│   ├── puntos/        # Gestión de puntos de venta
│   ├── productos/     # Catálogo de productos
│   ├── inventario/    # Control de inventario
│   ├── ventas/        # Módulo de ventas
│   ├── compras/       # Registro de compras
│   └── usuarios/      # Gestión de usuarios
├── contexts/          # Context API (Auth)
├── lib/              # Configuración de Supabase y tipos
└── App.tsx           # Componente principal
```

## Seguridad

- Row Level Security (RLS) activado en todas las tablas
- Políticas de acceso por rol configuradas
- Validación de permisos en frontend y backend
- Autenticación segura con Supabase Auth
- Tokens JWT para sesiones

## Características de la Base de Datos

- Triggers automáticos para actualización de timestamps
- Funciones para decrementar inventario de forma segura
- Validación de stock antes de realizar ventas
- Índices optimizados para consultas rápidas
- Constraints para integridad referencial

## Desarrollo Local

1. Clona el repositorio
2. Instala dependencias: `npm install`
3. Ejecuta en desarrollo: `npm run dev`
4. Build de producción: `npm run build`

## Diseño Responsive

La aplicación está completamente optimizada para:
- Dispositivos móviles (smartphones)
- Tablets
- Computadores de escritorio

El diseño se adapta automáticamente al tamaño de la pantalla, garantizando una experiencia óptima en todos los dispositivos.

## Soporte

Para reportar problemas o solicitar nuevas características, crea un issue en el repositorio de GitHub.
