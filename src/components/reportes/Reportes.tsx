import { useState } from 'react';
import { Calendar, Download, TrendingUp, Package, Users, BarChart3, FileSpreadsheet } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type ReportType = 'ventas_detalle' | 'productos_rentables' | 'inventario_valorizado' | 'vendedores_performance' | 'comparativo_mensual';

export default function Reportes() {
  const { puntosAsignados } = useAuth();  const [selectedReport, setSelectedReport] = useState<ReportType>('ventas_detalle');
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
    { id: 'ventas_detalle', name: 'Ventas Detalladas', icon: FileSpreadsheet, description: 'Listado completo de ventas realizadas' },
    { id: 'productos_rentables', name: 'Top Productos', icon: TrendingUp, description: 'Productos más vendidos' },
    { id: 'inventario_valorizado', name: 'Inventario Actual', icon: Package, description: 'Stock disponible valorizado' },
    { id: 'vendedores_performance', name: 'Ranking Vendedores', icon: Users, description: 'Performance por vendedor' },
    { id: 'comparativo_mensual', name: 'Evolución Mensual', icon: BarChart3, description: 'Tendencia de ventas' }
  ];

  const generateReport = async () => {
    setLoading(true);
    setReportData([]);
    
    try {
      switch (selectedReport) {
        case 'ventas_detalle':
          await generateVentasDetalle();
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
    let ventasQuery = (supabase as any)
      .from('ventas')
      .select('id')
      .gte('created_at', `${fechaInicio}T00:00:00`)
      .lte('created_at', `${fechaFin}T23:59:59`);

    if (selectedPunto !== 'all') {
      ventasQuery = ventasQuery.eq('punto_id', selectedPunto);
    }

    const { data: ventas } = await ventasQuery;

    if (!ventas || ventas.length === 0) {
      setReportData([]);
      return;
    }

    const ventasIds = ventas.map((v: any) => v.id);

    const { data: detalles } = await (supabase as any)
      .from('ventas_detalle')
      .select('*')
      .in('venta_id', ventasIds);

    if (!detalles || detalles.length === 0) {
      setReportData([]);
      return;
    }

    const productosMap: { [key: string]: any } = {};

    await Promise.all(
      detalles.map(async (detalle: any) => {
        const prodId = detalle.producto_id;

        if (!productosMap[prodId]) {
          const { data: producto } = await (supabase as any)
            .from('productos')
            .select('nombre')
            .eq('id', prodId)
            .single();

          productosMap[prodId] = {
            Producto: producto?.nombre || 'N/A',
            'Cantidad Vendida': 0,
            'Ingreso Total': 0,
            'Precio Promedio': 0
          };
        }

        productosMap[prodId]['Cantidad Vendida'] += detalle.cantidad;
        productosMap[prodId]['Ingreso Total'] += detalle.subtotal;
      })
    );

    const resultado = Object.values(productosMap).map((p: any) => ({
      ...p,
      'Precio Promedio': p['Cantidad Vendida'] > 0 ? p['Ingreso Total'] / p['Cantidad Vendida'] : 0
    }));

    resultado.sort((a: any, b: any) => b['Cantidad Vendida'] - a['Cantidad Vendida']);
    setReportData(resultado);
  };

  const generateInventarioValorizado = async () => {
    let query = (supabase as any)
      .from('inventario')
      .select('*')
      .gt('cantidad', 0);

    if (selectedPunto !== 'all') {
      query = query.eq('punto_id', selectedPunto);
    }

    const { data: inventario } = await query;

    if (!inventario || inventario.length === 0) {
      setReportData([]);
      return;
    }

    const resultado = await Promise.all(
      inventario.map(async (item: any) => {
        const { data: producto } = await (supabase as any)
          .from('productos')
          .select('nombre, precio_venta')
          .eq('id', item.producto_id)
          .single();

        const { data: punto } = await (supabase as any)
          .from('puntos_venta')
          .select('nombre')
          .eq('id', item.punto_id)
          .single();

        return {
          Producto: producto?.nombre || 'N/A',
          Punto: punto?.nombre || 'N/A',
          Stock: item.cantidad,
          'Stock Mínimo': item.stock_minimo,
          'Precio Unitario': producto?.precio_venta || 0,
          'Valor Total': (producto?.precio_venta || 0) * item.cantidad,
          Estado: item.cantidad <= item.stock_minimo ? '⚠️ Bajo' : '✅ OK'
        };
      })
    );

    resultado.sort((a: any, b: any) => b['Valor Total'] - a['Valor Total']);
    setReportData(resultado);
  };

  const generateVendedoresPerformance = async () => {
    let query = (supabase as any)
      .from('ventas')
      .select('*')
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

    const vendedoresMap: { [key: string]: any } = {};

    await Promise.all(
      ventas.map(async (venta: any) => {
        const vendedorId = venta.vendedor_id;

        if (!vendedoresMap[vendedorId]) {
          const { data: vendedor } = await (supabase as any)
            .from('profiles')
            .select('nombre')
            .eq('id', vendedorId)
            .single();

          vendedoresMap[vendedorId] = {
            Vendedor: vendedor?.nombre || 'N/A',
            'Ventas Realizadas': 0,
            'Monto Total': 0,
            'Ticket Promedio': 0
          };
        }

        vendedoresMap[vendedorId]['Ventas Realizadas'] += 1;
        vendedoresMap[vendedorId]['Monto Total'] += venta.total;
      })
    );

    const resultado = Object.values(vendedoresMap).map((v: any) => ({
      ...v,
      'Ticket Promedio': v['Ventas Realizadas'] > 0 ? v['Monto Total'] / v['Ventas Realizadas'] : 0
    }));

    resultado.sort((a: any, b: any) => b['Monto Total'] - a['Monto Total']);
    setReportData(resultado);
  };

  const generateComparativoMensual = async () => {
    const resultado = [];

    for (let i = 5; i >= 0; i--) {
      const fecha = new Date();
      fecha.setMonth(fecha.getMonth() - i);
      const mes = fecha.getMonth();
      const anio = fecha.getFullYear();

      const primerDia = new Date(anio, mes, 1).toISOString();
      const ultimoDia = new Date(anio, mes + 1, 0, 23, 59, 59).toISOString();

      let query = (supabase as any)
        .from('ventas')
        .select('total')
        .gte('created_at', primerDia)
        .lte('created_at', ultimoDia);

      if (selectedPunto !== 'all') {
        query = query.eq('punto_id', selectedPunto);
      }

      const { data: ventas } = await query;

      const cantidadVentas = ventas?.length || 0;
      const montoTotal = ventas?.reduce((sum: number, v: any) => sum + v.total, 0) || 0;

      resultado.push({
        Mes: fecha.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }),
        'Cantidad de Ventas': cantidadVentas,
        'Monto Total': montoTotal,
        'Ticket Promedio': cantidadVentas > 0 ? montoTotal / cantidadVentas : 0
      });
    }

    setReportData(resultado);
  };

  const exportToCSV = () => {
    if (reportData.length === 0) return;

    const headers = Object.keys(reportData[0]);
    const rows = reportData.map((row: any) =>
      headers.map(header => {
        const value = row[header];
        return typeof value === 'number' ? value.toFixed(2) : `"${value}"`;
      })
    );

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_${selectedReport}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  };

  const formatValue = (key: string, value: any) => {
    if (typeof value === 'number') {
      if (key.toLowerCase().includes('total') || 
          key.toLowerCase().includes('monto') || 
          key.toLowerCase().includes('precio') ||
          key.toLowerCase().includes('valor') ||
          key.toLowerCase().includes('ingreso') ||
          key.toLowerCase().includes('promedio')) {
        return formatCurrency(value);
      }
      return value.toLocaleString('es-CO');
    }
    return value;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Generador de Reportes</h2>
        <p className="text-gray-600 mt-1">Análisis detallado de tu negocio</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportTypes.map((type) => {
          const Icon = type.icon;
          const isSelected = selectedReport === type.id;
          return (
            <button
              key={type.id}
              onClick={() => setSelectedReport(type.id as ReportType)}
              className={`p-4 rounded-xl border-2 text-left transition ${
                isSelected
                  ? 'border-teal-600 bg-teal-50'
                  : 'border-gray-200 bg-white hover:border-teal-300'
              }`}
            >
              <div className="flex items-start space-x-3">
                <Icon className={`w-6 h-6 flex-shrink-0 ${isSelected ? 'text-teal-600' : 'text-gray-400'}`} />
                <div>
                  <h3 className={`font-semibold ${isSelected ? 'text-teal-900' : 'text-gray-900'}`}>
                    {type.name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">{type.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select
            value={selectedPunto}
            onChange={(e) => setSelectedPunto(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="all">Todos los puntos</option>
            {puntosAsignados.map((punto: any) => (
              <option key={punto.id} value={punto.id}>{punto.nombre}</option>
            ))}
          </select>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={generateReport}
            disabled={loading}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <BarChart3 className="w-5 h-5" />
            <span>{loading ? 'Generando...' : 'Generar'}</span>
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-teal-600 border-t-transparent"></div>
          <p className="text-gray-600 mt-4">Generando reporte...</p>
        </div>
      )}

      {!loading && reportData.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {reportTypes.find(t => t.id === selectedReport)?.name}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {reportData.length} registro{reportData.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={exportToCSV}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition"
            >
              <Download className="w-5 h-5" />
              <span>Exportar CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  {Object.keys(reportData[0]).map((key) => (
                    <th key={key} className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reportData.map((row: any, index: number) => (
                  <tr key={index} className="hover:bg-gray-50 transition">
                    {Object.entries(row).map(([key, value]: [string, any], i) => (
                      <td key={i} className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {formatValue(key, value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && reportData.length === 0 && selectedReport && (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <FileSpreadsheet className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No hay datos disponibles para este reporte</p>
          <p className="text-gray-400 text-sm mt-2">Intenta ajustar los filtros o el rango de fechas</p>
        </div>
      )}
    </div>
  );
}