import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import LoginForm from './components/auth/LoginForm';
import Dashboard from './components/dashboard/Dashboard';
import PuntosVenta from './components/puntos/PuntosVenta';
import Productos from './components/productos/Productos';
import Inventario from './components/inventario/Inventario';
import Ventas from './components/ventas/Ventas';
import Compras from './components/compras/Compras';
import Usuarios from './components/usuarios/Usuarios';
import Reportes from './components/reportes/Reportes';
import Traslados from './components/Traslados/Traslados';

function MainApp() {
  const { user, loading } = useAuth();
  const [activeView, setActiveView] = React.useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = React.useState<boolean>(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto" />
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginForm />;

  const renderView = () => {
    switch (activeView) {
      case 'dashboard': return <Dashboard />;
      case 'puntos': return <PuntosVenta />;
      case 'productos': return <Productos />;
      case 'inventario': return <Inventario />;
      case 'ventas': return <Ventas />;
      case 'compras': return <Compras />;
      case 'reportes': return <Reportes />;
      case 'traslados': return <Traslados />;
      case 'usuarios': return <Usuarios />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar onMenuToggle={() => setSidebarOpen(v => !v)} />

      <div className="lg:flex">
        {/* Sidebar visible on large screens */}
        <div className="hidden lg:block lg:w-64">
          <Sidebar activeView={activeView} onViewChange={setActiveView} />
        </div>

        {/* Mobile slide-over sidebar */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-lg">
              <Sidebar activeView={activeView} onViewChange={(v) => { setActiveView(v); setSidebarOpen(false); }} />
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {renderView()}
          </div>
        </main>
      </div>

      {/* Bottom nav for small screens */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden">
        <div className="bg-white border-t border-gray-200">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-5 gap-1 py-2">
              <button onClick={() => setActiveView('dashboard')} className="text-center text-xs">Inicio</button>
              <button onClick={() => setActiveView('ventas')} className="text-center text-xs">Ventas</button>
              <button onClick={() => setActiveView('productos')} className="text-center text-xs">Productos</button>
              <button onClick={() => setActiveView('reportes')} className="text-center text-xs">Reportes</button>
              <button onClick={() => setActiveView('usuarios')} className="text-center text-xs">Perfil</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  // AuthProvider envuelve MainApp para que useAuth() funcione correctamente
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
