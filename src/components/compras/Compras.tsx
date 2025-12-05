import { useEffect, useState, useRef } from 'react';
import { ShoppingBag, X, Check, Search, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Producto {
  id: string;
  nombre: string;
  descripcion: string;
  precio_venta: number;
  costo: number;
  activo: boolean;
  imagen_url?: string;
  created_at?: string;
}

interface CompraItem {
  producto: Producto;
  cantidad: number;
  costoUnitario: number;
}

export default function Compras() {
  const { user, puntosAsignados } = useAuth();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [compraItems, setCompraItems] = useState<CompraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedPunto, setSelectedPunto] = useState<string>(puntosAsignados[0]?.id || '');
  const [proveedor, setProveedor] = useState('Centro de Acopio');
  const [notas, setNotas] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados para el flujo rápido de entrada
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null);
  const [quickCantidad, setQuickCantidad] = useState('');
  const [quickCosto, setQuickCosto] = useState('');
  
  // Referencias para el enfoque automático
  const searchRef = useRef<HTMLInputElement>(null);
  const cantidadRef = useRef<HTMLInputElement>(null);
  const costoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (puntosAsignados.length > 0 && !selectedPunto) {
      setSelectedPunto(puntosAsignados[0].id);
    }
  }, [puntosAsignados, selectedPunto]);

  useEffect(() => {
    loadProductos();
  }, []);

  // Enfocar búsqueda al cargar
  useEffect(() => {
    if (!loading) {
      searchRef.current?.focus();
    }
  }, [loading]);

  const loadProductos = async () => {
    try {
      setLoading(true);
      const { data } = await (supabase as any)
        .from('productos')
        .select('*')
        .eq('activo', true)
        .order('nombre');

      if (data) setProductos(data);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProductos = productos.filter(producto =>
    producto.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    producto.descripcion.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Abrir modal de entrada rápida
  const openQuickAdd = (producto: Producto) => {
    setSelectedProducto(producto);
    setQuickCantidad('1');
    setQuickCosto(producto.costo?.toString() || '0');
    setShowQuickAdd(true);
    
    // Enfocar cantidad después de un momento
    setTimeout(() => {
      cantidadRef.current?.focus();
      cantidadRef.current?.select();
    }, 100);
  };

  // Manejar Enter en búsqueda
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filteredProductos.length > 0) {
      e.preventDefault();
      openQuickAdd(filteredProductos[0]);
    }
  };

  // Manejar Enter en cantidad
  const handleCantidadKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      costoRef.current?.focus();
      costoRef.current?.select();
    }
  };

  // Manejar Enter en costo
  const handleCostoKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      agregarProductoRapido();
    }
  };

  // Agregar producto desde el modal rápido
  const agregarProductoRapido = () => {
    if (!selectedProducto || !quickCantidad || !quickCosto) return;

    const cantidad = parseInt(quickCantidad);
    const costo = parseFloat(quickCosto);

    if (cantidad <= 0 || costo < 0) {
      alert('Cantidad y costo deben ser valores válidos');
      return;
    }

    const existingItem = compraItems.find(c => c.producto.id === selectedProducto.id);
    
    if (existingItem) {
      setCompraItems(compraItems.map(c =>
        c.producto.id === selectedProducto.id
          ? { ...c, cantidad: c.cantidad + cantidad, costoUnitario: costo }
          : c
      ));
    } else {
      setCompraItems([...compraItems, { 
        producto: selectedProducto, 
        cantidad,
        costoUnitario: costo
      }]);
    }

    // Resetear y volver al buscador
    setShowQuickAdd(false);
    setSelectedProducto(null);
    setQuickCantidad('');
    setQuickCosto('');
    setSearchTerm('');
    
    // Enfocar búsqueda inmediatamente
    setTimeout(() => {
      searchRef.current?.focus();
    }, 100);
  };

  // Cancelar entrada rápida
  const cancelarQuickAdd = () => {
    setShowQuickAdd(false);
    setSelectedProducto(null);
    setQuickCantidad('');
    setQuickCosto('');
    
    setTimeout(() => {
      searchRef.current?.focus();
    }, 100);
  };

  const removeFromCompra = (productoId: string) => {
    setCompraItems(compraItems.filter(c => c.producto.id !== productoId));
  };

  const handleSubmit = async () => {
    if (compraItems.length === 0) {
      alert('Agrega al menos un producto a la compra');
      return;
    }
    if (!user || !proveedor) {
      alert('Completa todos los campos requeridos');
      return;
    }

    setProcessing(true);
    try {
      const total = compraItems.reduce((sum, item) => sum + (item.costoUnitario * item.cantidad), 0);

      const { data: compraData, error: compraError } = await (supabase as any)
        .from('compras')
        .insert([{
          punto_id: selectedPunto,
          usuario_id: user.id,
          total,
          proveedor,
          notas
        }])
        .select()
        .single();

      if (compraError) throw compraError;

      const detalles = compraItems.map(item => ({
        compra_id: compraData.id,
        producto_id: item.producto.id,
        cantidad: item.cantidad,
        precio_unitario: item.costoUnitario,
        subtotal: item.costoUnitario * item.cantidad
      }));

      const { error: detalleError } = await (supabase as any)
        .from('compras_detalle')
        .insert(detalles);

      if (detalleError) throw detalleError;

      // Actualizar el costo del producto
      for (const item of compraItems) {
        await (supabase as any)
          .from('productos')
          .update({ costo: item.costoUnitario })
          .eq('id', item.producto.id);
      }

      // Actualizar inventario
      for (const item of compraItems) {
        const { data: existingInv } = await (supabase as any)
          .from('inventario')
          .select('*')
          .eq('producto_id', item.producto.id)
          .eq('punto_id', selectedPunto)
          .maybeSingle();

        if (existingInv) {
          await (supabase as any)
            .from('inventario')
            .update({ cantidad: existingInv.cantidad + item.cantidad })
            .eq('id', existingInv.id);
        } else {
          await (supabase as any)
            .from('inventario')
            .insert([{
              producto_id: item.producto.id,
              punto_id: selectedPunto,
              cantidad: item.cantidad,
              stock_minimo: 10
            }]);
        }
      }

      setCompraItems([]);
      setProveedor('Centro de Acopio');
      setNotas('');
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        searchRef.current?.focus();
      }, 2000);
    } catch (error) {
      console.error('Error processing purchase:', error);
      alert('Error al procesar la compra: ' + (error as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  };

  const calculateTotal = () => {
    return compraItems.reduce((sum, item) => sum + (item.costoUnitario * item.cantidad), 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Registrar Compra</h2>
          <p className="text-gray-600 mt-1">Ingreso rápido de factura</p>
        </div>

        {puntosAsignados.length > 1 && (
          <select
            value={selectedPunto}
            onChange={(e) => setSelectedPunto(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            {puntosAsignados.map(punto => (
              <option key={punto.id} value={punto.id}>{punto.nombre}</option>
            ))}
          </select>
        )}
      </div>

      {/* Información de uso */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          💡 <strong>Flujo rápido:</strong> Busca el producto → Enter → Ingresa cantidad → Enter → Ingresa costo → Enter
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel de búsqueda y selección */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-md p-6">
            {/* Buscador */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buscar Producto
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Escribe y presiona Enter..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full pl-10 pr-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  autoComplete="off"
                />
              </div>
              {searchTerm && (
                <p className="text-xs text-gray-500 mt-1">
                  {filteredProductos.length} producto{filteredProductos.length !== 1 ? 's' : ''} encontrado{filteredProductos.length !== 1 ? 's' : ''} • Presiona Enter para seleccionar el primero
                </p>
              )}
            </div>

            {/* Lista de productos */}
            {loading ? (
              <p className="text-gray-500 text-center py-8">Cargando...</p>
            ) : searchTerm && filteredProductos.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No se encontraron productos</p>
            ) : searchTerm ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredProductos.map((producto, index) => (
                  <div
                    key={producto.id}
                    onClick={() => openQuickAdd(producto)}
                    className={`border-2 rounded-lg p-3 cursor-pointer transition ${
                      index === 0 
                        ? 'border-teal-500 bg-teal-50' 
                        : 'border-gray-200 hover:border-teal-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{producto.nombre}</h4>
                        <p className="text-sm text-gray-600 line-clamp-1">{producto.descripcion}</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-xs text-gray-500">Costo sugerido:</p>
                        <p className="text-sm font-bold text-teal-600">
                          {formatCurrency(Number(producto.costo || 0))}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Comienza a escribir para buscar productos</p>
              </div>
            )}
          </div>
        </div>

        {/* Panel de resumen */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-md p-6 sticky top-6">
            <div className="flex items-center space-x-2 mb-4">
              <ShoppingBag className="w-6 h-6 text-teal-600" />
              <h3 className="text-xl font-bold text-gray-900">Resumen</h3>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor *</label>
                <input
                  type="text"
                  placeholder="Nombre del proveedor"
                  value={proveedor}
                  onChange={(e) => setProveedor(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  placeholder="Notas adicionales (opcional)"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  rows={2}
                />
              </div>
            </div>

            {compraItems.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No hay productos agregados</p>
              </div>
            ) : (
              <>
                <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                  {compraItems.map(item => (
                    <div key={item.producto.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-semibold text-gray-900 text-sm flex-1">{item.producto.nombre}</p>
                        <button
                          onClick={() => removeFromCompra(item.producto.id)}
                          className="text-red-600 hover:text-red-700 ml-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-600">Cantidad:</span>
                          <p className="font-bold text-gray-900">{item.cantidad}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Costo:</span>
                          <p className="font-bold text-teal-600">{formatCurrency(item.costoUnitario)}</p>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-gray-300">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-600">Subtotal:</span>
                          <span className="font-bold text-gray-900">
                            {formatCurrency(item.costoUnitario * item.cantidad)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t-2 border-gray-300 pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-lg font-semibold text-gray-900">Total:</span>
                    <span className="text-2xl font-bold text-teal-600">
                      {formatCurrency(calculateTotal())}
                    </span>
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={processing || compraItems.length === 0 || !proveedor}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    <Check className="w-5 h-5" />
                    <span>{processing ? 'Procesando...' : 'Registrar Compra'}</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {showSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
              <Check className="w-5 h-5 text-green-600" />
              <p className="text-sm text-green-800 font-medium">¡Compra registrada exitosamente!</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de entrada rápida */}
      {showQuickAdd && selectedProducto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900">{selectedProducto.nombre}</h3>
                <p className="text-sm text-gray-600">{selectedProducto.descripcion}</p>
              </div>
              <button 
                onClick={cancelarQuickAdd}
                className="text-gray-500 hover:text-gray-700 ml-2"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cantidad <span className="text-teal-600">(Enter para continuar)</span>
                </label>
                <input
                  ref={cantidadRef}
                  type="number"
                  value={quickCantidad}
                  onChange={(e) => setQuickCantidad(e.target.value)}
                  onKeyDown={handleCantidadKeyDown}
                  className="w-full px-4 py-3 text-lg font-semibold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-center"
                  min="1"
                  step="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Costo Unitario <span className="text-teal-600">(Enter para agregar)</span>
                </label>
                <input
                  ref={costoRef}
                  type="number"
                  value={quickCosto}
                  onChange={(e) => setQuickCosto(e.target.value)}
                  onKeyDown={handleCostoKeyDown}
                  className="w-full px-4 py-3 text-lg font-semibold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-center"
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-gray-500 mt-1 text-center">
                  Costo sugerido: {formatCurrency(selectedProducto.costo || 0)}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Subtotal:</span>
                  <span className="text-xl font-bold text-teal-600">
                    {formatCurrency((parseFloat(quickCosto) || 0) * (parseInt(quickCantidad) || 0))}
                  </span>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={cancelarQuickAdd}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-lg transition font-medium"
                >
                  Cancelar (Esc)
                </button>
                <button
                  onClick={agregarProductoRapido}
                  disabled={!quickCantidad || !quickCosto}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-4 py-3 rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  <Plus className="w-5 h-5" />
                  <span>Agregar (Enter)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}