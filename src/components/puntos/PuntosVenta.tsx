import { useEffect, useState } from 'react';
import { Plus, Edit2, MapPin, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface PuntoVenta {
  id: string;
  nombre: string;
  direccion: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export default function PuntosVenta() {
  const [puntos, setPuntos] = useState<PuntoVenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPunto, setEditingPunto] = useState<PuntoVenta | null>(null);
  const [formData, setFormData] = useState({ nombre: '', direccion: '' });

  useEffect(() => {
    loadPuntos();
  }, []);

  const loadPuntos = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('puntos_venta')
      .select('*')
      .order('nombre');
    if (data) setPuntos(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingPunto) {
        const { error } = await (supabase as any)
          .from('puntos_venta')
          .update(formData)
          .eq('id', editingPunto.id);
        
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('puntos_venta')
          .insert(formData);
        
        if (error) throw error;
      }

      setShowModal(false);
      setEditingPunto(null);
      setFormData({ nombre: '', direccion: '' });
      loadPuntos();
    } catch (error) {
      console.error('Error saving punto:', error);
      alert('Error al guardar el punto de venta: ' + (error as Error).message);
    }
  };

  const handleEdit = (punto: PuntoVenta) => {
    setEditingPunto(punto);
    setFormData({ nombre: punto.nombre, direccion: punto.direccion });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este punto de venta?')) {
      try {
        const { error } = await (supabase as any)
          .from('puntos_venta')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        loadPuntos();
      } catch (error) {
        console.error('Error deleting punto:', error);
        alert('Error al eliminar el punto de venta');
      }
    }
  };

  const openNewModal = () => {
    setEditingPunto(null);
    setFormData({ nombre: '', direccion: '' });
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Puntos de Venta</h2>
          <p className="text-gray-600 mt-1">Gestiona tus ubicaciones de negocio</p>
        </div>
        <button
          onClick={openNewModal}
          className="flex items-center space-x-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition"
        >
          <Plus className="w-5 h-5" />
          <span>Nuevo Punto</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Cargando...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {puntos.map(punto => (
            <div key={punto.id} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-teal-100 p-3 rounded-lg">
                    <MapPin className="w-6 h-6 text-teal-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{punto.nombre}</h3>
                    {punto.direccion && (
                      <p className="text-sm text-gray-600 mt-1">{punto.direccion}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex space-x-2 mt-4 pt-4 border-t border-gray-100">
                <button
                  onClick={() => handleEdit(punto)}
                  className="flex-1 flex items-center justify-center space-x-2 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-lg transition text-sm"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Editar</span>
                </button>
                <button
                  onClick={() => handleDelete(punto.id)}
                  className="flex-1 flex items-center justify-center space-x-2 bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 rounded-lg transition text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              {editingPunto ? 'Editar Punto' : 'Nuevo Punto'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Punto
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dirección
                </label>
                <textarea
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  rows={3}
                />
              </div>
              <div className="flex space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition"
                >
                  {editingPunto ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}