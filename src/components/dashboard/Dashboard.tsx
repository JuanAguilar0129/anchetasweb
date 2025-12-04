import { useEffect, useState } from 'react';
import { TrendingUp, DollarSign, Package, ShoppingCart, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Stats {
  ventasHoy: number;
  ventasMes: number;
  productosVendidosHoy: number;
  productosVendidosMes: number;
  gananciaMes: number;
  stockBajo: number;
  productoMasVendido: { nombre: string; cantidad: number } | null;
  ventasPorDia: { fecha: string; total: number; cantidad: number }[];
}

export default function Dashboard() {
  const { puntosAsignados, isAdmin } = useAuth();
  const [stats, setStats] = useState<Stats>({
    ventasHoy: 0,
    ventasMes: 0,
    productosVendidosHoy: 0,
    productosVendidosMes: 0,
    gananciaMes: 0,
    stockBajo: 0,
    productoMasVendido: null,
    ventasPorDia: []
  });
  const [loading, setLoading] = useState(true);
  const [selectedPunto, setSelectedPunto] = useState<string>(puntosAsignados[0]?.id || 'all');

  useEffect(() => {
    if (puntosAsignados.length > 0 && selectedPunto === 'all' && !isAdmin) {
      setSelectedPunto(puntosAsignados[0].id);
    }
  }, [puntosAsignados, isAdmin, selectedPunto]);

  useEffect(() => {
    loadStats();
  }, [selectedPunto]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const puntoFilter = selectedPunto === 'all' ? {} : { punto_id: selectedPunto };

      const { data: ventasHoy } = await (supabase as any)
        .from('ventas')
        .select('id, total')
        .gte('created_at', `${today}T00:00:00`)
        .match(puntoFilter);

      const { data: ventasMes } = await (supabase as any)
        .from('ventas')
        .select('id, total, created_at')
        .gte('created_at', firstDayOfMonth)
        .match(puntoFilter)
        .order('created_at', { ascending: true });

      const ventasIds = ventasMes?.map((v: any) => v.id) || [];
      const { data: detallesMes } = ventasIds.length > 0 
        ? await (supabase as any)
            .from('ventas_detalle')
            .select('cantidad, producto_id, precio_unitario, productos(costo)')
            .in('venta_id', ventasIds)
        : { data: [] };

      const ventasHoyIds = ventasHoy?.map((v: any) => v.id) || [];
      const { data: detallesHoy } = ventasHoyIds.length > 0
        ? await (supabase as any)
            .from('ventas_detalle')
            .select('cantidad')
            .in('venta_id', ventasHoyIds)
        : { data: [] };

      // Inventario bajo - query simplificado
      const { data: inventarioBajo } = await (supabase as any)
        .from('inventario')
        .select('cantidad, stock_minimo')
        .match(selectedPunto === 'all' ? {} : { punto_id: selectedPunto });

      // Filtrar en JavaScript donde cantidad <= stock_minimo
      const stockBajoCount = inventarioBajo?.filter((item: any) => item.cantidad <= item.stock_minimo).length || 0;

      const productoVentas: { [key: string]: { cantidad: number; nombre: string } } = {};
      
      if (detallesMes && detallesMes.length > 0) {
        const productosIds = [...new Set(detallesMes.map((d: any) => d.producto_id))];
        const { data: productos } = await (supabase as any)
          .from('productos')
          .select('id, nombre')
          .in('id', productosIds);

        detallesMes.forEach((detalle: any) => {
          const producto = productos?.find((p: any) => p.id === detalle.producto_id);
          if (producto) {
            if (!productoVentas[detalle.producto_id]) {
              productoVentas[detalle.producto_id] = { cantidad: 0, nombre: producto.nombre };
            }
            productoVentas[detalle.producto_id].cantidad += detalle.cantidad;
          }
        });
      }

      const masVendido = Object.values(productoVentas).sort((a, b) => b.cantidad - a.cantidad)[0] || null;

      const gananciaMes = detallesMes?.reduce((sum: number, detalle: any) => {
        const precioVenta = detalle.precio_unitario || 0;
        const costo = detalle.productos?.costo || 0;
        const ganancia = (precioVenta - costo) * detalle.cantidad;
        return sum + ganancia;
      }, 0) || 0;

      const ventasPorDia = [];
      for (let i = 6; i >= 0; i--) {
        const fecha = new Date();
        fecha.setDate(fecha.getDate() - i);
        const fechaStr = fecha.toISOString().split('T')[0];
        
        const ventasDia = ventasMes?.filter((v: any) => v.created_at.startsWith(fechaStr)) || [];
        const total = ventasDia.reduce((sum: number, v: any) => sum + v.total, 0);
        
        ventasPorDia.push({
          fecha: fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
          total,
          cantidad: ventasDia.length
        });
      }

      setStats({
        ventasHoy: ventasHoy?.reduce((sum: number, v: any) => sum + v.total, 0) || 0,
        ventasMes: ventasMes?.reduce((sum: number, v: any) => sum + v.total, 0) || 0,
        productosVendidosHoy: detallesHoy?.reduce((sum: number, d: any) => sum + d.cantidad, 0) || 0,
        productosVendidosMes: detallesMes?.reduce((sum: number, d: any) => sum + d.cantidad, 0) || 0,
        gananciaMes,
        stockBajo: stockBajoCount,
        productoMasVendido: masVendido,
        ventasPorDia
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  };

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    color = 'teal' 
  }: { 
    title: string; 
    value: string | number; 
    icon: any; 
    color?: string;
  }) => (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <div className={`p-3 rounded-lg ${
          color === 'teal' ? 'bg-teal-100' :
          color === 'blue' ? 'bg-blue-100' :
          color === 'green' ? 'bg-green-100' :
          color === 'orange' ? 'bg-orange-100' : 'bg-gray-100'
        }`}>
          <Icon className={`w-6 h-6 ${
            color === 'teal' ? 'text-teal-600' :
            color === 'blue' ? 'text-blue-600' :
            color === 'green' ? 'text-green-600' :
            color === 'orange' ? 'text-orange-600' : 'text-gray-600'
          }`} />
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Cargando estadísticas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-600 mt-1">Resumen de tu negocio</p>
        </div>

        {(isAdmin || puntosAsignados.length > 1) && (
          <select
            value={selectedPunto}
            onChange={(e) => setSelectedPunto(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            {isAdmin && <option value="all">Todos los puntos</option>}
            {puntosAsignados.map((punto: { id: string; nombre: string }) => (
              <option key={punto.id} value={punto.id}>{punto.nombre}</option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Ventas Hoy"
          value={formatCurrency(stats.ventasHoy)}
          icon={DollarSign}
          color="teal"
        />
        <StatCard
          title="Ventas del Mes"
          value={formatCurrency(stats.ventasMes)}
          icon={ShoppingCart}
          color="blue"
        />
        <StatCard
          title="Ganancia del Mes"
          value={formatCurrency(stats.gananciaMes)}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Productos Stock Bajo"
          value={stats.stockBajo}
          icon={AlertTriangle}
          color="orange"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Ventas por Día (Últimos 7 días)</h3>
          <div className="space-y-3">
            {stats.ventasPorDia.map((dia, index) => {
              const maxVenta = Math.max(...stats.ventasPorDia.map(d => d.total));
              const percentage = maxVenta > 0 ? (dia.total / maxVenta) * 100 : 0;
              
              return (
                <div key={index}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{dia.fecha}</span>
                    <span className="text-teal-600 font-semibold">{formatCurrency(dia.total)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-teal-600 h-2 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{dia.cantidad} {dia.cantidad === 1 ? 'venta' : 'ventas'}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Resumen del Mes</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-teal-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Package className="w-8 h-8 text-teal-600" />
                <div>
                  <p className="text-sm text-gray-600">Productos Vendidos Hoy</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.productosVendidosHoy}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <ShoppingCart className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Productos Vendidos Este Mes</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.productosVendidosMes}</p>
                </div>
              </div>
            </div>

            {stats.productoMasVendido && (
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <TrendingUp className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">Producto Más Vendido</p>
                    <p className="text-lg font-bold text-gray-900">{stats.productoMasVendido.nombre}</p>
                    <p className="text-sm text-gray-600">{stats.productoMasVendido.cantidad} unidades</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}