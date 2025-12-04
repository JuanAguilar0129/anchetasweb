export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'admin_general' | 'admin_punto' | 'vendedor';

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
        };
        Update: {
          id?: string;
          nombre?: string;
          codigo_usuario?: string;
          rol?: UserRole;
          activo?: boolean;
          updated_at?: string;
          password?: string;
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