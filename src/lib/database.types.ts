export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'admin_general' | 'admin_punto' | 'vendedor';

export interface UserPermissions {
  ventanas: {
    dashboard: boolean;
    ventas: boolean;
    devoluciones: boolean;
    inventario: boolean;
    compras: boolean;
    reportes: boolean;
    productos: boolean;
    traslados: boolean;
    puntos: boolean;
    usuarios: boolean;
  };
  dashboard: {
    ver_ventas_hoy: boolean;
    ver_ventas_mes: boolean;
    ver_ganancia_mes: boolean;
    ver_stock_bajo: boolean;
    ver_productos_vendidos: boolean;
    ver_producto_mas_vendido: boolean;
    ver_grafico_ventas: boolean;
  };
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          nombre: string;
          codigo_usuario: string;
          rol: UserRole;
          activo: boolean;
          created_at: string;
          updated_at: string;
          password?: string;
          permisos?: UserPermissions | null;
        };
        Insert: {
          id?: string;
          nombre: string;
          codigo_usuario: string;
          rol: UserRole;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
          password?: string;
          permisos?: UserPermissions | null;
        };
        Update: {
          id?: string;
          nombre?: string;
          codigo_usuario?: string;
          rol?: UserRole;
          activo?: boolean;
          updated_at?: string;
          password?: string;
          permisos?: UserPermissions | null;
        };
      };
      puntos_venta: {
        Row: {
          id: string;
          nombre: string;
          direccion: string;
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          direccion?: string;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          direccion?: string;
          activo?: boolean;
          updated_at?: string;
        };
      };
      usuarios_puntos: {
        Row: {
          id: string;
          user_id: string;
          punto_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          punto_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          punto_id?: string;
        };
      };
      productos: {
        Row: {
          id: string;
          nombre: string;
          descripcion: string;
          precio_venta: number;
          costo: number;
          imagen_url: string;
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          descripcion?: string;
          precio_venta?: number;
          costo?: number;
          imagen_url?: string;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          descripcion?: string;
          precio_venta?: number;
          costo?: number;
          imagen_url?: string;
          activo?: boolean;
          updated_at?: string;
        };
      };
      inventario: {
        Row: {
          id: string;
          producto_id: string;
          punto_id: string;
          cantidad: number;
          stock_minimo: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          producto_id: string;
          punto_id: string;
          cantidad?: number;
          stock_minimo?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          producto_id?: string;
          punto_id?: string;
          cantidad?: number;
          stock_minimo?: number;
          updated_at?: string;
        };
      };
      ventas: {
        Row: {
          id: string;
          punto_id: string;
          vendedor_id: string;
          fecha: string;
          total: number;
          cliente_nombre: string;
          cliente_telefono: string;
          notas: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          punto_id: string;
          vendedor_id: string;
          fecha?: string;
          total?: number;
          cliente_nombre?: string;
          cliente_telefono?: string;
          notas?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          punto_id?: string;
          vendedor_id?: string;
          fecha?: string;
          total?: number;
          cliente_nombre?: string;
          cliente_telefono?: string;
          notas?: string;
        };
      };
      ventas_detalle: {
        Row: {
          id: string;
          venta_id: string;
          producto_id: string;
          cantidad: number;
          precio_unitario: number;
          subtotal: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          venta_id: string;
          producto_id: string;
          cantidad: number;
          precio_unitario: number;
          subtotal: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          venta_id?: string;
          producto_id?: string;
          cantidad?: number;
          precio_unitario?: number;
          subtotal?: number;
        };
      };
      compras: {
        Row: {
          id: string;
          punto_id: string;
          usuario_id: string;
          fecha: string;
          total: number;
          proveedor: string;
          notas: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          punto_id: string;
          usuario_id: string;
          fecha?: string;
          total?: number;
          proveedor?: string;
          notas?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          punto_id?: string;
          usuario_id?: string;
          fecha?: string;
          total?: number;
          proveedor?: string;
          notas?: string;
        };
      };
      compras_detalle: {
        Row: {
          id: string;
          compra_id: string;
          producto_id: string;
          cantidad: number;
          precio_unitario: number;
          subtotal: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          compra_id: string;
          producto_id: string;
          cantidad: number;
          precio_unitario: number;
          subtotal: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          compra_id?: string;
          producto_id?: string;
          cantidad?: number;
          precio_unitario?: number;
          subtotal?: number;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}