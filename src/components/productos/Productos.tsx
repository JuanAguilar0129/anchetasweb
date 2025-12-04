import { useEffect, useState } from 'react';
import { Plus, Edit2, Package, Trash2, DollarSign, Save, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

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

export default function Productos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Producto | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<string>('');
  const [tempCost, setTempCost] = useState<string>('');
  
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    precio_venta: '',
    costo: '',
    imagen_url: '',
    activo: true
  });

  useEffect(() => {
    loadProductos();
  }, []);

  const loadProductos = async () => {
    try {
      setLoading(true);
      const { data } = await (supabase as any)
        .from('productos')
        .select('*')
        .order('nombre');

      if (data) setProductos(data);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await (supabase as any)
          .from('productos')
          .update({
            nombre: formData.nombre,
            descripcion: formData.descripcion,
            precio_venta: parseFloat(formData.precio_venta),
            costo: parseFloat(formData.costo),
            imagen_url: formData.imagen_url,
            activo: formData.activo
          })
          .eq('id', editingProduct.id);
      } else {
        await (supabase as any)
          .from('productos')
          .insert([{
            nombre: formData.nombre,
            descripcion: formData.descripcion,
            precio_venta: parseFloat(formData.precio_venta),
            costo: parseFloat(formData.costo),
            imagen_url: formData.imagen_url,
            activo: formData.activo
          }]);
      }

      setShowModal(false);
      setEditingProduct(null);
      resetForm();
      loadProductos();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Error al guardar el producto');
    }
  };

  const handleEdit = (producto: Producto) => {
    setEditingProduct(producto);
    setFormData({
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      precio_venta: producto.precio_venta.toString(),
      costo: producto.costo?.toString() || '0',
      imagen_url: producto.imagen_url || '',
      activo: producto.activo
    });
    setShowModal(true);
  };

  const handleQuickPriceEdit = (producto: Producto) => {
    setEditingPriceId(producto.id);
    setTempPrice(producto.precio_venta.toString());
    setTempCost(producto.costo?.toString() || '0');
  };

  const handleSaveQuickPrice = async (id: string) => {
    try {
      await (supabase as any)
        .from('productos')
        .update({
          precio_venta: parseFloat(tempPrice),
          costo: parseFloat(tempCost)
        })
        .eq('id', id);

      setEditingPriceId(null);
      loadProductos();
    } catch (error) {
      console.error('Error updating price:', error);
      alert('Error al actualizar el precio');
    }
  };

  const handleCancelQuickPrice = () => {
    setEditingPriceId(null);
    setTempPrice('');
    setTempCost('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de desactivar este producto?')) return;
    
    try {
      await (supabase as any)
        .from('productos')
        .update({ activo: false })
        .eq('id', id);

      loadProductos();
    } catch (error) {
      console.error('Error deactivating product:', error);
      alert('Error al desactivar el producto');
    }
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      descripcion: '',
      precio_venta: '',
      costo: '',
      imagen_url: '',
      activo: true
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  };

  const calculateMargin = (precio: number, costo: number) => {
    if (costo === 0) return 0;
    return ((precio - costo) / precio * 100).toFixed(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Productos</h2>
          <p className="text-gray-600 mt-1">Gestiona tu catálogo de productos</p>
        </div>
        <button
          onClick={() => {
            setEditingProduct(null);
            resetForm();
            setShowModal(true);
          }}
          className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition"
        >
          <Plus className="w-5 h-5" />
          <span>Nuevo Producto</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Cargando...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Producto</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Costo</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Precio Venta</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Margen</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Estado</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {productos.map(producto => (
                  <tr key={producto.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        {producto.imagen_url ? (
                          <img 
                            src={producto.imagen_url} 
                            alt={producto.nombre}
                            className="w-12 h-12 object-cover rounded"
                            onError={(e) => {
                              e.currentTarget.src = 'https://via.placeholder.com/100/e5e7eb/9ca3af?text=No+IMG';
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 bg-teal-100 rounded flex items-center justify-center">
                            <Package className="w-6 h-6 text-teal-600" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-gray-900">{producto.nombre}</p>
                          <p className="text-sm text-gray-500">{producto.descripcion}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {editingPriceId === producto.id ? (
                        <input
                          type="number"
                          value={tempCost}
                          onChange={(e) => setTempCost(e.target.value)}
                          className="w-24 text-center border border-gray-300 rounded px-2 py-1 text-sm"
                          step="0.01"
                        />
                      ) : (
                        <span className="text-gray-700">{formatCurrency(Number(producto.costo || 0))}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {editingPriceId === producto.id ? (
                        <input
                          type="number"
                          value={tempPrice}
                          onChange={(e) => setTempPrice(e.target.value)}
                          className="w-24 text-center border border-gray-300 rounded px-2 py-1 text-sm"
                          step="0.01"
                        />
                      ) : (
                        <span className="text-teal-700 font-semibold">{formatCurrency(Number(producto.precio_venta))}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        Number(calculateMargin(producto.precio_venta, producto.costo || 0)) > 30 
                          ? 'bg-green-100 text-green-800' 
                          : Number(calculateMargin(producto.precio_venta, producto.costo || 0)) > 15
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {calculateMargin(producto.precio_venta, producto.costo || 0)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                        producto.activo 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {producto.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center space-x-2">
                        {editingPriceId === producto.id ? (
                          <>
                            <button
                              onClick={() => handleSaveQuickPrice(producto.id)}
                              className="text-green-600 hover:text-green-700 p-1"
                              title="Guardar"
                            >
                              <Save className="w-5 h-5" />
                            </button>
                            <button
                              onClick={handleCancelQuickPrice}
                              className="text-gray-600 hover:text-gray-700 p-1"
                              title="Cancelar"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleQuickPriceEdit(producto)}
                              className="text-blue-600 hover:text-blue-700 p-1"
                              title="Editar precio rápido"
                            >
                              <DollarSign className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleEdit(producto)}
                              className="text-teal-600 hover:text-teal-700 p-1"
                              title="Editar completo"
                            >
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(producto.id)}
                              className="text-red-600 hover:text-red-700 p-1"
                              title="Desactivar"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <textarea
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Costo *
                    </label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      value={formData.costo}
                      onChange={(e) => setFormData({ ...formData, costo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Precio de Venta *
                    </label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      value={formData.precio_venta}
                      onChange={(e) => setFormData({ ...formData, precio_venta: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {formData.costo && formData.precio_venta && (
                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                    <p className="text-sm text-teal-800">
                      <span className="font-semibold">Margen de ganancia:</span> {calculateMargin(parseFloat(formData.precio_venta), parseFloat(formData.costo))}%
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL de Imagen
                  </label>
                  <input
                    type="url"
                    value={formData.imagen_url}
                    onChange={(e) => setFormData({ ...formData, imagen_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="https://ejemplo.com/imagen.jpg"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="activo"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                  />
                  <label htmlFor="activo" className="text-sm font-medium text-gray-700">
                    Producto activo
                  </label>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2 px-4 rounded-lg font-medium transition"
                  >
                    {editingProduct ? 'Actualizar' : 'Crear'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingProduct(null);
                      resetForm();
                    }}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-lg font-medium transition"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}