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

// Importaciones opcionales - comentar si no existen
// import Traslados from './components/traslados/Traslados';
// import Devoluciones from './components/devoluciones/Devoluciones';

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
      case 'usuarios': return <Usuarios />;
      
      // Descomentar cuando existan estos componentes
      // case 'traslados': return <Traslados />;
      // case 'devoluciones': return <Devoluciones />;
      
      // Temporales - hasta que existan los componentes
      case 'traslados': 
        return <div className="p-6 text-center"><p className="text-gray-600">Módulo de Traslados en desarrollo</p></div>;
      case 'devoluciones': 
        return <div className="p-6 text-center"><p className="text-gray-600">Módulo de Devoluciones en desarrollo</p></div>;
      
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex h-[calc(100vh-4rem)]">
        <div className={`
          fixed inset-y-0 left-0 top-16 z-30 w-64 transform transition-transform duration-300 ease-in-out
          lg:relative lg:top-0 lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <Sidebar activeView={activeView} onViewChange={(view) => {
            setActiveView(view);
            setSidebarOpen(false);
          }} />
        </div>

        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden top-16"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {renderView()}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;