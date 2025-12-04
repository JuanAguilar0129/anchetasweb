import { useEffect, useState } from 'react';
import { Package, AlertTriangle, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Producto {
  id: string;
  nombre: string;
  descripcion: string;
  precio_venta: number;
  activo: boolean;
}

interface PuntoVenta {
  id: string;
  nombre: string;
  direccion: string;
  activo: boolean;
}

interface Inventario {
  id: string;
  producto_id: string;
  punto_id: string;
  cantidad: number;
  stock_minimo: number;
  productos: Producto;
  puntos_venta: PuntoVenta;
}

export default function Inventario() {
  const { puntosAsignados } = useAuth();
  const [inventario, setInventario] = useState<Inventario[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPunto, setSelectedPunto] = useState<string>(puntosAsignados[0]?.id || '');
  const [searchTerm, setSearchTerm] = useState('');

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
      const { data } = await (supabase as any)
        .from('inventario')
        .select('*, productos(*), puntos_venta(*)')
        .eq('punto_id', selectedPunto)
        .order('productos(nombre)');

      if (data) setInventario(data);
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredInventario = inventario.filter(item =>
    item.productos.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStockStatus = (cantidad: number, stockMinimo: number) => {
    if (cantidad === 0) return { color: 'bg-red-100 text-red-800', label: 'Sin Stock' };
    if (cantidad <= stockMinimo) return { color: 'bg-orange-100 text-orange-800', label: 'Stock Bajo' };
    return { color: 'bg-green-100 text-green-800', label: 'Stock OK' };
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Inventario</h2>
          <p className="text-gray-600 mt-1">Control de stock por punto de venta</p>
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

      <div className="bg-white rounded-xl shadow-md p-4">
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

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Cargando...</p>
        </div>
      ) : filteredInventario.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No hay productos en el inventario</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Producto</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Precio</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Cantidad</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Stock Mínimo</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredInventario.map(item => {
                  const status = getStockStatus(item.cantidad, item.stock_minimo);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="bg-teal-100 p-2 rounded-lg">
                            <Package className="w-5 h-5 text-teal-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{item.productos.nombre}</p>
                            {item.productos.descripcion && (
                              <p className="text-sm text-gray-500 line-clamp-1">{item.productos.descripcion}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-900">
                        {formatCurrency(Number(item.productos.precio_venta))}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-lg font-bold text-gray-900">{item.cantidad}</span>
                      </td>
                      <td className="px-6 py-4 text-center text-gray-600">
                        {item.stock_minimo}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
                            {item.cantidad <= item.stock_minimo && (
                              <AlertTriangle className="w-4 h-4" />
                            )}
                            <span>{status.label}</span>
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}