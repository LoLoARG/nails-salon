import React, { useState, useEffect } from 'react';
import { Calendar, Trash2, LogOut, Loader2, RefreshCw, Filter, ArrowLeft } from 'lucide-react';
import { db } from './firebase';
import { collection, query, orderBy, getDocs, deleteDoc, doc, where } from 'firebase/firestore';
import HorariosManager from './HorariosManager';

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterDate, setFilterDate] = useState('all');
  const [customDate, setCustomDate] = useState('');
  const [activeTab, setActiveTab] = useState('turnos');

  const ADMIN_PASSWORD = 'april2025';

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      loadTurnos();
    } else {
      alert('Contraseña incorrecta');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword('');
    setTurnos([]);
  };

  const loadTurnos = async () => {
    setLoading(true);
    try {
      const turnosRef = collection(db, 'turnos');
      let q;

      if (filterDate === 'all') {
        q = query(turnosRef, orderBy('timestamp', 'desc'));
      } else if (filterDate === 'today') {
        const today = new Date().toISOString().split('T')[0];
        q = query(turnosRef, where('fecha', '==', today), orderBy('hora'));
      } else if (filterDate === 'custom' && customDate) {
        q = query(turnosRef, where('fecha', '==', customDate), orderBy('hora'));
      } else {
        q = query(turnosRef, orderBy('timestamp', 'desc'));
      }

      const querySnapshot = await getDocs(q);
      const turnosData = [];
      querySnapshot.forEach((doc) => {
        turnosData.push({ id: doc.id, ...doc.data() });
      });
      setTurnos(turnosData);
    } catch (error) {
      console.error('Error al cargar turnos:', error);
      alert('Error al cargar los turnos');
    }
    setLoading(false);
  };

  const handleDeleteTurno = async (turnoId, clienteNombre, hora) => {
    if (window.confirm(`¿Segura que querés cancelar el turno de ${clienteNombre} a las ${hora}?`)) {
      try {
        await deleteDoc(doc(db, 'turnos', turnoId));
        alert('Turno cancelado exitosamente');
        loadTurnos();
      } catch (error) {
        console.error('Error al cancelar turno:', error);
        alert('Error al cancelar el turno');
      }
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadTurnos();
    }
  }, [filterDate, customDate]);

  const today = new Date().toISOString().split('T')[0];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full border-4 border-purple-200">
          <div className="text-center mb-8">
            <div className="bg-gradient-to-br from-purple-600 to-pink-400 w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center shadow-xl p-4">
              <img 
                src="/logo-april.jpg" 
                alt="April Logo" 
                className="w-full h-full object-contain rounded-full"
              />
            </div>
            <h1 className="text-3xl font-black text-gray-800 mb-2">Panel de Admin</h1>
            <p className="text-gray-600">Nails by April</p>
          </div>

          <div>
            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin(e)}
                placeholder="Ingresá tu contraseña"
                className="w-full p-4 border-3 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none focus:ring-4 focus:ring-purple-200 text-lg"
              />
            </div>

            <button
              onClick={handleLogin}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-400 text-white py-4 rounded-2xl font-bold text-lg hover:shadow-xl transition-all"
            >
              Ingresar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-600 via-purple-500 to-pink-400 text-white p-6 shadow-2xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-white p-2 rounded-xl shadow-lg">
                <img 
                  src="/logo-april.jpg" 
                  alt="April Logo" 
                  className="w-10 h-10 object-contain"
                />
              </div>
              <div>
                <h1 className="text-2xl font-black">Panel de Admin</h1>
                <p className="text-purple-100 text-sm">Nails by April</p>
              </div>
            </div>
            <div className="flex gap-2">
            <button
              onClick={() => window.location.href = '/'}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-xl flex items-center gap-2 transition-all"
            >
              <ArrowLeft size={18} />
              <span className="hidden sm:inline">Volver a turnos</span>
            </button>
            
            <button
              onClick={handleLogout}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-xl flex items-center gap-2 transition-all"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Salir</span>
            </button>
            </div>
            </div>

          {/* Filtros */}
          <div className="bg-white bg-opacity-10 backdrop-blur-sm p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <Filter size={18} />
              <span className="font-semibold text-sm">Filtrar turnos:</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                onClick={() => setFilterDate('all')}
                className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                  filterDate === 'all'
                    ? 'bg-white text-purple-600'
                    : 'bg-white bg-opacity-20 hover:bg-opacity-30'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterDate('today')}
                className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                  filterDate === 'today'
                    ? 'bg-white text-purple-600'
                    : 'bg-white bg-opacity-20 hover:bg-opacity-30'
                }`}
              >
                Hoy
              </button>
              <button
                onClick={() => setFilterDate('custom')}
                className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                  filterDate === 'custom'
                    ? 'bg-white text-purple-600'
                    : 'bg-white bg-opacity-20 hover:bg-opacity-30'
                }`}
              >
                Fecha específica
              </button>
            </div>

            {filterDate === 'custom' && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                min={today}
                className="w-full p-3 rounded-xl border-2 border-white bg-white bg-opacity-90 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-white"
              />
            )}

            <button
              onClick={loadTurnos}
              className="w-full mt-3 bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-all font-semibold"
            >
              <RefreshCw size={18} />
              Actualizar
            </button>

            {/* Pestañas */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setActiveTab('turnos')}
                className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                  activeTab === 'turnos'
                    ? 'bg-white text-purple-600'
                    : 'bg-white bg-opacity-20 hover:bg-opacity-30 text-white'
                }`}
              >
                📅 Turnos
              </button>
              <button
                onClick={() => setActiveTab('horarios')}
                className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                  activeTab === 'horarios'
                    ? 'bg-white text-purple-600'
                    : 'bg-white bg-opacity-20 hover:bg-opacity-30 text-white'
                }`}
              >
                🚫 Horarios Bloqueados
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido según pestaña */}
      {activeTab === 'turnos' ? (
        <div className="max-w-4xl mx-auto p-4 pb-8">
          <div className="mb-4 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">
              {turnos.length} turno{turnos.length !== 1 ? 's' : ''} encontrado{turnos.length !== 1 ? 's' : ''}
            </h2>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="animate-spin text-purple-600" size={48} />
            </div>
          ) : turnos.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center shadow-lg border-2 border-purple-200">
              <Calendar className="mx-auto text-gray-400 mb-4" size={64} />
              <p className="text-gray-600 text-lg font-semibold">No hay turnos para mostrar</p>
              <p className="text-gray-400 text-sm mt-2">Los turnos reservados aparecerán aquí</p>
            </div>
          ) : (
            <div className="space-y-3">
              {turnos.map((turno) => (
                <div
                  key={turno.id}
                  className="bg-white rounded-2xl p-5 shadow-lg border-2 border-purple-200 hover:border-purple-300 transition-all"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-gradient-to-r from-purple-600 to-pink-400 text-white px-3 py-1 rounded-full text-sm font-bold">
                          {turno.hora}
                        </span>
                        <span className="text-gray-600 text-sm font-semibold">
                          {new Date(turno.fecha + 'T00:00:00').toLocaleDateString('es-AR', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                      <h3 className="font-bold text-lg text-gray-800">{turno.clienteNombre}</h3>
                      <p className="text-gray-600 text-sm">📱 {turno.clienteTelefono}</p>
                    </div>

                    <button
                      onClick={() => handleDeleteTurno(turno.id, turno.clienteNombre, turno.hora)}
                      className="bg-red-100 hover:bg-red-200 text-red-600 p-3 rounded-xl transition-all"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>

                  <div className="bg-purple-50 rounded-xl p-3 mt-3 border border-purple-100">
                    <p className="font-semibold text-purple-900">{turno.servicio}</p>
                    <div className="flex gap-4 text-sm text-purple-700 mt-1">
                      <span className="font-semibold">{turno.precio}</span>
                      <span>⏱ {turno.duracion}</span>
                    </div>
                  </div>

                  <a
                    href={`https://wa.me/549${turno.clienteTelefono.replace(/[^0-9]/g, '')}?text=Hola ${turno.clienteNombre}, te confirmo tu turno del ${new Date(turno.fecha + 'T00:00:00').toLocaleDateString('es-AR')} a las ${turno.hora} para ${turno.servicio}.`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full mt-3 bg-green-500 hover:bg-green-600 text-white text-center py-2 rounded-xl font-semibold transition-all shadow-md"
                  >
                    💬 Contactar cliente
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <HorariosManager />
      )}
    </div>
  );
}