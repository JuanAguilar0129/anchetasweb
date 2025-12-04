import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ShoppingBag,
  MapPin,
  Users,
  Settings,
  FileText,
  ArrowRightLeft
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

export default function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const { profile } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin_general', 'admin_punto', 'vendedor'] },
    { id: 'ventas', label: 'Ventas', icon: ShoppingCart, roles: ['admin_general', 'admin_punto', 'vendedor'] },
    { id: 'inventario', label: 'Inventario', icon: Package, roles: ['admin_general', 'admin_punto', 'vendedor'] },
    { id: 'compras', label: 'Compras', icon: ShoppingBag, roles: ['admin_general', 'admin_punto'] },
    { id: 'reportes', label: 'Reportes', icon: FileText, roles: ['admin_general', 'admin_punto'] },
    { id: 'productos', label: 'Productos', icon: Settings, roles: ['admin_general', 'admin_punto'] },
    { id: 'traslados', label: 'Traslados', icon: ArrowRightLeft, roles: ['admin_general', 'admin_punto'] },
    { id: 'puntos', label: 'Puntos de Venta', icon: MapPin, roles: ['admin_general'] },
    { id: 'usuarios', label: 'Usuarios', icon: Users, roles: ['admin_general'] },
  ];

  const availableMenuItems = menuItems.filter(item => profile && item.roles.includes(profile.rol));

  return (
    <aside className="h-full overflow-y-auto bg-white border-r border-gray-200">
      <div className="p-4">
        <div className="mb-4 px-2">
          <div className="text-sm text-gray-500">Hola,</div>
          <div className="font-semibold">{profile?.nombre}</div>
          <div className="text-xs text-gray-400">{profile?.email}</div>
        </div>

        <nav className="space-y-2">
          {availableMenuItems.map(item => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition duration-150 ${active ? 'bg-teal-600 text-white shadow' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-6 px-2 text-xs text-gray-400">Versión móvil optimizada • Toque para navegar</div>
      </div>
    </aside>
  );
}
