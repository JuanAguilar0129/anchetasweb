import { useEffect, useState } from 'react';
import { Plus, User, MapPin, Trash2, X, Edit2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Profile {
  id: string;
  nombre: string;
  codigo_usuario: string;
  rol: 'admin_general' | 'admin_punto' | 'vendedor';
  activo: boolean;
  created_at: string;
  updated_at: string;
}

interface PuntoVenta {
  id: string;
  nombre: string;
  direccion: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

interface UserWithPuntos extends Profile {
  puntos: PuntoVenta[];
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<UserWithPuntos[]>([]);
  const [puntos, setPuntos] = useState<PuntoVenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithPuntos | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    codigo_usuario: '',
    password: '',
    rol: 'vendedor' as 'admin_general' | 'admin_punto' | 'vendedor',
    puntosSeleccionados: [] as string[]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const { data: puntosData } = await (supabase as any)
      .from('puntos_venta')
      .select('*')
      .order('nombre');

    if (puntosData) setPuntos(puntosData);

    const { data: profilesData } = await (supabase as any)
      .from('profiles')
      .select('*')
      .order('nombre');

    if (profilesData) {
      const usersWithPuntos = await Promise.all(
        profilesData.map(async (profile: any) => {
          const { data: userPuntos } = await (supabase as any)
            .from('usuarios_puntos')
            .select('punto_id')
            .eq('user_id', profile.id);

          if (userPuntos && userPuntos.length > 0) {
            const puntoIds = userPuntos.map((up: any) => up.punto_id);
            const { data: puntosData } = await (supabase as any)
              .from('puntos_venta')
              .select('*')
              .in('id', puntoIds);
            
            return { ...profile, puntos: puntosData || [] };
          }

          return { ...profile, puntos: [] };
        })
      );

      setUsuarios(usersWithPuntos);
    }

    setLoading(false);
  };

  const handleEdit = (usuario: UserWithPuntos) => {
    setEditingUser(usuario);
    setFormData({
      nombre: usuario.nombre,
      codigo_usuario: usuario.codigo_usuario,
      password: '',
      rol: usuario.rol,
      puntosSeleccionados: usuario.puntos.map(p => p.id)
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingUser) {
        // Actualizar usuario existente
        const updateData: any = {
          nombre: formData.nombre,
          codigo_usuario: formData.codigo_usuario,
          rol: formData.rol,
          activo: true
        };

        // Solo actualizar password si se proporcionó uno nuevo
        if (formData.password) {
          updateData.password = formData.password;
        }

        const { error: updateError } = await (supabase as any)
          .from('profiles')
          .update(updateData)
          .eq('id', editingUser.id);

        if (updateError) throw updateError;

        // Eliminar puntos antiguos
        await (supabase as any)
          .from('usuarios_puntos')
          .delete()
          .eq('user_id', editingUser.id);

        // Agregar nuevos puntos
        if (formData.puntosSeleccionados.length > 0) {
          const asignaciones = formData.puntosSeleccionados.map(puntoId => ({
            user_id: editingUser.id,
            punto_id: puntoId
          }));

          const { error: asignacionError } = await (supabase as any)
            .from('usuarios_puntos')
            .insert(asignaciones);

          if (asignacionError) throw asignacionError;
        }

        alert('Usuario actualizado exitosamente');
      } else {
        // Crear nuevo usuario
        const { data: newUser, error: profileError } = await (supabase as any)
          .from('profiles')
          .insert({
            nombre: formData.nombre,
            codigo_usuario: formData.codigo_usuario,
            rol: formData.rol,
            activo: true,
            password: formData.password
          })
          .select()
          .single();

        if (profileError) throw profileError;
        if (!newUser) throw new Error('No se pudo crear el usuario');

        // Asignar puntos de venta
        if (formData.puntosSeleccionados.length > 0) {
          const asignaciones = formData.puntosSeleccionados.map(puntoId => ({
            user_id: newUser.id,
            punto_id: puntoId
          }));

          const { error: asignacionError } = await (supabase as any)
            .from('usuarios_puntos')
            .insert(asignaciones);

          if (asignacionError) throw asignacionError;
        }

        alert('Usuario creado exitosamente');
      }

      // Limpiar y recargar
      setShowModal(false);
      setEditingUser(null);
      setFormData({
        nombre: '',
        codigo_usuario: '',
        password: '',
        rol: 'vendedor',
        puntosSeleccionados: []
      });
      
      loadData();
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Error al guardar usuario: ' + (error as Error).message);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;

    try {
      await (supabase as any).from('usuarios_puntos').delete().eq('user_id', userId);
      await (supabase as any).from('profiles').delete().eq('id', userId);
      alert('Usuario eliminado exitosamente');
      loadData();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error al eliminar usuario');
    }
  };

  const getRoleName = (rol: string) => {
    const roles = {
      admin_general: 'Administrador General',
      admin_punto: 'Administrador de Punto',
      vendedor: 'Vendedor'
    };
    return roles[rol as keyof typeof roles] || rol;
  };

  const getRolColor = (rol: string) => {
    const colors = {
      admin_general: 'bg-red-100 text-red-800',
      admin_punto: 'bg-blue-100 text-blue-800',
      vendedor: 'bg-green-100 text-green-800'
    };
    return colors[rol as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const togglePunto = (puntoId: string) => {
    setFormData(prev => ({
      ...prev,
      puntosSeleccionados: prev.puntosSeleccionados.includes(puntoId)
        ? prev.puntosSeleccionados.filter(id => id !== puntoId)
        : [...prev.puntosSeleccionados, puntoId]
    }));
  };

  const openNewModal = () => {
    setEditingUser(null);
    setFormData({
      nombre: '',
      codigo_usuario: '',
      password: '',
      rol: 'vendedor',
      puntosSeleccionados: []
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Usuarios</h2>
          <p className="text-gray-600 mt-1">Gestiona los usuarios del sistema</p>
        </div>
        <button
          onClick={openNewModal}
          className="flex items-center space-x-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition"
        >
          <Plus className="w-5 h-5" />
          <span>Nuevo Usuario</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Cargando...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {usuarios.map(usuario => (
            <div key={usuario.id} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-teal-100 p-3 rounded-lg">
                    <User className="w-6 h-6 text-teal-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{usuario.nombre}</h3>
                    <p className="text-sm text-gray-500">@{usuario.codigo_usuario}</p>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getRolColor(usuario.rol)}`}>
                  {getRoleName(usuario.rol)}
                </span>
              </div>

              {usuario.puntos.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Puntos asignados:</p>
                  <div className="space-y-1">
                    {usuario.puntos.map(punto => (
                      <div key={punto.id} className="flex items-center space-x-2 text-sm text-gray-600">
                        <MapPin className="w-3 h-3" />
                        <span>{punto.nombre}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(usuario)}
                  className="flex-1 flex items-center justify-center space-x-2 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-lg transition text-sm"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Editar</span>
                </button>
                <button
                  onClick={() => handleDeleteUser(usuario.id)}
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
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold text-gray-900">
                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre Completo</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Código de Usuario</label>
                <input
                  type="text"
                  value={formData.codigo_usuario}
                  onChange={(e) => setFormData({ ...formData, codigo_usuario: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  required
                  disabled={!!editingUser}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contraseña {editingUser && '(dejar vacío para mantener la actual)'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  required={!editingUser}
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rol</label>
                <select
                  value={formData.rol}
                  onChange={(e) => setFormData({ ...formData, rol: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="vendedor">Vendedor</option>
                  <option value="admin_punto">Administrador de Punto</option>
                  <option value="admin_general">Administrador General</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Puntos de Venta</label>
                <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {puntos.map(punto => (
                    <label key={punto.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.puntosSeleccionados.includes(punto.id)}
                        onChange={() => togglePunto(punto.id)}
                        className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                      />
                      <span className="text-sm text-gray-700">{punto.nombre}</span>
                    </label>
                  ))}
                </div>
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
                  {editingUser ? 'Actualizar' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}