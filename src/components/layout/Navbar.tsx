import React from 'react';
import { LogOut, User as UserIcon, MapPin, Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface NavbarProps {
  onMenuToggle?: () => void;
}

export default function Navbar({ onMenuToggle }: NavbarProps) {
  const { profile, signOut, puntosAsignados } = useAuth();

  const getRoleName = (rol: string) => {
    const roles: Record<string, string> = {
      admin_general: 'Administrador General',
      admin_punto: 'Administrador de Punto',
      vendedor: 'Vendedor'
    };
    return roles[rol] || rol;
  };

  return (
    <nav className="bg-white shadow-md border-b border-gray-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-md" onClick={onMenuToggle} aria-label="Abrir menú">
              <Menu className="w-5 h-5 text-gray-600" />
            </button>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-teal-600 flex items-center justify-center text-white font-semibold">TP</div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-semibold text-teal-600">Sistema Anchetas</h1>
                <p className="text-xs text-gray-500">Punto de venta</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center space-x-2 bg-gray-50 px-3 py-2 rounded-lg">
                <UserIcon className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="font-semibold text-gray-900">{profile?.nombre}</p>
                  <p className="text-xs text-gray-500">{profile && getRoleName(profile.rol)}</p>
                </div>
              </div>

              {puntosAsignados?.length > 0 && (
                <div className="flex items-center space-x-2 bg-teal-50 px-3 py-2 rounded-lg">
                  <MapPin className="w-4 h-4 text-teal-600" />
                  <span className="text-xs text-teal-700">{puntosAsignados.length} {puntosAsignados.length === 1 ? 'punto' : 'puntos'}</span>
                </div>
              )}
            </div>

            <button onClick={() => signOut()} className="flex items-center space-x-2 bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 rounded-lg transition duration-200">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
