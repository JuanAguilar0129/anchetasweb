import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ShoppingBag,
  MapPin,
  Users,
  Settings,
  FileText,
  ArrowRightLeft,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

export default function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const { profile, hasPermission } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard' as const },
    { id: 'ventas', label: 'Ventas', icon: ShoppingCart, permission: 'ventas' as const },
    { id: 'devoluciones', label: 'Devoluciones', icon: RotateCcw, permission: 'devoluciones' as const },
    { id: 'inventario', label: 'Inventario', icon: Package, permission: 'inventario' as const },
    { id: 'compras', label: 'Compras', icon: ShoppingBag, permission: 'compras' as const },
    { id: 'reportes', label: 'Reportes', icon: FileText, permission: 'reportes' as const },
    { id: 'productos', label: 'Productos', icon: Settings, permission: 'productos' as const },
    { id: 'traslados', label: 'Traslados', icon: ArrowRightLeft, permission: 'traslados' as const },
    { id: 'puntos', label: 'Puntos de Venta', icon: MapPin, permission: 'puntos' as const },
    { id: 'usuarios', label: 'Usuarios', icon: Users, permission: 'usuarios' as const },
  ];

  const availableMenuItems = menuItems.filter(item => hasPermission(item.permission));

  return (
    <aside className="h-full overflow-y-auto bg-white border-r border-gray-200">
      <div className="p-4">
        <div className="mb-4 px-2">
          <div className="text-sm text-gray-500">Hola,</div>
          <div className="font-semibold">{profile?.nombre}</div>
          <div className="text-xs text-gray-400">{profile?.codigo_usuario}</div>
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