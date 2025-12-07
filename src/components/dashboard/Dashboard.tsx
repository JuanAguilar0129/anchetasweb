import { useEffect, useState } from 'react';
import { TrendingUp, DollarSign, Package, ShoppingCart, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Venta {
  id: string;
  total: number;
  created_at: string;
  [key: string]: any;
}

interface VentaDetalle {
  cantidad: number;
  precio: number;
  costo?: number;
  [key: string]: any;
}

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

// Función para obtener la fecha/hora actual en Colombia (UTC-5)
const getColombiaDate = (): Date => {
  const now = new Date();
  // Convertir a UTC y luego restar 5 horas para Colombia
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const colombiaTime = new Date(utcTime - (5 * 60 * 60 * 1000));
  return colombiaTime;
};

// Función para convertir fecha a string YYYY-MM-DD
const toDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Dashboard() {
  const { puntosAsignados, isAdmin, hasDashboardPermission } = useAuth();
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
      
      // Obtener fecha actual en Colombia
      const colombiaNow = getColombiaDate();
      const today = toDateString(colombiaNow);
      
      console.log('📅 Fecha Colombia (hoy):', today);
      console.log('🕐 Hora Colombia:', colombiaNow.toLocaleString('es-CO'));
      
      const firstDayOfMonth = new Date(colombiaNow.getFullYear(), colombiaNow.getMonth(), 1);
      const firstDayOfMonthStr = toDateString(firstDayOfMonth);

      const puntoFilter = selectedPunto === 'all' ? {} : { punto_id: selectedPunto };

      // ===== VENTAS DE HOY =====
      const todayStart = `${today}T00:00:00-05:00`;
      const todayEnd = `${today}T23:59:59-05:00`;
      
      console.log('🔍 Buscando ventas entre:', todayStart, 'y', todayEnd);

      const { data: ventasHoy } = await (supabase as any)
        .from('ventas')
        .select('id, total, created_at')
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd)
        .match(puntoFilter);

      console.log('✅ Ventas de hoy encontradas:', ventasHoy?.length || 0, ventasHoy);

      // ===== VENTAS DEL MES =====
      const { data: ventasMes } = await (supabase as any)
        .from('ventas')
        .select('id, total, created_at')
        .gte('created_at', `${firstDayOfMonthStr}T00:00:00-05:00`)
        .match(puntoFilter)
        .order('created_at', { ascending: true });

      // ===== DETALLES DE VENTAS DEL MES =====
      const ventasMesIds = ventasMes?.map((v: any) => v.id) || [];
      const { data: detallesMes } = ventasMesIds.length > 0 
        ? await (supabase as any)
            .from('ventas_detalle')
            .select('cantidad, producto_id, precio_unitario, productos(costo)')
            .in('venta_id', ventasMesIds)
        : { data: [] };

      // ===== DETALLES DE VENTAS DE HOY =====
      const ventasHoyIds = ventasHoy?.map((v: any) => v.id) || [];
      const { data: detallesHoy } = ventasHoyIds.length > 0
        ? await (supabase as any)
            .from('ventas_detalle')
            .select('cantidad')
            .in('venta_id', ventasHoyIds)
        : { data: [] };

      // ===== INVENTARIO BAJO =====
      const { data: inventarioBajo } = await (supabase as any)
        .from('inventario')
        .select('cantidad, stock_minimo')
        .match(selectedPunto === 'all' ? {} : { punto_id: selectedPunto });

      const stockBajoCount = inventarioBajo?.filter((item: any) => item.cantidad <= item.stock_minimo).length || 0;

      // ===== PRODUCTO MÁS VENDIDO =====
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

      // ===== GANANCIA DEL MES =====
      const gananciaMes = detallesMes?.reduce((sum: number, detalle: VentaDetalle) => {
        const precioVenta = detalle.precio_unitario || 0;
        const costo = detalle.productos?.costo || 0;
        const ganancia = (precioVenta - costo) * detalle.cantidad;
        return sum + ganancia;
      }, 0) || 0;

      // ===== VENTAS POR DÍA (ÚLTIMOS 7 DÍAS) =====
      const ventasPorDia = [];
      for (let i = 6; i >= 0; i--) {
        const fecha = new Date(colombiaNow);
        fecha.setDate(fecha.getDate() - i);
        const fechaStr = toDateString(fecha);
        
        const ventasDia = ventasMes?.filter((v: any) => {
          const ventaDate = new Date(v.created_at);
          const ventaDateStr = toDateString(ventaDate);
          return ventaDateStr === fechaStr;
        }) || [];
        
        const total = ventasDia.reduce((sum: number, v: Venta) => sum + v.total, 0);
        
        ventasPorDia.push({
          fecha: fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
          total,
          cantidad: ventasDia.length
        });
      }

      // ===== CALCULAR TOTALES =====
      const totalVentasHoy = ventasHoy?.reduce((sum: number, v: Venta) => sum + v.total, 0) || 0;
      const totalVentasMes = ventasMes?.reduce((sum: number, v: Venta) => sum + v.total, 0) || 0;
      const totalProductosHoy = detallesHoy?.reduce((sum: number, d: VentaDetalle) => sum + d.cantidad, 0) || 0;
      const totalProductosMes = detallesMes?.reduce((sum: number, d: VentaDetalle) => sum + d.cantidad, 0) || 0;

      console.log('📊 Totales calculados:', {
        ventasHoy: totalVentasHoy,
        ventasMes: totalVentasMes,
        productosHoy: totalProductosHoy,
        productosMes: totalProductosMes
      });

      setStats({
        ventasHoy: totalVentasHoy,
        ventasMes: totalVentasMes,
        productosVendidosHoy: totalProductosHoy,
        productosVendidosMes: totalProductosMes,
        gananciaMes,
        stockBajo: stockBajoCount,
        productoMasVendido: masVendido,
        ventasPorDia
      });
    } catch (error) {
      console.error('❌ Error loading stats:', error);
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
    color = 'teal',
    show = true
  }: { 
    title: string; 
    value: string | number; 
    icon: any; 
    color?: string;
    show?: boolean;
  }) => {
    if (!show) return null;
    
    return (
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h3 className="text-xs md:text-sm font-medium text-gray-600">{title}</h3>
          <div className={`p-2 md:p-3 rounded-lg ${
            color === 'teal' ? 'bg-teal-100' :
            color === 'blue' ? 'bg-blue-100' :
            color === 'green' ? 'bg-green-100' :
            color === 'orange' ? 'bg-orange-100' : 'bg-gray-100'
          }`}>
            <Icon className={`w-5 h-5 md:w-6 md:h-6 ${
              color === 'teal' ? 'text-teal-600' :
              color === 'blue' ? 'text-blue-600' :
              color === 'green' ? 'text-green-600' :
              color === 'orange' ? 'text-orange-600' : 'text-gray-600'
            }`} />
          </div>
        </div>
        <p className="text-2xl md:text-3xl font-bold text-gray-900">{value}</p>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Cargando estadísticas...</p>
      </div>
    );
  }

  const visibleStats = [
    hasDashboardPermission('ver_ventas_hoy'),
    hasDashboardPermission('ver_ventas_mes'),
    hasDashboardPermission('ver_ganancia_mes'),
    hasDashboardPermission('ver_stock_bajo')
  ].filter(Boolean).length;

  const gridCols = visibleStats === 0 ? 'grid-cols-1' :
                   visibleStats === 1 ? 'grid-cols-1' :
                   visibleStats === 2 ? 'grid-cols-2' :
                   visibleStats === 3 ? 'grid-cols-2 lg:grid-cols-3' :
                   'grid-cols-2 lg:grid-cols-4';

  return (
    <div className="space-y-4 md:space-y-6 p-3 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm md:text-base text-gray-600 mt-1">Resumen de tu negocio</p>
        </div>

        {(isAdmin || puntosAsignados.length > 1) && (
          <select
            value={selectedPunto}
            onChange={(e) => setSelectedPunto(e.target.value)}
            className="w-full sm:w-auto px-3 md:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            {isAdmin && <option value="all">Todos los puntos</option>}
            {puntosAsignados.map((punto: { id: string; nombre: string }) => (
              <option key={punto.id} value={punto.id}>{punto.nombre}</option>
            ))}
          </select>
        )}
      </div>

      {visibleStats === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">No tienes permisos para ver estadísticas en el dashboard.</p>
        </div>
      )}

      {visibleStats > 0 && (
        <div className={`grid ${gridCols} gap-3 md:gap-6`}>
          <StatCard
            title="Ventas Hoy"
            value={formatCurrency(stats.ventasHoy)}
            icon={DollarSign}
            color="teal"
            show={hasDashboardPermission('ver_ventas_hoy')}
          />
          <StatCard
            title="Ventas del Mes"
            value={formatCurrency(stats.ventasMes)}
            icon={ShoppingCart}
            color="blue"
            show={hasDashboardPermission('ver_ventas_mes')}
          />
          <StatCard
            title="Ganancia del Mes"
            value={formatCurrency(stats.gananciaMes)}
            icon={TrendingUp}
            color="green"
            show={hasDashboardPermission('ver_ganancia_mes')}
          />
          <StatCard
            title="Stock Bajo"
            value={stats.stockBajo}
            icon={AlertTriangle}
            color="orange"
            show={hasDashboardPermission('ver_stock_bajo')}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {hasDashboardPermission('ver_grafico_ventas') && (
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
            <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-4">Ventas por Día (Últimos 7 días)</h3>
            <div className="space-y-3">
              {stats.ventasPorDia.map((dia, index) => {
                const maxVenta = Math.max(...stats.ventasPorDia.map(d => d.total));
                const percentage = maxVenta > 0 ? (dia.total / maxVenta) * 100 : 0;
                
                return (
                  <div key={index}>
                    <div className="flex justify-between text-xs md:text-sm mb-1">
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
        )}

        {(hasDashboardPermission('ver_productos_vendidos') || hasDashboardPermission('ver_producto_mas_vendido')) && (
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
            <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-4">Resumen del Mes</h3>
            <div className="space-y-3 md:space-y-4">
              {hasDashboardPermission('ver_productos_vendidos') && (
                <>
                  <div className="flex items-center justify-between p-3 md:p-4 bg-teal-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Package className="w-6 h-6 md:w-8 md:h-8 text-teal-600" />
                      <div>
                        <p className="text-xs md:text-sm text-gray-600">Productos Vendidos Hoy</p>
                        <p className="text-xl md:text-2xl font-bold text-gray-900">{stats.productosVendidosHoy}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 md:p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <ShoppingCart className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
                      <div>
                        <p className="text-xs md:text-sm text-gray-600">Productos Vendidos Este Mes</p>
                        <p className="text-xl md:text-2xl font-bold text-gray-900">{stats.productosVendidosMes}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {hasDashboardPermission('ver_producto_mas_vendido') && stats.productoMasVendido && (
                <div className="flex items-center justify-between p-3 md:p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <TrendingUp className="w-6 h-6 md:w-8 md:h-8 text-green-600" />
                    <div>
                      <p className="text-xs md:text-sm text-gray-600">Producto Más Vendido</p>
                      <p className="text-base md:text-lg font-bold text-gray-900 line-clamp-1">{stats.productoMasVendido.nombre}</p>
                      <p className="text-xs md:text-sm text-gray-600">{stats.productoMasVendido.cantidad} unidades</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}