import { useState, useEffect } from 'react';
import { RotateCcw, Search, Eye, X, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Venta {
  id: string;
  numero_factura: string;
  created_at: string;
  total: number;
  punto_nombre: string;
  usuario_nombre: string;
  tiene_devolucion: boolean;
  productos: Array<{
    producto_id: string;
    nombre: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }>;
}

interface ProductoDevolucion {
  producto_id: string;
  nombre: string;
  cantidad: number;
  cantidad_devolver: number;
  precio_unitario: number;
}

interface Devolucion {
  id: string;
  numero_devolucion: string;
  numero_factura: string;
  motivo: string;
  observaciones: string;
  total: number;
  created_at: string;
  punto_venta: string;
  usuario_nombre: string;
  productos: Array<{
    producto_nombre: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }>;
}

export default function Devoluciones() {
  const { user, puntosAsignados, isAdmin } = useAuth();
  
  const [busquedaFactura, setBusquedaFactura] = useState('');
  const [ventaEncontrada, setVentaEncontrada] = useState<Venta | null>(null);
  const [productosDevolucion, setProductosDevolucion] = useState<ProductoDevolucion[]>([]);
  const [motivo, setMotivo] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Historial
  const [devoluciones, setDevoluciones] = useState<Devolucion[]>([]);
  const [showHistorial, setShowHistorial] = useState(false);
  const [devolucionSeleccionada, setDevolucionSeleccionada] = useState<Devolucion | null>(null);

  const motivosDevolucion = [
    'Producto defectuoso',
    'Cliente insatisfecho',
    'Error en la venta',
    'Producto equivocado',
    'Producto dañado',
    'Cambio de opinión del cliente',
    'Otro'
  ];

  useEffect(() => {
    cargarHistorial();
  }, []);

  const buscarFactura = async () => {
    if (!busquedaFactura.trim()) {
      setError('Ingresa un número de factura');
      return;
    }

    setLoading(true);
    setError(null);
    setVentaEncontrada(null);
    setProductosDevolucion([]);

    try {
      const { data, error: searchError } = await (supabase as any)
        .from('ventas')
        .select(`
          id,
          numero_factura,
          created_at,
          total,
          tiene_devolucion,
          punto_id,
          usuario_id,
          puntos_venta!inner(nombre),
          profiles!inner(nombre),
          ventas_detalle!inner(
            producto_id,
            cantidad,
            precio_unitario,
            subtotal,
            productos!inner(nombre)
          )
        `)
        .ilike('numero_factura', `%${busquedaFactura}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (searchError) {
        if (searchError.code === 'PGRST116') {
          setError('Factura no encontrada');
        } else {
          throw searchError;
        }
        return;
      }

      // Verificar permisos
      if (!isAdmin) {
        const tienePunto = puntosAsignados.some(p => p.id === data.punto_id);
        if (!tienePunto) {
          setError('No tienes permiso para ver esta factura');
          return;
        }
      }

      if (data.tiene_devolucion) {
        setError('Esta factura ya tiene una devolución registrada');
        return;
      }

      const venta: Venta = {
        id: data.id,
        numero_factura: data.numero_factura,
        created_at: data.created_at,
        total: data.total,
        punto_nombre: data.puntos_venta?.nombre || '',
        usuario_nombre: data.profiles?.nombre || '',
        tiene_devolucion: data.tiene_devolucion,
        productos: (data.ventas_detalle || []).map((d: any) => ({
          producto_id: d.producto_id,
          nombre: d.productos?.nombre || '',
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario,
          subtotal: d.subtotal
        }))
      };

      setVentaEncontrada(venta);

      // Inicializar productos para devolución
      const productos: ProductoDevolucion[] = venta.productos.map(p => ({
        producto_id: p.producto_id,
        nombre: p.nombre,
        cantidad: p.cantidad,
        cantidad_devolver: 0,
        precio_unitario: p.precio_unitario
      }));

      setProductosDevolucion(productos);
    } catch (err: any) {
      console.error('Error buscando factura:', err);
      setError('Error al buscar la factura');
    } finally {
      setLoading(false);
    }
  };

  const actualizarCantidadDevolver = (productoId: string, cantidad: number) => {
    setProductosDevolucion(prev =>
      prev.map(p =>
        p.producto_id === productoId
          ? { ...p, cantidad_devolver: Math.max(0, Math.min(cantidad, p.cantidad)) }
          : p
      )
    );
  };

  const seleccionarTodos = () => {
    setProductosDevolucion(prev =>
      prev.map(p => ({ ...p, cantidad_devolver: p.cantidad }))
    );
  };

  const limpiarSeleccion = () => {
    setProductosDevolucion(prev =>
      prev.map(p => ({ ...p, cantidad_devolver: 0 }))
    );
  };

  const calcularTotalDevolucion = () => {
    return productosDevolucion.reduce(
      (sum, p) => sum + (p.cantidad_devolver * p.precio_unitario),
      0
    );
  };

  const validarDevolucion = (): string | null => {
    const productosSeleccionados = productosDevolucion.filter(p => p.cantidad_devolver > 0);
    
    if (productosSeleccionados.length === 0) {
      return 'Selecciona al menos un producto para devolver';
    }

    if (!motivo) {
      return 'Selecciona un motivo de devolución';
    }

    return null;
  };

  const procesarDevolucion = async () => {
    const errorValidacion = validarDevolucion();
    if (errorValidacion) {
      setError(errorValidacion);
      return;
    }

    if (!ventaEncontrada || !user) return;

    setProcessing(true);
    setError(null);

    try {
      const productosSeleccionados = productosDevolucion.filter(p => p.cantidad_devolver > 0);
      const total = calcularTotalDevolucion();

      // Generar número de devolución secuencial
      const { data: numeroData } = await (supabase as any)
        .rpc('generar_numero_devolucion', { p_punto_id: puntosAsignados[0]?.id });

      const numeroDevolucion = numeroData;

      // Crear devolución
      const { data: devolucion, error: devError } = await (supabase as any)
        .from('devoluciones')
        .insert({
          venta_id: ventaEncontrada.id,
          punto_id: puntosAsignados[0]?.id,
          usuario_id: user.id,
          numero_devolucion: numeroDevolucion,
          motivo,
          observaciones: observaciones || null,
          total,
          estado: 'completada'
        })
        .select()
        .single();

      if (devError) throw devError;

      // Crear detalle de devolución
      const detalle = productosSeleccionados.map(p => ({
        devolucion_id: devolucion.id,
        producto_id: p.producto_id,
        cantidad: p.cantidad_devolver,
        precio_unitario: p.precio_unitario,
        subtotal: p.cantidad_devolver * p.precio_unitario
      }));

      const { error: detalleError } = await (supabase as any)
        .from('devoluciones_detalle')
        .insert(detalle);

      if (detalleError) throw detalleError;

      // Limpiar formulario
      setVentaEncontrada(null);
      setProductosDevolucion([]);
      setBusquedaFactura('');
      setMotivo('');
      setObservaciones('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      // Recargar historial
      cargarHistorial();
    } catch (err: any) {
      console.error('Error procesando devolución:', err);
      setError('Error al procesar la devolución: ' + (err.message || 'Error desconocido'));
    } finally {
      setProcessing(false);
    }
  };

  const cargarHistorial = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('devoluciones')
        .select(`
          id,
          numero_devolucion,
          motivo,
          observaciones,
          total,
          created_at,
          ventas!inner(numero_factura),
          puntos_venta!inner(nombre),
          profiles!inner(nombre),
          devoluciones_detalle!inner(
            cantidad,
            precio_unitario,
            subtotal,
            productos!inner(nombre)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const devolucionesFormateadas: Devolucion[] = (data || []).map((d: any) => ({
        id: d.id,
        numero_devolucion: d.numero_devolucion || 'SIN NÚMERO',
        numero_factura: d.ventas?.numero_factura || '',
        motivo: d.motivo,
        observaciones: d.observaciones,
        total: d.total,
        created_at: d.created_at,
        punto_venta: d.puntos_venta?.nombre || '',
        usuario_nombre: d.profiles?.nombre || '',
        productos: (d.devoluciones_detalle || []).map((dd: any) => ({
          producto_nombre: dd.productos?.nombre || '',
          cantidad: dd.cantidad,
          precio_unitario: dd.precio_unitario,
          subtotal: dd.subtotal
        }))
      }));

      setDevoluciones(devolucionesFormateadas);
    } catch (err) {
      console.error('Error cargando historial:', err);
    }
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
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <RotateCcw className="w-8 h-8 text-red-600" />
              Devoluciones
            </h1>
            <p className="text-gray-600 mt-1">Procesar devoluciones de facturas</p>
          </div>
          <button
            onClick={() => setShowHistorial(true)}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
          >
            Ver Historial
          </button>
        </div>
      </div>

      {/* Alerta informativa */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">Información importante:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Los productos devueltos se agregarán automáticamente al inventario</li>
            <li>Solo se puede hacer una devolución por factura</li>
            <li>Puedes devolver todos o algunos productos de la factura</li>
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Búsqueda de factura */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Buscar Factura</h3>
            
            <div className="flex gap-2 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Número de factura (ej: FAC000123)"
                  value={busquedaFactura}
                  onChange={(e) => setBusquedaFactura(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && buscarFactura()}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>
              <button
                onClick={buscarFactura}
                disabled={loading}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-400"
              >
                {loading ? 'Buscando...' : 'Buscar'}
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {ventaEncontrada && (
              <div className="border border-gray-200 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Factura</p>
                    <p className="font-mono font-semibold text-blue-600">{ventaEncontrada.numero_factura}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Fecha</p>
                    <p className="font-semibold">
                      {new Date(ventaEncontrada.created_at).toLocaleDateString('es-CO')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Punto de Venta</p>
                    <p className="font-semibold">{ventaEncontrada.punto_nombre}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Original</p>
                    <p className="font-semibold text-lg text-green-600">
                      {formatCurrency(ventaEncontrada.total)}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 mb-4">
                  <button
                    onClick={seleccionarTodos}
                    className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded"
                  >
                    Seleccionar todos
                  </button>
                  <button
                    onClick={limpiarSeleccion}
                    className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded"
                  >
                    Limpiar selección
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="font-semibold text-gray-800 mb-2">Productos</p>
                  {productosDevolucion.map(producto => (
                    <div key={producto.producto_id} className="border rounded-lg p-3 bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{producto.nombre}</p>
                          <p className="text-xs text-gray-600">
                            {formatCurrency(producto.precio_unitario)} × {producto.cantidad} = {formatCurrency(producto.precio_unitario * producto.cantidad)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max={producto.cantidad}
                            value={producto.cantidad_devolver}
                            onChange={(e) => actualizarCantidadDevolver(producto.producto_id, parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-1 border rounded text-center"
                          />
                          <span className="text-sm text-gray-600">de {producto.cantidad}</span>
                        </div>
                      </div>
                      {producto.cantidad_devolver > 0 && (
                        <div className="text-sm font-semibold text-red-600">
                          Devolver: {formatCurrency(producto.cantidad_devolver * producto.precio_unitario)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Panel de devolución */}
        <div>
          <div className="bg-white rounded-xl shadow-md p-6 sticky top-6">
            <h3 className="text-xl font-bold mb-4">Registrar Devolución</h3>

            {ventaEncontrada ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Motivo de Devolución *
                  </label>
                  <select
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  >
                    <option value="">Seleccionar motivo</option>
                    {motivosDevolucion.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observaciones
                  </label>
                  <textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    placeholder="Detalles adicionales (opcional)"
                  />
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-semibold">Total a devolver:</span>
                    <span className="text-2xl font-bold text-red-600">
                      {formatCurrency(calcularTotalDevolucion())}
                    </span>
                  </div>

                  <button
                    onClick={procesarDevolucion}
                    disabled={processing || calcularTotalDevolucion() === 0}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg disabled:bg-gray-400 flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-5 h-5" />
                    {processing ? 'Procesando...' : 'Procesar Devolución'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Search className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">Busca una factura para comenzar</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Historial */}
      {showHistorial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold">Historial de Devoluciones</h2>
              <button onClick={() => setShowHistorial(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {devoluciones.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No hay devoluciones registradas</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Devolución</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Factura Afectada</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {devoluciones.map(dev => (
                        <tr key={dev.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <span className="font-mono text-sm font-medium text-red-600">
                              {dev.numero_devolucion}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-sm font-medium text-blue-600">
                              {dev.numero_factura}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {new Date(dev.created_at).toLocaleDateString('es-CO')}
                          </td>
                          <td className="px-4 py-3 text-sm">{dev.motivo}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-red-600">
                            {formatCurrency(dev.total)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => setDevolucionSeleccionada(dev)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle Devolución */}
      {devolucionSeleccionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold">Detalle de Devolución</h2>
              <button onClick={() => setDevolucionSeleccionada(null)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-600">N° Devolución</p>
                  <p className="font-mono font-bold text-red-600 text-lg">{devolucionSeleccionada.numero_devolucion}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Factura Afectada</p>
                  <p className="font-mono font-semibold text-blue-600">{devolucionSeleccionada.numero_factura}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Fecha</p>
                  <p className="font-semibold">
                    {new Date(devolucionSeleccionada.created_at).toLocaleDateString('es-CO')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Punto de Venta</p>
                  <p className="font-semibold">{devolucionSeleccionada.punto_venta}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Usuario</p>
                  <p className="font-semibold">{devolucionSeleccionada.usuario_nombre}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Motivo</p>
                  <p className="font-semibold">{devolucionSeleccionada.motivo}</p>
                </div>
                {devolucionSeleccionada.observaciones && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-600">Observaciones</p>
                    <p className="text-sm">{devolucionSeleccionada.observaciones}</p>
                  </div>
                )}
              </div>

              <h3 className="font-semibold mb-3">Productos Devueltos</h3>
              <div className="border rounded-lg overflow-hidden mb-4">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium">Producto</th>
                      <th className="px-4 py-2 text-center text-sm font-medium">Cant.</th>
                      <th className="px-4 py-2 text-right text-sm font-medium">P. Unit.</th>
                      <th className="px-4 py-2 text-right text-sm font-medium">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {devolucionSeleccionada.productos.map((p, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-sm">{p.producto_nombre}</td>
                        <td className="px-4 py-2 text-sm text-center">{p.cantidad}</td>
                        <td className="px-4 py-2 text-sm text-right">{formatCurrency(p.precio_unitario)}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(p.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center border-t-2 pt-4">
                <span className="text-xl font-bold">TOTAL DEVUELTO</span>
                <span className="text-2xl font-bold text-red-600">
                  {formatCurrency(devolucionSeleccionada.total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notificación éxito */}
      {showSuccess && (
        <div className="fixed bottom-6 right-6 bg-green-500 text-white rounded-xl shadow-2xl p-4 flex items-center gap-3 z-50">
          <div className="bg-white rounded-full p-2">
            <Check className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <p className="font-bold">¡Devolución procesada!</p>
            <p className="text-sm opacity-90">Inventario actualizado</p>
          </div>
        </div>
      )}
    </div>
  );
}