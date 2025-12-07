import { useState } from 'react';
import { Download, TrendingUp, Package, Users, BarChart3, FileSpreadsheet, ShoppingBag, RefreshCw } from 'lucide-react';
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
  [key: string]: any;
}

interface CompraDetalle {
  cantidad: number;
  costo: number;
  [key: string]: any;
}

type ReportType = 
  | 'ventas_detalle' 
  | 'productos_rentables' 
  | 'inventario_valorizado' 
  | 'vendedores_performance' 
  | 'comparativo_mensual'
  | 'compras_detalle'
  | 'movimientos_inventario';

export default function Reportes() {
  const { puntosAsignados, isAdmin } = useAuth();
  const [selectedReport, setSelectedReport] = useState<ReportType>('ventas_detalle');
  const [loading, setLoading] = useState(false);
  const [selectedPunto, setSelectedPunto] = useState<string>('all');
  const [fechaInicio, setFechaInicio] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [fechaFin, setFechaFin] = useState(() => new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<any[]>([]);

  const reportTypes = [
    { id: 'ventas_detalle', name: 'Ventas Detalladas', icon: FileSpreadsheet, description: 'Listado completo de ventas realizadas', color: 'bg-blue-50 border-blue-200 text-blue-700' },
    { id: 'compras_detalle', name: 'Compras Detalladas', icon: ShoppingBag, description: 'Historial de compras por proveedor y punto', color: 'bg-green-50 border-green-200 text-green-700' },
    { id: 'movimientos_inventario', name: 'Movimientos de Inventario', icon: RefreshCw, description: 'Traslados, cargos y descargos', color: 'bg-purple-50 border-purple-200 text-purple-700' },
    { id: 'productos_rentables', name: 'Top Productos', icon: TrendingUp, description: 'Productos más vendidos', color: 'bg-orange-50 border-orange-200 text-orange-700' },
    { id: 'inventario_valorizado', name: 'Inventario Actual', icon: Package, description: 'Stock disponible valorizado', color: 'bg-teal-50 border-teal-200 text-teal-700' },
    { id: 'vendedores_performance', name: 'Ranking Vendedores', icon: Users, description: 'Performance por vendedor', color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
    { id: 'comparativo_mensual', name: 'Evolución Mensual', icon: BarChart3, description: 'Tendencia de ventas', color: 'bg-pink-50 border-pink-200 text-pink-700' }
  ];

  const generateReport = async () => {
    setLoading(true);
    setReportData([]);
    
    try {
      switch (selectedReport) {
        case 'ventas_detalle':
          await generateVentasDetalle();
          break;
        case 'compras_detalle':
          await generateComprasDetalle();
          break;
        case 'movimientos_inventario':
          await generateMovimientosInventario();
          break;
        case 'productos_rentables':
          await generateProductosRentables();
          break;
        case 'inventario_valorizado':
          await generateInventarioValorizado();
          break;
        case 'vendedores_performance':
          await generateVendedoresPerformance();
          break;
        case 'comparativo_mensual':
          await generateComparativoMensual();
          break;
      }
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error al generar el reporte');
    } finally {
      setLoading(false);
    }
  };

  const generateComprasDetalle = async () => {
    let query = (supabase as any)
      .from('compras')
      .select('*, puntos_venta(nombre), profiles(nombre)')
      .gte('created_at', `${fechaInicio}T00:00:00`)
      .lte('created_at', `${fechaFin}T23:59:59`)
      .order('created_at', { ascending: false });

    if (selectedPunto !== 'all') {
      query = query.eq('punto_id', selectedPunto);
    }

    const { data: compras } = await query;

    if (!compras || compras.length === 0) {
      setReportData([]);
      return;
    }

    const comprasConDetalle = await Promise.all(
      compras.map(async (compra: any) => {
        const { data: detalles } = await (supabase as any)
          .from('compras_detalle')
          .select('*, productos(nombre)')
          .eq('compra_id', compra.id);

        const productosResumen = detalles?.map((d: any) => 
          `${d.productos.nombre} (${d.cantidad})`
        ).join(', ') || '';

        return {
          ID: compra.id.substring(0, 8),
          Fecha: new Date(compra.created_at).toLocaleDateString('es-CO', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
          }),
          Punto: compra.puntos_venta?.nombre || 'N/A',
          Proveedor: compra.proveedor || 'N/A',
          Usuario: compra.profiles?.nombre || 'N/A',
          'Productos': productosResumen,
          'Total Productos': detalles?.reduce((sum: number, d: CompraDetalle) => sum + d.cantidad, 0) || 0,
          Total: compra.total,
          Notas: compra.notas || '-'
        };
      })
    );

    setReportData(comprasConDetalle);
  };

  const generateMovimientosInventario = async () => {
    // Obtener traslados
    let trasladosQuery = (supabase as any)
      .from('traslados')
      .select('*, punto_origen:puntos_venta!traslados_punto_origen_id_fkey(nombre), punto_destino:puntos_venta!traslados_punto_destino_id_fkey(nombre), profiles(nombre)')
      .gte('created_at', `${fechaInicio}T00:00:00`)
      .lte('created_at', `${fechaFin}T23:59:59`)
      .order('created_at', { ascending: false });

    if (selectedPunto !== 'all') {
      trasladosQuery = trasladosQuery.or(`punto_origen_id.eq.${selectedPunto},punto_destino_id.eq.${selectedPunto}`);
    }

    const { data: traslados } = await trasladosQuery;

    // Obtener cargos y descargos
    let ajustesQuery = (supabase as any)
      .from('ajustes_inventario')
      .select('*, puntos_venta(nombre), productos(nombre), profiles(nombre)')
      .gte('created_at', `${fechaInicio}T00:00:00`)
      .lte('created_at', `${fechaFin}T23:59:59`)
      .order('created_at', { ascending: false });

    if (selectedPunto !== 'all') {
      ajustesQuery = ajustesQuery.eq('punto_id', selectedPunto);
    }

    const { data: ajustes } = await ajustesQuery;

    const movimientos: any[] = [];

    // Agregar traslados
    if (traslados) {
      for (const traslado of traslados) {
        const { data: detalles } = await (supabase as any)
          .from('traslados_detalle')
          .select('*, productos(nombre)')
          .eq('traslado_id', traslado.id);

        const productosResumen = detalles?.map((d: any) => 
          `${d.productos.nombre} (${d.cantidad})`
        ).join(', ') || '';

        movimientos.push({
          Tipo: 'TRASLADO',
          Fecha: new Date(traslado.created_at).toLocaleDateString('es-CO', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          Punto: `${traslado.punto_origen?.nombre || 'N/A'} → ${traslado.punto_destino?.nombre || 'N/A'}`,
          Productos: productosResumen,
          Cantidad: detalles?.reduce((sum: number, d: VentaDetalle) => sum + d.cantidad, 0) || 0,
          Usuario: traslado.profiles?.nombre || 'N/A',
          Motivo: traslado.motivo || '-',
          Estado: traslado.estado || 'pendiente'
        });
      }
    }

    // Agregar ajustes (cargos/descargos)
    if (ajustes) {
      ajustes.forEach((ajuste: any) => {
        movimientos.push({
          Tipo: ajuste.tipo === 'cargo' ? 'CARGO ⬆️' : 'DESCARGO ⬇️',
          Fecha: new Date(ajuste.created_at).toLocaleDateString('es-CO', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          Punto: ajuste.puntos_venta?.nombre || 'N/A',
          Productos: ajuste.productos?.nombre || 'N/A',
          Cantidad: ajuste.cantidad,
          Usuario: ajuste.profiles?.nombre || 'N/A',
          Motivo: ajuste.motivo || '-',
          Estado: ajuste.observaciones || '-'
        });
      });
    }

    // Ordenar por fecha
    movimientos.sort((a, b) => new Date(b.Fecha).getTime() - new Date(a.Fecha).getTime());

    setReportData(movimientos);
  };

  const generateVentasDetalle = async () => {
    let query = (supabase as any)
      .from('ventas')
      .select('*')
      .gte('created_at', `${fechaInicio}T00:00:00`)
      .lte('created_at', `${fechaFin}T23:59:59`)
      .order('created_at', { ascending: false });

    if (selectedPunto !== 'all') {
      query = query.eq('punto_id', selectedPunto);
    }

    const { data: ventas } = await query;

    if (!ventas || ventas.length === 0) {
      setReportData([]);
      return;
    }

    const ventasConDetalle = await Promise.all(
      ventas.map(async (venta: any) => {
        const { data: punto } = await (supabase as any)
          .from('puntos_venta')
          .select('nombre')
          .eq('id', venta.punto_id)
          .single();

        const { data: vendedor } = await (supabase as any)
          .from('profiles')
          .select('nombre')
          .eq('id', venta.vendedor_id)
          .single();

        return {
          ID: venta.id.substring(0, 8),
          Fecha: new Date(venta.created_at).toLocaleDateString('es-CO'),
          Punto: punto?.nombre || 'N/A',
          Vendedor: vendedor?.nombre || 'N/A',
          Cliente: venta.cliente_nombre || 'N/A',
          Teléfono: venta.cliente_telefono || '-',
          Total: venta.total
        };
      })
    );

    setReportData(ventasConDetalle);
  };

  const generateProductosRentables = async () => {
    let query = (supabase as any)
      .from('ventas')
      .select('id')
      .gte('created_at', `${fechaInicio}T00:00:00`)
      .lte('created_at', `${fechaFin}T23:59:59`);

    if (selectedPunto !== 'all') {
      query = query.eq('punto_id', selectedPunto);
    }

    const { data: ventas } = await query;

    if (!ventas || ventas.length === 0) {
      setReportData([]);
      return;
    }

    const ventasIds = ventas.map((v: Venta) => v.id);

    const { data: detalles } = await (supabase as any)
      .from('ventas_detalle')
      .select('producto_id, cantidad, precio_unitario, productos(nombre, costo)')
      .in('venta_id', ventasIds);

    const productosMap: any = {};

    detalles?.forEach((detalle: any) => {
      const productoId = detalle.producto_id;
      if (!productosMap[productoId]) {
        productosMap[productoId] = {
          nombre: detalle.productos.nombre,
          cantidadVendida: 0,
          ingresoTotal: 0,
          costoTotal: 0
        };
      }

      productosMap[productoId].cantidadVendida += detalle.cantidad;
      productosMap[productoId].ingresoTotal += detalle.cantidad * detalle.precio_unitario;
      productosMap[productoId].costoTotal += detalle.cantidad * (detalle.productos.costo || 0);
    });

    const productos = Object.values(productosMap).map((p: any) => ({
      Producto: p.nombre,
      'Unidades Vendidas': p.cantidadVendida,
      'Ingreso Total': p.ingresoTotal,
      'Costo Total': p.costoTotal,
      'Ganancia': p.ingresoTotal - p.costoTotal,
      'Margen %': p.ingresoTotal > 0 ? (((p.ingresoTotal - p.costoTotal) / p.ingresoTotal) * 100).toFixed(1) + '%' : '0%'
    }));

    productos.sort((a: any, b: any) => b['Ganancia'] - a['Ganancia']);

    setReportData(productos.slice(0, 50));
  };

  const generateInventarioValorizado = async () => {
    let query = (supabase as any)
      .from('inventario')
      .select('*, productos(nombre, precio_venta, costo), puntos_venta(nombre)')
      .gt('cantidad', 0);

    if (selectedPunto !== 'all') {
      query = query.eq('punto_id', selectedPunto);
    }

    const { data: inventario } = await query;

    if (!inventario || inventario.length === 0) {
      setReportData([]);
      return;
    }

    const inventarioValorizado = inventario.map((item: any) => ({
      Punto: item.puntos_venta?.nombre || 'N/A',
      Producto: item.productos?.nombre || 'N/A',
      'Stock Actual': item.cantidad,
      'Stock Mínimo': item.stock_minimo || 0,
      'Costo Unitario': item.productos?.costo || 0,
      'Precio Venta': item.productos?.precio_venta || 0,
      'Valor Costo': (item.productos?.costo || 0) * item.cantidad,
      'Valor Venta': (item.productos?.precio_venta || 0) * item.cantidad,
      'Estado': item.cantidad <= (item.stock_minimo || 0) ? '⚠️ Bajo' : '✅ OK'
    }));

    setReportData(inventarioValorizado);
  };

  const generateVendedoresPerformance = async () => {
    let query = (supabase as any)
      .from('ventas')
      .select('vendedor_id, total')
      .gte('created_at', `${fechaInicio}T00:00:00`)
      .lte('created_at', `${fechaFin}T23:59:59`);

    if (selectedPunto !== 'all') {
      query = query.eq('punto_id', selectedPunto);
    }

    const { data: ventas } = await query;

    if (!ventas || ventas.length === 0) {
      setReportData([]);
      return;
    }

    const vendedoresMap: any = {};

    for (const venta of ventas) {
      if (!vendedoresMap[venta.vendedor_id]) {
        const { data: vendedor } = await (supabase as any)
          .from('profiles')
          .select('nombre')
          .eq('id', venta.vendedor_id)
          .single();

        vendedoresMap[venta.vendedor_id] = {
          nombre: vendedor?.nombre || 'N/A',
          ventas: 0,
          totalVendido: 0
        };
      }

      vendedoresMap[venta.vendedor_id].ventas += 1;
      vendedoresMap[venta.vendedor_id].totalVendido += venta.total;
    }

    const vendedores = Object.values(vendedoresMap).map((v: any, index: number) => ({
      '#': index + 1,
      Vendedor: v.nombre,
      'Total Ventas': v.ventas,
      'Monto Total': v.totalVendido,
      'Promedio por Venta': Math.round(v.totalVendido / v.ventas)
    }));

    vendedores.sort((a: any, b: any) => b['Monto Total'] - a['Monto Total']);

    setReportData(vendedores);
  };

  const generateComparativoMensual = async () => {
    const meses: any[] = [];
    const fechaInicioDate = new Date(fechaInicio);
    const fechaFinDate = new Date(fechaFin);

    let currentDate = new Date(fechaInicioDate);
    currentDate.setDate(1);

    while (currentDate <= fechaFinDate) {
      const mes = currentDate.getMonth();
      const año = currentDate.getFullYear();
      const nombreMes = currentDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

      const inicioMes = new Date(año, mes, 1);
      const finMes = new Date(año, mes + 1, 0, 23, 59, 59);

      let query = (supabase as any)
        .from('ventas')
        .select('total')
        .gte('created_at', inicioMes.toISOString())
        .lte('created_at', finMes.toISOString());

      if (selectedPunto !== 'all') {
        query = query.eq('punto_id', selectedPunto);
      }

      const { data: ventas } = await query;

      const totalVentas = ventas?.length || 0;
      const montoTotal = ventas?.reduce((sum: number, v: Venta) => sum + v.total, 0) || 0;

      meses.push({
        Mes: nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1),
        'Ventas Realizadas': totalVentas,
        'Monto Total': montoTotal,
        'Promedio por Venta': totalVentas > 0 ? Math.round(montoTotal / totalVentas) : 0
      });

      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    setReportData(meses);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  };

  const downloadCSV = () => {
    if (reportData.length === 0) return;

    const headers = Object.keys(reportData[0]);
    const csvContent = [
      headers.join(','),
      ...reportData.map(row => 
        headers.map(header => {
          const value = row[header];
          if (typeof value === 'number') return value;
          return `"${value}"`;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_${selectedReport}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedReportConfig = reportTypes.find(r => r.id === selectedReport);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Reportes</h2>
        <p className="text-gray-600 mt-1">Genera reportes detallados de tu negocio</p>
      </div>

      {/* Selector de tipo de reporte */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {reportTypes.map(report => {
          const Icon = report.icon;
          const isSelected = selectedReport === report.id;
          return (
            <button
              key={report.id}
              onClick={() => setSelectedReport(report.id as ReportType)}
              className={`p-4 rounded-lg border-2 transition text-left ${
                isSelected 
                  ? report.color + ' border-current shadow-md' 
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <Icon className={`w-8 h-8 mb-2 ${isSelected ? '' : 'text-gray-400'}`} />
              <h3 className="font-semibold text-sm mb-1">{report.name}</h3>
              <p className={`text-xs ${isSelected ? 'opacity-90' : 'text-gray-500'}`}>
                {report.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {(isAdmin || puntosAsignados.length > 1) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Punto de Venta</label>
              <select
                value={selectedPunto}
                onChange={(e) => setSelectedPunto(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                {isAdmin && <option value="all">Todos los puntos</option>}
                {puntosAsignados.map(punto => (
                  <option key={punto.id} value={punto.id}>{punto.nombre}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Inicio</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Fin</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={generateReport}
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Generando...' : 'Generar Reporte'}
            </button>
          </div>
        </div>
      </div>

      {/* Resultados */}
      {reportData.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{selectedReportConfig?.name}</h3>
              <p className="text-sm text-gray-600">{reportData.length} registros encontrados</p>
            </div>
            <button
              onClick={downloadCSV}
              className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
            >
              <Download className="w-4 h-4" />
              <span>Descargar CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {Object.keys(reportData[0]).map(key => (
                    <th
                      key={key}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    {Object.entries(row).map(([key, value], i) => (
                      <td key={i} className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {typeof value === 'number' && (key.toLowerCase().includes('total') || key.toLowerCase().includes('monto') || key.toLowerCase().includes('precio') || key.toLowerCase().includes('costo') || key.toLowerCase().includes('valor') || key.toLowerCase().includes('ganancia') || key.toLowerCase().includes('promedio'))
                          ? formatCurrency(value)
                          : String(value ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reportData.length === 0 && !loading && (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <BarChart3 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">Selecciona un tipo de reporte y haz clic en "Generar Reporte"</p>
        </div>
      )}
    </div>
  );
}