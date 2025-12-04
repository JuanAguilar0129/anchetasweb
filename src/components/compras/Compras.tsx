import { useEffect, useState } from 'react';
import { Plus, ShoppingBag, Minus, X, Check, Search } from 'lucide-react';
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

  useEffect(() => {
    if (puntosAsignados.length > 0 && !selectedPunto) {
      setSelectedPunto(puntosAsignados[0].id);
    }
  }, [puntosAsignados, selectedPunto]);

  useEffect(() => {
    loadProductos();
  }, []);

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

  const addToCompra = (producto: Producto) => {
    const existingItem = compraItems.find(c => c.producto.id === producto.id);
    if (existingItem) {
      setCompraItems(compraItems.map(c =>
        c.producto.id === producto.id
          ? { ...c, cantidad: c.cantidad + 1 }
          : c
      ));
    } else {
      setCompraItems([...compraItems, { 
        producto, 
        cantidad: 1,
        costoUnitario: Number(producto.costo || 0)
      }]);
    }
  };

  const removeFromCompra = (productoId: string) => {
    setCompraItems(compraItems.filter(c => c.producto.id !== productoId));
  };

  const updateQuantity = (productoId: string, cantidad: number) => {
    if (cantidad <= 0) return;
    setCompraItems(compraItems.map(c =>
      c.producto.id === productoId ? { ...c, cantidad } : c
    ));
  };

  const updateCosto = (productoId: string, costo: number) => {
    if (costo < 0) return;
    setCompraItems(compraItems.map(c =>
      c.producto.id === productoId ? { ...c, costoUnitario: costo } : c
    ));
  };

  const handleSubmit = async () => {
    if (compraItems.length === 0) return;
    if (!user || !proveedor) return;

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

      // Actualizar el costo del producto en la tabla productos
      for (const item of compraItems) {
        await (supabase as any)
          .from('productos')
          .update({ costo: item.costoUnitario })
          .eq('id', item.producto.id);
      }

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
              cantidad: item.cantidad
            }]);
        }
      }

      setCompraItems([]);
      setProveedor('Centro de Acopio');
      setNotas('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Error processing purchase:', error);
      alert('Error al procesar la compra');
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
          <p className="text-gray-600 mt-1">Ingreso de inventario al punto de venta</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-4">Productos</h3>
            {loading ? (
              <p className="text-gray-500 text-center py-8">Cargando...</p>
            ) : filteredProductos.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                {searchTerm ? 'No se encontraron productos' : 'No hay productos disponibles'}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredProductos.map(producto => (
                  <div
                    key={producto.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-teal-500 transition cursor-pointer"
                    onClick={() => addToCompra(producto)}
                  >
                    <h4 className="font-semibold text-gray-900 mb-2">{producto.nombre}</h4>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">{producto.descripcion}</p>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-gray-500">Costo sugerido:</p>
                        <p className="text-lg font-bold text-teal-600">
                          {formatCurrency(Number(producto.costo || 0))}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Precio venta:</p>
                        <p className="text-sm text-gray-700">
                          {formatCurrency(Number(producto.precio_venta))}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-md p-6 sticky top-6">
            <div className="flex items-center space-x-2 mb-4">
              <ShoppingBag className="w-6 h-6 text-teal-600" />
              <h3 className="text-xl font-bold text-gray-900">Compra</h3>
            </div>

            <div className="space-y-3 mb-4">
              <input
                type="text"
                placeholder="Proveedor *"
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                required
              />
              <textarea
                placeholder="Notas adicionales"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                rows={2}
              />
            </div>

            {compraItems.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay productos</p>
            ) : (
              <>
                <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                  {compraItems.map(item => (
                    <div key={item.producto.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-semibold text-gray-900 text-sm">{item.producto.nombre}</p>
                        <button
                          onClick={() => removeFromCompra(item.producto.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-gray-600">Costo unitario:</label>
                          <input
                            type="number"
                            value={item.costoUnitario}
                            onChange={(e) => updateCosto(item.producto.id, parseFloat(e.target.value) || 0)}
                            className="w-full text-center border border-gray-300 rounded px-2 py-1 text-sm font-semibold text-teal-600"
                            step="0.01"
                            min="0"
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="text-xs text-gray-600">Cantidad:</label>
                            <div className="flex items-center space-x-2 mt-1">
                              <button
                                onClick={() => updateQuantity(item.producto.id, item.cantidad - 1)}
                                className="bg-gray-100 hover:bg-gray-200 p-1 rounded"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <input
                                type="number"
                                value={item.cantidad}
                                onChange={(e) => updateQuantity(item.producto.id, parseInt(e.target.value) || 1)}
                                className="w-16 text-center border border-gray-300 rounded px-2 py-1 text-sm"
                                min="1"
                              />
                              <button
                                onClick={() => updateQuantity(item.producto.id, item.cantidad + 1)}
                                className="bg-gray-100 hover:bg-gray-200 p-1 rounded"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-600">Subtotal:</p>
                            <span className="font-bold text-teal-600 text-sm">
                              {formatCurrency(item.costoUnitario * item.cantidad)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-200 pt-4">
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
              <p className="text-sm text-green-800 font-medium">Compra registrada exitosamente</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}