import { useEffect, useState } from 'react';
import { ShoppingCart, Plus, Minus, X, Check, Edit2, Save, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Producto {
  id: string;
  nombre: string;
  descripcion: string;
  precio_venta: number;
  precio_costo?: number;
  costo_unitario?: number;
  costo?: number;
  activo: boolean;
  imagen_url?: string;
}

interface Inventario {
  id: string;
  producto_id: string;
  punto_id: string;
  cantidad: number;
  stock_minimo: number;
  productos: Producto | null;
}

interface VentaItem {
  producto: Producto;
  cantidad: number;
  inventarioId: string;
}

export default function Ventas() {
  const { user, puntosAsignados } = useAuth();
  const [inventario, setInventario] = useState<Inventario[]>([]);
  const [ventaItems, setVentaItems] = useState<VentaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedPunto, setSelectedPunto] = useState<string>(puntosAsignados[0]?.id || '');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para edición de precio
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [nuevoPrecio, setNuevoPrecio] = useState<number>(0);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (puntosAsignados.length > 0 && !selectedPunto) {
      setSelectedPunto(puntosAsignados[0].id);
    }
  }, [puntosAsignados, selectedPunto]);

  useEffect(() => {
    if (selectedPunto) {
      loadInventario();
    }
  }, [selectedPunto]);

  const loadInventario = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('inventario')
        .select('*, productos(*)')
        .eq('punto_id', selectedPunto)
        .gt('cantidad', 0);

      if (error) {
        console.error('Error loading inventory:', error);
        setInventario([]);
        return;
      }

      const validInventory = (data || []).filter((item: Inventario) => 
        item.productos !== null && 
        item.productos.activo === true
      );

      setInventario(validInventory);
    } catch (error) {
      console.error('Error loading inventory:', error);
      setInventario([]);
    } finally {
      setLoading(false);
    }
  };

  const addToVenta = (item: Inventario) => {
    if (!item.productos) return;
    
    const existingItem = ventaItems.find(v => v.producto.id === item.producto_id);
    if (existingItem) {
      if (existingItem.cantidad < item.cantidad) {
        setVentaItems(ventaItems.map(v =>
          v.producto.id === item.producto_id
            ? { ...v, cantidad: v.cantidad + 1 }
            : v
        ));
      }
    } else {
      const productoClone: Producto = { ...item.productos };
      setVentaItems([...ventaItems, { 
        producto: productoClone, 
        cantidad: 1, 
        inventarioId: item.id 
      }]);
      setShowCart(true);
    }
  };

  const removeFromVenta = (productoId: string) => {
    setVentaItems(ventaItems.filter(v => v.producto.id !== productoId));
  };

  const updateQuantity = (productoId: string, cantidad: number) => {
    const inventarioItem = inventario.find(i => i.producto_id === productoId);
    if (!inventarioItem || cantidad <= 0 || cantidad > inventarioItem.cantidad) return;
    
    setVentaItems(ventaItems.map(v =>
      v.producto.id === productoId ? { ...v, cantidad } : v
    ));
  };

  const handleSubmit = async () => {
    if (ventaItems.length === 0 || !user) return;

    setProcessing(true);
    try {
      const total = ventaItems.reduce((sum, item) => sum + (Number(item.producto.precio_venta) * item.cantidad), 0);

      const { data: ventaData, error: ventaError } = await (supabase as any)
        .from('ventas')
        .insert([{
          punto_id: selectedPunto,
          vendedor_id: user.id,
          total
        }])
        .select()
        .single();

      if (ventaError) throw ventaError;

      const detalles = ventaItems.map(item => ({
        venta_id: ventaData.id,
        producto_id: item.producto.id,
        cantidad: item.cantidad,
        precio_unitario: Number(item.producto.precio_venta),
        subtotal: Number(item.producto.precio_venta) * item.cantidad
      }));

      const { error: detalleError } = await (supabase as any)
        .from('ventas_detalle')
        .insert(detalles);

      if (detalleError) throw detalleError;

      for (const item of ventaItems) {
        const inventarioItem = inventario.find(i => i.producto_id === item.producto.id);
        if (inventarioItem) {
          await (supabase as any)
            .from('inventario')
            .update({ cantidad: inventarioItem.cantidad - item.cantidad })
            .eq('id', inventarioItem.id);
        }
      }

      setVentaItems([]);
      setShowCart(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      await loadInventario();
    } catch (error) {
      console.error('Error processing sale:', error);
      alert('Error al procesar la venta');
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
    return ventaItems.reduce((sum, item) => sum + (Number(item.producto.precio_venta) * item.cantidad), 0);
  };

  const openEditPrice = (productoId: string) => {
    setEditError(null);
    const item = ventaItems.find(v => v.producto.id === productoId);
    if (!item) return;

    setEditingItemId(productoId);
    setNuevoPrecio(Number(item.producto.precio_venta));
  };

  const closeEditPrice = () => {
    setEditingItemId(null);
    setNuevoPrecio(0);
    setEditError(null);
  };

  const saveNewPrice = () => {
    if (!editingItemId) return;
    setEditError(null);

    const item = ventaItems.find(v => v.producto.id === editingItemId);
    if (!item) {
      setEditError('Ítem no encontrado');
      return;
    }

    const costo = Number(item.producto.precio_costo ?? item.producto.costo_unitario ?? item.producto.costo ?? 0);
    if (Number(nuevoPrecio) < costo) {
      setEditError(`El precio no puede ser menor al costo (${formatCurrency(costo)}).`);
      return;
    }
    if (Number(nuevoPrecio) <= 0) {
      setEditError('El precio debe ser mayor que cero.');
      return;
    }

    setVentaItems(prev =>
      prev.map(v =>
        v.producto.id === editingItemId 
          ? { ...v, producto: { ...v.producto, precio_venta: Number(nuevoPrecio) } } 
          : v
      )
    );

    closeEditPrice();
  };

  const filteredInventario = inventario.filter(item =>
    item.productos?.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalItems = ventaItems.reduce((sum, item) => sum + item.cantidad, 0);

  return (
    <>
      {/* Header - Sticky */}
      <div className="sticky top-0 z-40 bg-white shadow-sm border-b">
        <div className="p-3 md:p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">Punto de Venta</h2>
              {puntosAsignados.length > 1 && (
                <select
                  value={selectedPunto}
                  onChange={(e) => setSelectedPunto(e.target.value)}
                  className="mt-1 text-sm px-2 py-1 border border-gray-300 rounded-lg w-full md:w-auto"
                >
                  {puntosAsignados.map(punto => (
                    <option key={punto.id} value={punto.id}>{punto.nombre}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Botón carrito flotante móvil */}
            <button
              onClick={() => setShowCart(true)}
              className="md:hidden relative bg-teal-600 text-white p-3 rounded-full shadow-lg active:scale-95 transition"
            >
              <ShoppingCart className="w-6 h-6" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>
          </div>

          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="md:grid md:grid-cols-3 md:gap-6 md:p-6 pb-6">
        {/* Grid de productos */}
        <div className="md:col-span-2 p-3 md:p-0">
          {loading ? (
            <p className="text-gray-500 text-center py-8">Cargando...</p>
          ) : filteredInventario.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl">
              <p className="text-gray-500">No hay productos disponibles</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
              {filteredInventario.map(item => {
                if (!item.productos) return null;
                return (
                  <div
                    key={item.id}
                    className="bg-white border border-gray-200 rounded-lg overflow-hidden active:scale-95 transition cursor-pointer"
                    onClick={() => addToVenta(item)}
                  >
                    {item.productos.imagen_url && (
                      <div className="w-full aspect-square bg-gray-100">
                        <img 
                          src={item.productos.imagen_url} 
                          alt={item.productos.nombre}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = 'https://via.placeholder.com/400/e5e7eb/9ca3af?text=Sin+Imagen';
                          }}
                        />
                      </div>
                    )}
                    <div className="p-2 md:p-3">
                      <div className="flex justify-between items-start gap-1 mb-1">
                        <h4 className="font-semibold text-gray-900 text-xs md:text-sm line-clamp-2 flex-1">
                          {item.productos.nombre}
                        </h4>
                        <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
                          {item.cantidad}
                        </span>
                      </div>
                      <p className="text-base md:text-lg font-bold text-teal-600">
                        {formatCurrency(Number(item.productos.precio_venta))}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Carrito Desktop */}
        <div className="hidden md:block">
          <div className="bg-white rounded-xl shadow-md p-6 sticky top-24">
            <div className="flex items-center space-x-2 mb-4">
              <ShoppingCart className="w-6 h-6 text-teal-600" />
              <h3 className="text-xl font-bold text-gray-900">Carrito</h3>
            </div>

            {ventaItems.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Carrito vacío</p>
            ) : (
              <>
                <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                  {ventaItems.map(item => {
                    const inventarioItem = inventario.find(i => i.producto_id === item.producto.id);
                    const maxCantidad = inventarioItem?.cantidad || 0;
                    const costo = Number(item.producto.precio_costo ?? item.producto.costo_unitario ?? item.producto.costo ?? 0);

                    return (
                      <div key={item.producto.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <p className="font-semibold text-sm text-gray-900 flex-1">{item.producto.nombre}</p>
                          <button
                            onClick={() => removeFromVenta(item.producto.id)}
                            className="text-red-600 hover:text-red-700 ml-2"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => updateQuantity(item.producto.id, item.cantidad - 1)}
                              className="bg-gray-100 hover:bg-gray-200 p-1 rounded"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-10 text-center text-sm font-bold">{item.cantidad}</span>
                            <button
                              onClick={() => updateQuantity(item.producto.id, item.cantidad + 1)}
                              className="bg-gray-100 hover:bg-gray-200 p-1 rounded"
                              disabled={item.cantidad >= maxCantidad}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          
                          <div className="text-right">
                            <p className="font-bold text-teal-600">
                              {formatCurrency(Number(item.producto.precio_venta) * item.cantidad)}
                            </p>
                            <p className="text-xs text-gray-500">Stock: {maxCantidad}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => openEditPrice(item.producto.id)}
                          className="w-full flex items-center justify-center gap-1 px-2 py-1 bg-yellow-400 text-white text-xs rounded hover:bg-yellow-500"
                        >
                          <Edit2 className="w-3 h-3" />
                          Modificar Precio
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Total:</span>
                    <span className="text-2xl font-bold text-teal-600">
                      {formatCurrency(calculateTotal())}
                    </span>
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={processing}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    {processing ? 'Procesando...' : 'Completar Venta'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Carrito Móvil - Modal desde abajo */}
      {showCart && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCart(false)} />
          
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-teal-600" />
                  <h3 className="text-lg font-bold">Carrito</h3>
                  {totalItems > 0 && (
                    <span className="bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                      {totalItems}
                    </span>
                  )}
                </div>
                <button onClick={() => setShowCart(false)} className="text-gray-500">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-4">
              {ventaItems.length === 0 ? (
                <p className="text-gray-500 text-center py-12">Carrito vacío</p>
              ) : (
                <>
                  <div className="space-y-3 mb-4">
                    {ventaItems.map(item => {
                      const inventarioItem = inventario.find(i => i.producto_id === item.producto.id);
                      const maxCantidad = inventarioItem?.cantidad || 0;

                      return (
                        <div key={item.producto.id} className="border rounded-lg p-3">
                          <div className="flex gap-2 mb-2">
                            {item.producto.imagen_url && (
                              <img 
                                src={item.producto.imagen_url} 
                                className="w-16 h-16 object-cover rounded"
                                onError={(e) => e.currentTarget.style.display = 'none'}
                              />
                            )}
                            <div className="flex-1">
                              <div className="flex justify-between">
                                <p className="font-semibold text-sm">{item.producto.nombre}</p>
                                <button onClick={() => removeFromVenta(item.producto.id)} className="text-red-600">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              <p className="text-lg font-bold text-teal-600">
                                {formatCurrency(Number(item.producto.precio_venta) * item.cantidad)}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateQuantity(item.producto.id, item.cantidad - 1)}
                                className="bg-gray-100 active:bg-gray-200 p-2 rounded"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="w-8 text-center font-bold">{item.cantidad}</span>
                              <button
                                onClick={() => updateQuantity(item.producto.id, item.cantidad + 1)}
                                className="bg-gray-100 active:bg-gray-200 p-2 rounded"
                                disabled={item.cantidad >= maxCantidad}
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                            
                            <button
                              onClick={() => openEditPrice(item.producto.id)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-yellow-400 text-white text-sm rounded active:bg-yellow-500"
                            >
                              <Edit2 className="w-4 h-4" />
                              Precio
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Stock disponible: {maxCantidad}</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t pt-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold">Total:</span>
                      <span className="text-2xl font-bold text-teal-600">
                        {formatCurrency(calculateTotal())}
                      </span>
                    </div>
                    <button
                      onClick={handleSubmit}
                      disabled={processing}
                      className="w-full bg-teal-600 active:bg-teal-700 text-white font-bold py-4 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Check className="w-5 h-5" />
                      {processing ? 'Procesando...' : 'Completar Venta'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal editar precio */}
      {editingItemId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-4 md:p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold">Modificar Precio</h3>
              <button onClick={closeEditPrice} className="text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const item = ventaItems.find(v => v.producto.id === editingItemId);
              if (!item) return <p className="text-sm text-gray-500">Ítem no encontrado.</p>;
              
              const costo = Number(item.producto.precio_costo ?? item.producto.costo_unitario ?? item.producto.costo ?? 0);
              
              return (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">Producto</p>
                    <p className="font-semibold">{item.producto.nombre}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Costo</p>
                      <p className="font-semibold text-sm">{formatCurrency(costo)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Precio actual</p>
                      <p className="font-semibold text-sm">{formatCurrency(Number(item.producto.precio_venta))}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nuevo precio</label>
                    <input
                      type="number"
                      step="100"
                      value={nuevoPrecio}
                      onChange={(e) => setNuevoPrecio(Number(e.target.value))}
                      className="w-full border rounded-lg px-3 py-2 text-lg font-semibold"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Mínimo: {formatCurrency(costo)}
                    </p>
                  </div>

                  {editError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-sm text-red-600">{editError}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={closeEditPrice}
                      className="flex-1 px-4 py-2 bg-gray-100 rounded-lg font-medium"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={saveNewPrice}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg font-medium"
                    >
                      <Save className="w-4 h-4" />
                      Guardar
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Notificación éxito */}
      {showSuccess && (
        <div className="fixed top-4 left-4 right-4 md:top-auto md:bottom-6 md:right-6 md:left-auto md:w-96 bg-green-500 text-white rounded-xl shadow-2xl p-4 flex items-center gap-3 z-50">
          <div className="bg-white rounded-full p-2">
            <Check className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <p className="font-bold">¡Venta exitosa!</p>
            <p className="text-sm opacity-90">Registrada correctamente</p>
          </div>
        </div>
      )}
    </>
  );
}