import { useEffect, useState } from 'react';
import { ArrowRightLeft, Package, Check, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';


interface Producto {
  id: string;
  nombre: string;
  precio_venta: number;
}

interface Inventario {
  id: string;
  producto_id: string;
  punto_id: string;
  cantidad: number;
  productos: Producto;
}

export default function Traslados() {
  const { user, puntosAsignados } = useAuth();
  const [inventarioOrigen, setInventarioOrigen] = useState<Inventario[]>([]);
  const [puntoOrigen, setPuntoOrigen] = useState<string>('');
  const [puntoDestino, setPuntoDestino] = useState<string>('');
  const [selectedProducto, setSelectedProducto] = useState<string>('');
  const [cantidad, setCantidad] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (puntosAsignados.length > 0) {
      if (!puntoOrigen) setPuntoOrigen(puntosAsignados[0].id);
      if (!puntoDestino && puntosAsignados.length > 1) {
        setPuntoDestino(puntosAsignados[1].id);
      }
    }
  }, [puntosAsignados]);

  useEffect(() => {
    if (puntoOrigen) {
      loadInventario();
    }
  }, [puntoOrigen]);

  const loadInventario = async () => {
    try {
      setLoading(true);
      const { data } = await (supabase as any)
        .from('inventario')
        .select('*, productos(*)')
        .eq('punto_id', puntoOrigen)
        .gt('cantidad', 0);

      if (data) setInventarioOrigen(data);
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredInventario = inventarioOrigen.filter(item =>
    item.productos.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleTraslado = async () => {
    if (!selectedProducto || !puntoOrigen || !puntoDestino || cantidad <= 0 || !user) {
      alert('Por favor completa todos los campos');
      return;
    }

    if (puntoOrigen === puntoDestino) {
      alert('El punto de origen y destino no pueden ser el mismo');
      return;
    }

    const itemOrigen = inventarioOrigen.find(i => i.producto_id === selectedProducto);
    if (!itemOrigen || itemOrigen.cantidad < cantidad) {
      alert('No hay suficiente stock en el punto de origen');
      return;
    }

    setProcessing(true);
    try {
      // Reducir cantidad en origen
      await (supabase as any)
        .from('inventario')
        .update({ cantidad: itemOrigen.cantidad - cantidad })
        .eq('id', itemOrigen.id);

      // Aumentar cantidad en destino
      const { data: existingDestino } = await (supabase as any)
        .from('inventario')
        .select('*')
        .eq('producto_id', selectedProducto)
        .eq('punto_id', puntoDestino)
        .maybeSingle();

      if (existingDestino) {
        await (supabase as any)
          .from('inventario')
          .update({ cantidad: existingDestino.cantidad + cantidad })
          .eq('id', existingDestino.id);
      } else {
        await (supabase as any)
          .from('inventario')
          .insert([{
            producto_id: selectedProducto,
            punto_id: puntoDestino,
            cantidad: cantidad,
            stock_minimo: 5
          }]);
      }

      // Registrar el traslado como una "venta" negativa en origen y "compra" en destino
      // Esto es opcional, podrías crear una tabla específica de traslados

      setSelectedProducto('');
      setCantidad(1);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      loadInventario();
    } catch (error) {
      console.error('Error processing transfer:', error);
      alert('Error al procesar el traslado');
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

  const selectedItem = inventarioOrigen.find(i => i.producto_id === selectedProducto);
  const puntosDisponibles = puntosAsignados.filter(p => p.id !== puntoOrigen);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Traslado de Inventario</h2>
        <p className="text-gray-600 mt-1">Mueve productos entre puntos de venta</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Punto de Origen
                </label>
                <select
                  value={puntoOrigen}
                  onChange={(e) => {
                    setPuntoOrigen(e.target.value);
                    setSelectedProducto('');
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  {puntosAsignados.map(punto => (
                    <option key={punto.id} value={punto.id}>{punto.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Punto de Destino
                </label>
                <select
                  value={puntoDestino}
                  onChange={(e) => setPuntoDestino(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">Seleccionar destino</option>
                  {puntosDisponibles.map(punto => (
                    <option key={punto.id} value={punto.id}>{punto.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

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

            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Inventario Disponible en Origen
            </h3>

            {loading ? (
              <p className="text-gray-500 text-center py-8">Cargando...</p>
            ) : filteredInventario.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                {searchTerm ? 'No se encontraron productos' : 'No hay productos disponibles'}
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredInventario.map(item => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedProducto(item.producto_id)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                      selectedProducto === item.producto_id
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-200 hover:border-teal-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="bg-teal-100 p-2 rounded-lg">
                          <Package className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{item.productos.nombre}</p>
                          <p className="text-sm text-gray-600">
                            {formatCurrency(item.productos.precio_venta)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-3 py-1 bg-gray-100 rounded-full text-sm font-medium text-gray-700">
                          Stock: {item.cantidad}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="bg-white rounded-xl shadow-md p-6 sticky top-6">
            <div className="flex items-center space-x-2 mb-6">
              <ArrowRightLeft className="w-6 h-6 text-teal-600" />
              <h3 className="text-xl font-bold text-gray-900">Realizar Traslado</h3>
            </div>

            {selectedItem ? (
              <div className="space-y-4">
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-teal-900 mb-1">Producto seleccionado:</p>
                  <p className="font-bold text-teal-900">{selectedItem.productos.nombre}</p>
                  <p className="text-sm text-teal-700 mt-2">
                    Disponible: {selectedItem.cantidad} unidades
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cantidad a trasladar
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={selectedItem.cantidad}
                    value={cantidad}
                    onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-center text-xl font-bold"
                  />
                </div>

                <button
                  onClick={handleTraslado}
                  disabled={processing || !puntoDestino || cantidad <= 0 || cantidad > selectedItem.cantidad}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  <Check className="w-5 h-5" />
                  <span>{processing ? 'Procesando...' : 'Confirmar Traslado'}</span>
                </button>

                {cantidad > selectedItem.cantidad && (
                  <p className="text-sm text-red-600 text-center">
                    La cantidad no puede ser mayor al stock disponible
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">Selecciona un producto para trasladar</p>
              </div>
            )}
          </div>

          {showSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3 mt-4">
              <Check className="w-5 h-5 text-green-600" />
              <p className="text-sm text-green-800 font-medium">Traslado realizado exitosamente</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}