import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Ban, Trash2, Plus, Loader2 } from 'lucide-react';
import { db } from './firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, Timestamp } from 'firebase/firestore';

export default function HorariosManager() {
  const [bloqueados, setBloqueados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    tipo: 'dia_completo',
    fecha: '',
    hora: '',
    motivo: ''
  });

  const allTimeSlots = [
    '09:00', '10:00', '11:00', '12:00',
    '14:00', '15:00', '16:00', '17:00', '18:00'
  ];

  const loadBloqueados = async () => {
    setLoading(true);
    try {
      const bloqueadosRef = collection(db, 'horarios_bloqueados');
      const querySnapshot = await getDocs(bloqueadosRef);

      const data = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });

      // Ordenar por fecha
      data.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

      setBloqueados(data);
    } catch (error) {
      console.error('Error al cargar bloqueados:', error);
      alert('Error al cargar horarios bloqueados');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadBloqueados();
  }, []);

  const handleBloquearDiaCompleto = async (e) => {
    e.preventDefault();
    
    if (!formData.fecha) {
      alert('Por favor elegí una fecha');
      return;
    }

    // Verificar si ya hay turnos confirmados ese día
    const turnosRef = collection(db, 'turnos');
    const q = query(turnosRef, where('fecha', '==', formData.fecha));
    const turnosSnapshot = await getDocs(q);

    if (!turnosSnapshot.empty) {
      const confirmar = window.confirm(
        `Hay ${turnosSnapshot.size} turno(s) confirmado(s) para este día. ¿Querés bloquear el día de todas formas? Los turnos existentes NO se cancelarán automáticamente.`
      );
      if (!confirmar) return;
    }

    try {
      await addDoc(collection(db, 'horarios_bloqueados'), {
        tipo: 'dia_completo',
        fecha: formData.fecha,
        motivo: formData.motivo || 'Día no laborable',
        createdAt: Timestamp.now()
      });

      alert('Día bloqueado exitosamente');
      setShowForm(false);
      setFormData({ tipo: 'dia_completo', fecha: '', hora: '', motivo: '' });
      loadBloqueados();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al bloquear el día');
    }
  };

  const handleBloquearHorario = async (e) => {
    e.preventDefault();
    
    if (!formData.fecha || !formData.hora) {
      alert('Por favor elegí fecha y horario');
      return;
    }

    // Verificar si ya hay un turno confirmado en ese horario
    const turnosRef = collection(db, 'turnos');
    const q = query(
      turnosRef,
      where('fecha', '==', formData.fecha),
      where('hora', '==', formData.hora)
    );
    const turnosSnapshot = await getDocs(q);

    if (!turnosSnapshot.empty) {
      alert('Ya hay un turno confirmado en ese horario. Cancelá el turno primero.');
      return;
    }

    try {
      await addDoc(collection(db, 'horarios_bloqueados'), {
        tipo: 'horario_especifico',
        fecha: formData.fecha,
        hora: formData.hora,
        motivo: formData.motivo || 'Horario no disponible',
        createdAt: Timestamp.now()
      });

      alert('Horario bloqueado exitosamente');
      setShowForm(false);
      setFormData({ tipo: 'dia_completo', fecha: '', hora: '', motivo: '' });
      loadBloqueados();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al bloquear el horario');
    }
  };

  const handleDesbloquear = async (bloqueoId) => {
    if (window.confirm('¿Segura que querés desbloquear este día/horario?')) {
      try {
        await deleteDoc(doc(db, 'horarios_bloqueados', bloqueoId));
        alert('Desbloqueado exitosamente');
        loadBloqueados();
      } catch (error) {
        console.error('Error:', error);
        alert('Error al desbloquear');
      }
    }
  };

  const today = new Date().toISOString().split('T')[0];

  // Agrupar bloqueados por fecha
  const bloqueosPorFecha = bloqueados.reduce((acc, bloqueo) => {
    if (!acc[bloqueo.fecha]) {
      acc[bloqueo.fecha] = [];
    }
    acc[bloqueo.fecha].push(bloqueo);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-purple-200 mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
              <Ban className="text-purple-600" size={28} />
              Gestión de Horarios
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              Bloqueá días completos o horarios específicos
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-gradient-to-r from-purple-600 to-pink-400 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 hover:shadow-lg transition-all"
          >
            <Plus size={20} />
            Bloquear
          </button>
        </div>

        {/* Formulario de bloqueo */}
        {showForm && (
          <div className="bg-purple-50 rounded-2xl p-5 border-2 border-purple-200 mb-6">
            <h3 className="font-bold text-lg mb-4">Bloquear horarios</h3>
            
            {/* Selector de tipo */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                ¿Qué querés bloquear?
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, tipo: 'dia_completo', hora: '' })}
                  className={`flex-1 p-4 rounded-xl font-semibold transition-all ${
                    formData.tipo === 'dia_completo'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-gray-700 border-2 border-gray-300'
                  }`}
                >
                  <Calendar className="mx-auto mb-2" size={24} />
                  Día completo
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, tipo: 'horario_especifico' })}
                  className={`flex-1 p-4 rounded-xl font-semibold transition-all ${
                    formData.tipo === 'horario_especifico'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-gray-700 border-2 border-gray-300'
                  }`}
                >
                  <Clock className="mx-auto mb-2" size={24} />
                  Horario específico
                </button>
              </div>
            </div>

            {/* Fecha */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Fecha
              </label>
              <input
                type="date"
                value={formData.fecha}
                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                min={today}
                className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none text-lg"
              />
            </div>

            {/* Horario (solo si es específico) */}
            {formData.tipo === 'horario_especifico' && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Horario
                </label>
                <select
                  value={formData.hora}
                  onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
                  className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none text-lg"
                >
                  <option value="">Seleccioná un horario</option>
                  {allTimeSlots.map((time) => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Motivo */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Motivo (opcional)
              </label>
              <input
                type="text"
                value={formData.motivo}
                onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                placeholder="Ej: Vacaciones, Evento personal"
                className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none"
              />
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                onClick={formData.tipo === 'dia_completo' ? handleBloquearDiaCompleto : handleBloquearHorario}
                className="flex-1 bg-purple-600 text-white py-3 rounded-xl font-semibold hover:bg-purple-700 transition-all"
              >
                Bloquear
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setFormData({ tipo: 'dia_completo', fecha: '', hora: '', motivo: '' });
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-400 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lista de bloqueados */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-purple-200">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          Horarios bloqueados ({bloqueados.length})
        </h3>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-purple-600" size={48} />
          </div>
        ) : bloqueados.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <Ban className="mx-auto mb-3 text-gray-400" size={48} />
            <p>No hay horarios bloqueados</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(bloqueosPorFecha).map(([fecha, bloqueos]) => (
              <div key={fecha} className="border-2 border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="text-purple-600" size={20} />
                  <h4 className="font-bold text-lg">
                    {new Date(fecha + 'T00:00:00').toLocaleDateString('es-AR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </h4>
                </div>

                <div className="space-y-2">
                  {bloqueos.map((bloqueo) => (
                    <div
                      key={bloqueo.id}
                      className="flex items-center justify-between bg-gray-50 p-3 rounded-xl"
                    >
                      <div>
                        {bloqueo.tipo === 'dia_completo' ? (
                          <div className="flex items-center gap-2">
                            <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                              DÍA COMPLETO
                            </span>
                            {bloqueo.motivo && (
                              <span className="text-gray-600 text-sm">
                                {bloqueo.motivo}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                              {bloqueo.hora}
                            </span>
                            {bloqueo.motivo && (
                              <span className="text-gray-600 text-sm">
                                {bloqueo.motivo}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleDesbloquear(bloqueo.id)}
                        className="bg-red-100 hover:bg-red-200 text-red-600 p-2 rounded-lg transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}