import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Package, Search, Check, Calendar } from 'lucide-react';
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

interface Ajuste {
  id: string;
  tipo: 'cargo' | 'descargo';
  producto_id: string;
  punto_id: string;
  cantidad: number;
  motivo: string;
  observaciones: string;
  usuario_id: string;
  created_at: string;
}

export default function CargosDescargos() {
  const { user, puntosAsignados } = useAuth();
  const [inventario, setInventario] = useState<Inventario[]>([]);
  const [ajustes, setAjustes] = useState<any[]>([]);
  const [selectedPunto, setSelectedPunto] = useState<string>(puntosAsignados[0]?.id || '');
  const [selectedProducto, setSelectedProducto] = useState<string>('');
  const [tipo, setTipo] = useState<'cargo' | 'descargo'>('descargo');
  const [cantidad, setCantidad] = useState<number>(1);
  const [motivo, setMotivo] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const motivosCargo = [
    'Donación recibida',
    'Devolución de cliente',
    'Corrección de inventario',
    'Ajuste por conteo físico',
    'Producto encontrado',
    'Otro'
  ];

  const motivosDescargo = [
    'Producto dañado',
    'Producto vencido',
    'Merma',
    'Robo/Pérdida',
    'Donación entregada',
    'Muestra/Degustación',
    'Corrección de inventario',
    'Ajuste por conteo físico',
    'Otro'
  ];

  useEffect(() => {
    if (puntosAsignados.length > 0 && !selectedPunto) {
      setSelectedPunto(puntosAsignados[0].id);
    }
  }, [puntosAsignados]);

  useEffect(() => {
    if (selectedPunto) {
      loadInventario();
      loadAjustes();
    }
  }, [selectedPunto]);

  const loadInventario = async () => {
    try {
      setLoading(true);
      const { data } = await (supabase as any)
        .from('inventario')
        .select('*, productos(*)')
        .eq('punto_id', selectedPunto)
        .gt('cantidad', 0);

      if (data) setInventario(data);
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAjustes = async () => {
    try {
      const { data } = await (supabase as any)
        .from('ajustes_inventario')
        .select('*, productos(nombre), profiles(nombre)')
        .eq('punto_id', selectedPunto)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) setAjustes(data);
    } catch (error) {
      console.error('Error loading adjustments:', error);
    }
  };

  const filteredInventario = inventario.filter(item =>
    item.productos.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAjuste = async () => {
    if (!selectedProducto || !motivo || cantidad <= 0 || !user) {
      alert('Por favor completa todos los campos obligatorios');
      return;
    }

    const itemInventario = inventario.find(i => i.producto_id === selectedProducto);
    
    if (tipo === 'descargo') {
      if (!itemInventario || itemInventario.cantidad < cantidad) {
        alert('No hay suficiente stock para realizar el descargo');
        return;
      }
    }

    setProcessing(true);
    try {
      // Registrar el ajuste en la tabla de ajustes_inventario
      const { error: ajusteError } = await (supabase as any)
        .from('ajustes_inventario')
        .insert([{
          tipo,
          producto_id: selectedProducto,
          punto_id: selectedPunto,
          cantidad,
          motivo,
          observaciones,
          usuario_id: user.id
        }]);

      if (ajusteError) throw ajusteError;

      // Actualizar inventario
      if (itemInventario) {
        const nuevaCantidad = tipo === 'cargo' 
          ? itemInventario.cantidad + cantidad 
          : itemInventario.cantidad - cantidad;

        await (supabase as any)
          .from('inventario')
          .update({ cantidad: nuevaCantidad })
          .eq('id', itemInventario.id);
      } else if (tipo === 'cargo') {
        // Si es cargo y no existe el producto en inventario, crearlo
        await (supabase as any)
          .from('inventario')
          .insert([{
            producto_id: selectedProducto,
            punto_id: selectedPunto,
            cantidad: cantidad,
            stock_minimo: 5
          }]);
      }

      // Limpiar formulario
      setSelectedProducto('');
      setCantidad(1);
      setMotivo('');
      setObservaciones('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      
      loadInventario();
      loadAjustes();
    } catch (error) {
      console.error('Error processing adjustment:', error);
      alert('Error al procesar el ajuste');
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

  const selectedItem = inventario.find(i => i.producto_id === selectedProducto);
  const motivosDisponibles = tipo === 'cargo' ? motivosCargo : motivosDescargo;

  // Crear tabla de ajustes_inventario si no existe
  useEffect(() => {
    const createTable = async () => {
      await (supabase as any).rpc('create_ajustes_table');
    };
    createTable();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Cargos y Descargos</h2>
        <p className="text-gray-600 mt-1">Ajustes de inventario por mermas, daños, donaciones, etc.</p>
      </div>

      <div className="flex items-center space-x-2 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <Package className="w-5 h-5 text-blue-600 flex-shrink-0" />
        <p className="text-sm text-blue-800">
          <strong>Cargo:</strong> Aumenta el inventario (ej: devoluciones, correcciones). 
          <strong className="ml-3">Descargo:</strong> Reduce el inventario (ej: mermas, pérdidas, daños).
        </p>
      </div>

      {puntosAsignados.length > 1 && (
        <div className="bg-white rounded-xl shadow-md p-4">
          <select
            value={selectedPunto}
            onChange={(e) => {
              setSelectedPunto(e.target.value);
              setSelectedProducto('');
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            {puntosAsignados.map(punto => (
              <option key={punto.id} value={punto.id}>{punto.nombre}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
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

            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Productos Disponibles
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

          {/* Historial de ajustes */}
          <div className="bg-white rounded-xl shadow-md p-6 mt-6">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center justify-between w-full text-left mb-4"
            >
              <h3 className="text-lg font-semibold text-gray-900">
                Historial de Ajustes
              </h3>
              <Calendar className="w-5 h-5 text-gray-600" />
            </button>

            {showHistory && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {ajustes.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No hay ajustes registrados</p>
                ) : (
                  ajustes.map((ajuste: any) => (
                    <div key={ajuste.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-2">
                          {ajuste.tipo === 'cargo' ? (
                            <TrendingUp className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <TrendingDown className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p className="font-semibold text-gray-900">{ajuste.productos?.nombre}</p>
                            <p className="text-sm text-gray-600">{ajuste.motivo}</p>
                            {ajuste.observaciones && (
                              <p className="text-xs text-gray-500 mt-1">{ajuste.observaciones}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(ajuste.created_at).toLocaleString('es-CO')} - {ajuste.profiles?.nombre}
                            </p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-sm font-medium ${
                          ajuste.tipo === 'cargo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {ajuste.tipo === 'cargo' ? '+' : '-'}{ajuste.cantidad}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="bg-white rounded-xl shadow-md p-6 sticky top-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Registrar Ajuste</h3>

            {/* Selector de tipo */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => setTipo('cargo')}
                className={`p-3 rounded-lg border-2 transition ${
                  tipo === 'cargo'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-green-300'
                }`}
              >
                <TrendingUp className={`w-6 h-6 mx-auto mb-1 ${
                  tipo === 'cargo' ? 'text-green-600' : 'text-gray-400'
                }`} />
                <p className={`text-sm font-medium ${
                  tipo === 'cargo' ? 'text-green-900' : 'text-gray-600'
                }`}>
                  Cargo
                </p>
              </button>

              <button
                onClick={() => setTipo('descargo')}
                className={`p-3 rounded-lg border-2 transition ${
                  tipo === 'descargo'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 hover:border-red-300'
                }`}
              >
                <TrendingDown className={`w-6 h-6 mx-auto mb-1 ${
                  tipo === 'descargo' ? 'text-red-600' : 'text-gray-400'
                }`} />
                <p className={`text-sm font-medium ${
                  tipo === 'descargo' ? 'text-red-900' : 'text-gray-600'
                }`}>
                  Descargo
                </p>
              </button>
            </div>

            {selectedItem ? (
              <div className="space-y-4">
                <div className={`border-2 rounded-lg p-4 ${
                  tipo === 'cargo' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                }`}>
                  <p className="text-sm font-medium mb-1">Producto:</p>
                  <p className="font-bold">{selectedItem.productos.nombre}</p>
                  <p className="text-sm mt-2">
                    Stock actual: {selectedItem.cantidad} unidades
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cantidad *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={tipo === 'descargo' ? selectedItem.cantidad : undefined}
                    value={cantidad}
                    onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-center text-xl font-bold"
                  />
                  {tipo === 'descargo' && cantidad > selectedItem.cantidad && (
                    <p className="text-xs text-red-600 mt-1">
                      No puede ser mayor al stock actual
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Motivo *
                  </label>
                  <select
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="">Seleccionar motivo</option>
                    {motivosDisponibles.map(m => (
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    rows={3}
                    placeholder="Detalles adicionales (opcional)"
                  />
                </div>

                <button
                  onClick={handleAjuste}
                  disabled={processing || !motivo || cantidad <= 0 || (tipo === 'descargo' && cantidad > selectedItem.cantidad)}
                  className={`w-full font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 ${
                    tipo === 'cargo'
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  <Check className="w-5 h-5" />
                  <span>{processing ? 'Procesando...' : `Confirmar ${tipo === 'cargo' ? 'Cargo' : 'Descargo'}`}</span>
                </button>
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">Selecciona un producto para ajustar</p>
              </div>
            )}
          </div>

          {showSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3 mt-4">
              <Check className="w-5 h-5 text-green-600" />
              <p className="text-sm text-green-800 font-medium">Ajuste registrado exitosamente</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}