import { useState, useEffect } from 'react';
import { ArrowRightLeft, Plus, X, Check, Clock, Ban, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Producto {
  id: string;
  nombre: string;
  stock_disponible?: number;
}

interface PuntoVenta {
  id: string;
  nombre: string;
}

interface ProductoTraslado {
  producto_id: string;
  producto_nombre: string;
  cantidad: number;
  stock_disponible: number;
}

interface Traslado {
  id: string;
  punto_origen: string;
  punto_destino: string;
  usuario: string;
  estado: 'pendiente' | 'completado' | 'cancelado';
  observaciones: string;
  created_at: string;
  completado_at: string | null;
  productos: Array<{
    producto: string;
    cantidad: number;
  }>;
}

export default function Traslados() {
  const { user, puntosAsignados, isAdmin } = useAuth();
  
  // Estados
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [puntos, setPuntos] = useState<PuntoVenta[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [traslados, setTraslados] = useState<Traslado[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Formulario
  const [puntoOrigen, setPuntoOrigen] = useState('');
  const [puntoDestino, setPuntoDestino] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [productosSeleccionados, setProductosSeleccionados] = useState<ProductoTraslado[]>([]);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  
  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroPunto, setFiltroPunto] = useState<string>('todos');
  
  // Cargar puntos de venta
  useEffect(() => {
    cargarPuntos();
    cargarTraslados();
  }, []);
  
  // Cargar productos del punto origen
  useEffect(() => {
    if (puntoOrigen) {
      cargarProductos();
    }
  }, [puntoOrigen]);

  const cargarPuntos = async () => {
    try {
      const { data, error } = await supabase
        .from('puntos_venta')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre');

      if (error) throw error;
      
      // Filtrar según permisos
      const puntosDisponibles = isAdmin 
        ? data 
        : data?.filter(p => puntosAsignados.some((pa: any) => pa.id === p.id));
      
      setPuntos(puntosDisponibles || []);
    } catch (error) {
      console.error('Error al cargar puntos:', error);
    }
  };

  const cargarProductos = async () => {
    if (!puntoOrigen) return;
    
    try {
      const { data, error } = await supabase
        .from('inventario')
        .select(`
          producto_id,
          cantidad,
          productos (
            id,
            nombre
          )
        `)
        .eq('punto_id', puntoOrigen)
        .gt('cantidad', 0)
        .order('productos(nombre)');

      if (error) throw error;

      const productosConStock = data?.map((item: any) => ({
        id: item.producto_id,
        nombre: item.productos.nombre,
        stock_disponible: item.cantidad
      })) || [];

      setProductos(productosConStock);
    } catch (error) {
      console.error('Error al cargar productos:', error);
    }
  };

  const cargarTraslados = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('traslados')
        .select(`
          id,
          estado,
          observaciones,
          created_at,
          completado_at,
          punto_origen:puntos_venta!traslados_punto_origen_id_fkey(nombre),
          punto_destino:puntos_venta!traslados_punto_destino_id_fkey(nombre),
          usuario:profiles(nombre),
          traslados_detalle(
            cantidad,
            productos(nombre)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const trasladosFormateados = data?.map((t: any) => ({
        id: t.id,
        punto_origen: t.punto_origen?.nombre || '',
        punto_destino: t.punto_destino?.nombre || '',
        usuario: t.usuario?.nombre || '',
        estado: t.estado,
        observaciones: t.observaciones || '',
        created_at: t.created_at,
        completado_at: t.completado_at,
        productos: t.traslados_detalle?.map((d: any) => ({
          producto: d.productos?.nombre || '',
          cantidad: d.cantidad
        })) || []
      })) || [];

      setTraslados(trasladosFormateados);
    } catch (error) {
      console.error('Error al cargar traslados:', error);
    } finally {
      setLoading(false);
    }
  };

  const agregarProducto = (producto: Producto) => {
    if (productosSeleccionados.find(p => p.producto_id === producto.id)) {
      alert('Este producto ya está en la lista');
      return;
    }

    setProductosSeleccionados([...productosSeleccionados, {
      producto_id: producto.id,
      producto_nombre: producto.nombre,
      cantidad: 1,
      stock_disponible: producto.stock_disponible || 0
    }]);
    setBusquedaProducto('');
  };

  const actualizarCantidad = (producto_id: string, cantidad: number) => {
    const producto = productosSeleccionados.find(p => p.producto_id === producto_id);
    if (!producto) return;

    if (cantidad > producto.stock_disponible) {
      alert(`No hay suficiente stock. Disponible: ${producto.stock_disponible}`);
      return;
    }

    if (cantidad < 1) {
      eliminarProducto(producto_id);
      return;
    }

    setProductosSeleccionados(productosSeleccionados.map(p => 
      p.producto_id === producto_id ? { ...p, cantidad } : p
    ));
  };

  const eliminarProducto = (producto_id: string) => {
    setProductosSeleccionados(productosSeleccionados.filter(p => p.producto_id !== producto_id));
  };

  const validarFormulario = (): boolean => {
    if (!puntoOrigen || !puntoDestino) {
      alert('Debes seleccionar punto de origen y destino');
      return false;
    }

    if (puntoOrigen === puntoDestino) {
      alert('El punto de origen y destino deben ser diferentes');
      return false;
    }

    if (productosSeleccionados.length === 0) {
      alert('Debes agregar al menos un producto');
      return false;
    }

    return true;
  };

  const guardarTraslado = async () => {
    if (!validarFormulario()) return;

    try {
      setLoading(true);

      // Crear traslado
      const response = await (supabase as any)
        .from('traslados')
        .insert({
          punto_origen_id: puntoOrigen,
          punto_destino_id: puntoDestino,
          usuario_id: user?.id,
          estado: 'pendiente',
          observaciones: observaciones || null
        })
        .select()
        .single();

      const traslado = response.data;
      const errorTraslado = response.error;

      if (errorTraslado) throw errorTraslado;

      // Insertar detalle
      const detalle = productosSeleccionados.map(p => ({
        traslado_id: (traslado as any)?.id,
        producto_id: p.producto_id,
        cantidad: p.cantidad
      }));

      const { error: errorDetalle } = await (supabase as any)
        .from('traslados_detalle')
        .insert(detalle);

      if (errorDetalle) throw errorDetalle;

      alert('Traslado creado exitosamente');
      limpiarFormulario();
      cargarTraslados();
      setMostrarFormulario(false);
    } catch (error: any) {
      console.error('Error al guardar traslado:', error);
      alert('Error al guardar traslado: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const completarTraslado = async (trasladoId: string) => {
    if (!confirm('¿Estás seguro de completar este traslado? Esto actualizará el inventario.')) {
      return;
    }

    try {
      setLoading(true);

      const { error } = await (supabase as any)
        .from('traslados')
        .update({ estado: 'completado' })
        .eq('id', trasladoId);

      if (error) throw error;

      alert('Traslado completado. El inventario se ha actualizado.');
      cargarTraslados();
    } catch (error: any) {
      console.error('Error al completar traslado:', error);
      alert('Error al completar traslado: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const cancelarTraslado = async (trasladoId: string) => {
    if (!confirm('¿Estás seguro de cancelar este traslado?')) {
      return;
    }

    try {
      setLoading(true);

      const { error } = await (supabase as any)
        .from('traslados')
        .update({ estado: 'cancelado' })
        .eq('id', trasladoId);

      if (error) throw error;

      alert('Traslado cancelado');
      cargarTraslados();
    } catch (error: any) {
      console.error('Error al cancelar traslado:', error);
      alert('Error al cancelar traslado: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const limpiarFormulario = () => {
    setPuntoOrigen('');
    setPuntoDestino('');
    setObservaciones('');
    setProductosSeleccionados([]);
    setBusquedaProducto('');
  };

  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase())
  );

  const trasladosFiltrados = traslados.filter(t => {
    const matchEstado = filtroEstado === 'todos' || t.estado === filtroEstado;
    const matchPunto = filtroPunto === 'todos' || 
      t.punto_origen === filtroPunto || 
      t.punto_destino === filtroPunto;
    return matchEstado && matchPunto;
  });

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'completado':
        return 'bg-green-100 text-green-800';
      case 'pendiente':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getEstadoIcono = (estado: string) => {
    switch (estado) {
      case 'completado':
        return <Check className="w-4 h-4" />;
      case 'pendiente':
        return <Clock className="w-4 h-4" />;
      case 'cancelado':
        return <Ban className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <ArrowRightLeft className="w-8 h-8 text-teal-600" />
          Traslados de Inventario
        </h1>
        <button
          onClick={() => setMostrarFormulario(true)}
          className="bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 flex items-center gap-2 shadow-md"
        >
          <Plus className="w-5 h-5" />
          Nuevo Traslado
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estado
            </label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="todos">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="completado">Completado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Punto de Venta
            </label>
            <select
              value={filtroPunto}
              onChange={(e) => setFiltroPunto(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="todos">Todos</option>
              {puntos.map(punto => (
                <option key={punto.id} value={punto.nombre}>{punto.nombre}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Modal de Nuevo Traslado */}
      {mostrarFormulario && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">Nuevo Traslado</h2>
              <button
                onClick={() => {
                  setMostrarFormulario(false);
                  limpiarFormulario();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Puntos de venta */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Punto de Origen *
                  </label>
                  <select
                    value={puntoOrigen}
                    onChange={(e) => setPuntoOrigen(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    required
                  >
                    <option value="">Seleccionar punto...</option>
                    {puntos.map(punto => (
                      <option key={punto.id} value={punto.id}>{punto.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Punto de Destino *
                  </label>
                  <select
                    value={puntoDestino}
                    onChange={(e) => setPuntoDestino(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    required
                    disabled={!puntoOrigen}
                  >
                    <option value="">Seleccionar punto...</option>
                    {puntos
                      .filter(p => p.id !== puntoOrigen)
                      .map(punto => (
                        <option key={punto.id} value={punto.id}>{punto.nombre}</option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Buscar productos */}
              {puntoOrigen && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Buscar Producto
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={busquedaProducto}
                      onChange={(e) => setBusquedaProducto(e.target.value)}
                      placeholder="Buscar por nombre..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  {busquedaProducto && productosFiltrados.length > 0 && (
                    <div className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                      {productosFiltrados.map(producto => (
                        <button
                          key={producto.id}
                          onClick={() => agregarProducto(producto)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 flex justify-between items-center"
                        >
                          <span>{producto.nombre}</span>
                          <span className="text-sm text-gray-500">
                            Stock: {producto.stock_disponible}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Productos seleccionados */}
              {productosSeleccionados.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Productos a Trasladar ({productosSeleccionados.length})
                  </h3>
                  <div className="space-y-3">
                    {productosSeleccionados.map(producto => (
                      <div
                        key={producto.producto_id}
                        className="flex items-center justify-between bg-gray-50 p-4 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">
                            {producto.producto_nombre}
                          </div>
                          <div className="text-sm text-gray-500">
                            Stock disponible: {producto.stock_disponible}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            value={producto.cantidad}
                            onChange={(e) => actualizarCantidad(producto.producto_id, parseInt(e.target.value) || 0)}
                            min="1"
                            max={producto.stock_disponible}
                            className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-teal-500"
                          />
                          <button
                            onClick={() => eliminarProducto(producto.producto_id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Observaciones */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observaciones
                </label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="Motivo del traslado, notas adicionales..."
                />
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setMostrarFormulario(false);
                    limpiarFormulario();
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarTraslado}
                  disabled={loading || productosSeleccionados.length === 0}
                  className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? 'Guardando...' : 'Crear Traslado'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lista de traslados */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {loading && traslados.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Cargando traslados...</div>
        ) : trasladosFiltrados.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No hay traslados registrados</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Origen</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destino</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Productos</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {trasladosFiltrados.map((traslado) => (
                  <tr key={traslado.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(traslado.created_at).toLocaleDateString('es-CO', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {traslado.punto_origen}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {traslado.punto_destino}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-xs">
                        {traslado.productos.slice(0, 2).map((p, i) => (
                          <div key={i} className="text-xs">
                            {p.producto} ({p.cantidad})
                          </div>
                        ))}
                        {traslado.productos.length > 2 && (
                          <div className="text-xs text-gray-500">
                            +{traslado.productos.length - 2} más
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getEstadoColor(traslado.estado)}`}>
                        {getEstadoIcono(traslado.estado)}
                        {traslado.estado.charAt(0).toUpperCase() + traslado.estado.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {traslado.usuario}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {traslado.estado === 'pendiente' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => completarTraslado(traslado.id)}
                            className="text-green-600 hover:text-green-700 font-medium"
                            title="Completar traslado"
                          >
                            Completar
                          </button>
                          <button
                            onClick={() => cancelarTraslado(traslado.id)}
                            className="text-red-600 hover:text-red-700 font-medium"
                            title="Cancelar traslado"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                      {traslado.estado === 'completado' && (
                        <span className="text-gray-500 text-xs">
                          {traslado.completado_at && new Date(traslado.completado_at).toLocaleDateString('es-CO')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}