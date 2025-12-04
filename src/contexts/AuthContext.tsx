import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { UserRole } from '../lib/database.types';

interface Profile {
  id: string;
  nombre: string;
  codigo_usuario: string;
  rol: UserRole;
  activo: boolean;
  created_at: string;
  updated_at: string;
  password?: string;
}

interface PuntoVenta {
  id: string;
  nombre: string;
  direccion: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: Profile | null;
  profile: Profile | null;
  puntosAsignados: PuntoVenta[];
  loading: boolean;
  signIn: (codigoUsuario: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isAdminPunto: boolean;
  isVendedor: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [puntosAsignados, setPuntosAsignados] = useState<PuntoVenta[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPuntosAsignados = async (userId: string, userRole: UserRole) => {
    try {
      // Si es admin general, cargar todos los puntos
      if (userRole === 'admin_general') {
        const { data: puntos } = await supabase
          .from('puntos_venta')
          .select('*')
          .eq('activo', true);
        
        setPuntosAsignados((puntos as PuntoVenta[]) || []);
      } else {
        // Para otros usuarios, cargar solo sus puntos asignados
        const { data: usuariosPuntos } = await supabase
          .from('usuarios_puntos')
          .select('punto_id')
          .eq('user_id', userId);

        if (usuariosPuntos && usuariosPuntos.length > 0) {
          const puntoIds = usuariosPuntos.map((up: any) => up.punto_id);
          
          const { data: puntos } = await supabase
            .from('puntos_venta')
            .select('*')
            .in('id', puntoIds)
            .eq('activo', true);
            
          setPuntosAsignados((puntos as PuntoVenta[]) || []);
        }
      }
    } catch (error) {
      console.error('Error loading puntos:', error);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .eq('activo', true)
        .single();

      if (profileData) {
        const typedProfile = profileData as Profile;
        const userWithoutPassword = { ...typedProfile };
        delete userWithoutPassword.password;
        
        setUser(userWithoutPassword);
        setProfile(userWithoutPassword);
        
        localStorage.setItem('anchetas_user', JSON.stringify(userWithoutPassword));
        await loadPuntosAsignados(typedProfile.id, typedProfile.rol);
      }
    }
  };

  // Cargar usuario desde localStorage al iniciar
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = localStorage.getItem('anchetas_user');
        if (storedUser) {
          const userData: Profile = JSON.parse(storedUser);
          
          // Verificar que el usuario sigue activo en la BD
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userData.id)
            .eq('activo', true)
            .single();

          if (profileData) {
            const typedProfile = profileData as Profile;
            const userWithoutPassword = { ...typedProfile };
            delete userWithoutPassword.password;
            
            setUser(userWithoutPassword);
            setProfile(userWithoutPassword);
            await loadPuntosAsignados(typedProfile.id, typedProfile.rol);
          } else {
            // Usuario ya no existe o está inactivo
            localStorage.removeItem('anchetas_user');
          }
        }
      } catch (error) {
        console.error('Error loading user:', error);
        localStorage.removeItem('anchetas_user');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const signIn = async (codigoUsuario: string, password: string) => {
    try {
      // Buscar usuario por código
      const { data: userData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('codigo_usuario', codigoUsuario)
        .maybeSingle();

      console.log('Query result:', { userData, error });

      if (error) {
        console.error('Supabase error:', error);
        throw new Error('Error al consultar usuario: ' + error.message);
      }

      if (!userData) {
        throw new Error('Usuario no encontrado o inactivo');
      }

      const typedUser = userData as Profile;

      // Verificar si está activo
      if (!typedUser.activo) {
        throw new Error('Usuario no encontrado o inactivo');
      }

      // Verificar contraseña (comparación simple en texto plano)
      if (typedUser.password !== password) {
        throw new Error('Credenciales incorrectas');
      }

      // Login exitoso - remover password del objeto
      const userWithoutPassword = { ...typedUser };
      delete userWithoutPassword.password;

      setUser(userWithoutPassword);
      setProfile(userWithoutPassword);
      
      // Guardar en localStorage
      localStorage.setItem('anchetas_user', JSON.stringify(userWithoutPassword));
      
      // Cargar puntos asignados
      await loadPuntosAsignados(typedUser.id, typedUser.rol);
      
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    setUser(null);
    setProfile(null);
    setPuntosAsignados([]);
    localStorage.removeItem('anchetas_user');
  };

  const isAdmin = profile?.rol === 'admin_general';
  const isAdminPunto = profile?.rol === 'admin_punto';
  const isVendedor = profile?.rol === 'vendedor';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        puntosAsignados,
        loading,
        signIn,
        signOut,
        isAdmin,
        isAdminPunto,
        isVendedor,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}