import { useState, useEffect } from 'react';
import { FileText, Download, Search, Filter, Calendar, Package, DollarSign, TrendingUp, Eye, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Venta {
  id: string;
  numero_factura: string;
  created_at: string;
  total: number;
  metodo_pago: string;
  punto_nombre: string;
  usuario_nombre: string;
  productos: Array<{
    nombre: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }>;
}

interface Producto {
  id: string;
  nombre: string;
}

export default function ReporteVentasDetallado() {
  const { puntosAsignados, isAdmin } = useAuth();
  
  // Estados de filtros
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [puntoFiltro, setPuntoFiltro] = useState('todos');
  const [metodoPagoFiltro, setMetodoPagoFiltro] = useState('todos');
  const [productoFiltro, setProductoFiltro] = useState('todos');
  const [busquedaFactura, setBusquedaFactura] = useState('');
  const [rangoMontoMin, setRangoMontoMin] = useState('');
  const [rangoMontoMax, setRangoMontoMax] = useState('');
  
  // Estados de datos
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(false);
  const [mostrarFiltros, setMostrarFiltros] = useState(true);
  const [ventaSeleccionada, setVentaSeleccionada] = useState<Venta | null>(null);
  
  // Estadísticas
  const [estadisticas, setEstadisticas] = useState({
    totalVentas: 0,
    totalUnidades: 0,
    ticketPromedio: 0,
    ventaPorMetodo: {} as Record<string, number>
  });

  useEffect(() => {
    // Establecer fecha de hoy por defecto
    const hoy = new Date().toISOString().split('T')[0];
    const haceUnMes = new Date();
    haceUnMes.setMonth(haceUnMes.getMonth() - 1);
    
    setFechaInicio(haceUnMes.toISOString().split('T')[0]);
    setFechaFin(hoy);
    
    cargarProductos();
  }, []);

  useEffect(() => {
    if (fechaInicio && fechaFin) {
      cargarVentas();
    }
  }, [fechaInicio, fechaFin, puntoFiltro, metodoPagoFiltro, productoFiltro, busquedaFactura, rangoMontoMin, rangoMontoMax]);

  const cargarProductos = async () => {
    try {
      const { data } = await supabase
        .from('productos')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre');
      
      if (data) setProductos(data);
    } catch (error) {
      console.error('Error cargando productos:', error);
    }
  };

  const cargarVentas = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('ventas')
        .select(`
          id,
          numero_factura,
          created_at,
          total,
          metodo_pago,
          punto_id,
          usuario_id,
          puntos_venta!inner(nombre),
          profiles!inner(nombre),
          ventas_detalle!inner(
            cantidad,
            precio_unitario,
            subtotal,
            productos!inner(nombre)
          )
        `)
        .gte('created_at', fechaInicio + 'T00:00:00')
        .lte('created_at', fechaFin + 'T23:59:59')
        .order('created_at', { ascending: false });

      // Filtrar por punto de venta
      if (puntoFiltro !== 'todos') {
        query = query.eq('punto_id', puntoFiltro);
      } else if (!isAdmin) {
        const puntosIds = puntosAsignados.map(p => p.id);
        query = query.in('punto_id', puntosIds);
      }

      // Filtrar por método de pago
      if (metodoPagoFiltro !== 'todos') {
        query = query.eq('metodo_pago', metodoPagoFiltro);
      }

      // Filtrar por búsqueda de factura
      if (busquedaFactura) {
        query = query.ilike('numero_factura', `%${busquedaFactura}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      let ventasProcesadas = (data || []).map((v: any) => ({
        id: v.id,
        numero_factura: v.numero_factura || v.id.substring(0, 8),
        created_at: v.created_at,
        total: v.total,
        metodo_pago: v.metodo_pago,
        punto_nombre: v.puntos_venta?.nombre || '',
        usuario_nombre: v.profiles?.nombre || '',
        productos: (v.ventas_detalle || []).map((d: any) => ({
          nombre: d.productos?.nombre || '',
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario,
          subtotal: d.subtotal
        }))
      }));

      // Filtrar por producto
      if (productoFiltro !== 'todos') {
        ventasProcesadas = ventasProcesadas.filter((v: Venta) =>
          v.productos.some(p => productos.find(prod => prod.id === productoFiltro)?.nombre === p.nombre)
        );
      }

      // Filtrar por rango de monto
      if (rangoMontoMin) {
        ventasProcesadas = ventasProcesadas.filter(v => v.total >= parseFloat(rangoMontoMin));
      }
      if (rangoMontoMax) {
        ventasProcesadas = ventasProcesadas.filter(v => v.total <= parseFloat(rangoMontoMax));
      }

      setVentas(ventasProcesadas);
      calcularEstadisticas(ventasProcesadas);
    } catch (error) {
      console.error('Error cargando ventas:', error);
    } finally {
      setLoading(false);
    }
  };

  const calcularEstadisticas = (ventasData: Venta[]) => {
    const totalVentas = ventasData.reduce((sum, v) => sum + v.total, 0);
    const totalUnidades = ventasData.reduce((sum, v) => 
      sum + v.productos.reduce((pSum, p) => pSum + p.cantidad, 0), 0
    );
    const ticketPromedio = ventasData.length > 0 ? totalVentas / ventasData.length : 0;
    
    const ventaPorMetodo: Record<string, number> = {};
    ventasData.forEach(v => {
      ventaPorMetodo[v.metodo_pago] = (ventaPorMetodo[v.metodo_pago] || 0) + v.total;
    });

    setEstadisticas({
      totalVentas,
      totalUnidades,
      ticketPromedio,
      ventaPorMetodo
    });
  };

  const exportarExcel = () => {
    // Crear CSV
    let csv = 'Número Factura,Fecha,Hora,Punto de Venta,Método de Pago,Usuario,Total,Productos\n';
    
    ventas.forEach(v => {
      const fecha = new Date(v.created_at);
      const fechaStr = fecha.toLocaleDateString('es-CO');
      const horaStr = fecha.toLocaleTimeString('es-CO');
      const productosStr = v.productos.map(p => `${p.nombre} (${p.cantidad})`).join('; ');
      
      csv += `${v.numero_factura},${fechaStr},${horaStr},${v.punto_nombre},${v.metodo_pago},${v.usuario_nombre},${v.total},"${productosStr}"\n`;
    });

    // Descargar
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ventas_detallado_${fechaInicio}_${fechaFin}.csv`;
    link.click();
  };

  const limpiarFiltros = () => {
    const hoy = new Date().toISOString().split('T')[0];
    const haceUnMes = new Date();
    haceUnMes.setMonth(haceUnMes.getMonth() - 1);
    
    setFechaInicio(haceUnMes.toISOString().split('T')[0]);
    setFechaFin(hoy);
    setPuntoFiltro('todos');
    setMetodoPagoFiltro('todos');
    setProductoFiltro('todos');
    setBusquedaFactura('');
    setRangoMontoMin('');
    setRangoMontoMax('');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="w-8 h-8 text-blue-600" />
            Reporte de Ventas Detallado
          </h1>
          <p className="text-gray-600 mt-1">Análisis completo de ventas con múltiples filtros</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 flex items-center gap-2"
          >
            <Filter className="w-5 h-5" />
            {mostrarFiltros ? 'Ocultar' : 'Mostrar'} Filtros
          </button>
          <button
            onClick={exportarExcel}
            disabled={ventas.length === 0}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:bg-gray-400"
          >
            <Download className="w-5 h-5" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Estadísticas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Ventas</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(estadisticas.totalVentas)}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Facturas</p>
              <p className="text-2xl font-bold text-gray-900">{ventas.length}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ticket Promedio</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(estadisticas.ticketPromedio)}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Unidades Vendidas</p>
              <p className="text-2xl font-bold text-gray-900">{estadisticas.totalUnidades}</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <Package className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filtros Avanzados */}
      {mostrarFiltros && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Filtros de Búsqueda</h3>
            <button
              onClick={limpiarFiltros}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Limpiar filtros
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Fechas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Fecha Inicio
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Fecha Fin
              </label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Búsqueda por factura */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Search className="w-4 h-4 inline mr-1" />
                Número de Factura
              </label>
              <input
                type="text"
                value={busquedaFactura}
                onChange={(e) => setBusquedaFactura(e.target.value)}
                placeholder="Ej: FAC000123"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Punto de venta */}
            {(isAdmin || puntosAsignados.length > 1) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Punto de Venta
                </label>
                <select
                  value={puntoFiltro}
                  onChange={(e) => setPuntoFiltro(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="todos">Todos los puntos</option>
                  {puntosAsignados.map(punto => (
                    <option key={punto.id} value={punto.id}>{punto.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Método de pago */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Método de Pago
              </label>
              <select
                value={metodoPagoFiltro}
                onChange={(e) => setMetodoPagoFiltro(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos los métodos</option>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
                <option value="nequi">Nequi</option>
                <option value="daviplata">Daviplata</option>
              </select>
            </div>

            {/* Producto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Package className="w-4 h-4 inline mr-1" />
                Producto
              </label>
              <select
                value={productoFiltro}
                onChange={(e) => setProductoFiltro(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos los productos</option>
                {productos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>

            {/* Rango de monto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto Mínimo
              </label>
              <input
                type="number"
                value={rangoMontoMin}
                onChange={(e) => setRangoMontoMin(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto Máximo
              </label>
              <input
                type="number"
                value={rangoMontoMax}
                onChange={(e) => setRangoMontoMax(e.target.value)}
                placeholder="1000000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Ventas por Método de Pago */}
      {Object.keys(estadisticas.ventaPorMetodo).length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Ventas por Método de Pago</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(estadisticas.ventaPorMetodo).map(([metodo, total]) => (
              <div key={metodo} className="text-center">
                <p className="text-sm text-gray-600 capitalize">{metodo}</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(total)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabla de Ventas */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Factura</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha/Hora</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Punto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Método Pago</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Cargando ventas...
                  </td>
                </tr>
              ) : ventas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No se encontraron ventas con los filtros aplicados
                  </td>
                </tr>
              ) : (
                ventas.map((venta) => (
                  <tr key={venta.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm font-medium text-blue-600">
                        {venta.numero_factura}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(venta.created_at).toLocaleDateString('es-CO', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                      <br />
                      <span className="text-gray-500">
                        {new Date(venta.created_at).toLocaleTimeString('es-CO', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {venta.punto_nombre}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 capitalize">
                        {venta.metodo_pago}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {venta.usuario_nombre}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900">
                      {formatCurrency(venta.total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => setVentaSeleccionada(venta)}
                        className="text-blue-600 hover:text-blue-700"
                        title="Ver detalle"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalle */}
      {ventaSeleccionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">
                Detalle de Venta - {ventaSeleccionada.numero_factura}
              </h2>
              <button
                onClick={() => setVentaSeleccionada(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Info general */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-600">Fecha</p>
                  <p className="font-medium">
                    {new Date(ventaSeleccionada.created_at).toLocaleDateString('es-CO')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Hora</p>
                  <p className="font-medium">
                    {new Date(ventaSeleccionada.created_at).toLocaleTimeString('es-CO')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Punto de Venta</p>
                  <p className="font-medium">{ventaSeleccionada.punto_nombre}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Método de Pago</p>
                  <p className="font-medium capitalize">{ventaSeleccionada.metodo_pago}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Usuario</p>
                  <p className="font-medium">{ventaSeleccionada.usuario_nombre}</p>
                </div>
              </div>

              {/* Productos */}
              <h3 className="font-semibold text-gray-800 mb-3">Productos</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Producto</th>
                      <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">Cant.</th>
                      <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">P. Unit.</th>
                      <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {ventaSeleccionada.productos.map((p, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-sm">{p.nombre}</td>
                        <td className="px-4 py-2 text-sm text-center">{p.cantidad}</td>
                        <td className="px-4 py-2 text-sm text-right">{formatCurrency(p.precio_unitario)}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(p.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total */}
              <div className="flex justify-between items-center border-t-2 border-gray-300 pt-4">
                <span className="text-xl font-bold text-gray-800">TOTAL</span>
                <span className="text-2xl font-bold text-blue-600">
                  {formatCurrency(ventaSeleccionada.total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}