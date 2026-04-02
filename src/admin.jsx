import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from './firebase';

const ADMIN_PASSWORD = 'april2025';

function formatDateFull(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function generateSlots() {
  const ranges = [
    { start: 9, startMin: 30, end: 12, endMin: 30 },
    { start: 17, startMin: 30, end: 21, endMin: 0 },
  ];
  const slots = [];
  for (const range of ranges) {
    let h = range.start;
    let m = range.startMin;
    while (h < range.end || (h === range.end && m <= range.endMin)) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      m += 30;
      if (m >= 60) { m = 0; h++; }
    }
  }
  return slots;
}

const ALL_SLOTS = generateSlots();
const MORNING_SLOTS = ALL_SLOTS.filter(s => parseInt(s) < 13);
const AFTERNOON_SLOTS = ALL_SLOTS.filter(s => parseInt(s) >= 17);

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function slotsNeeded(durationMin) {
  return Math.ceil(durationMin / 30);
}

export default function Admin({ onBack }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('admin_auth') === 'true');
  const [password, setPassword] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [activeTab, setActiveTab] = useState('agenda');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedAppt, setSelectedAppt] = useState(null);

  // Service CRUD
  const [editService, setEditService] = useState(null);
  const [svcForm, setSvcForm] = useState({ name: '', duration: '', price: '', description: '' });

  // Promo state
  const [promoText, setPromoText] = useState('');
  const [selectedClients, setSelectedClients] = useState(new Set());

  // Clientes fieles
  const [firestoreClients, setFirestoreClients] = useState([]);
  const [showClientForm, setShowClientForm] = useState(false);
  const [clientForm, setClientForm] = useState({ name: '', phone: '' });
  const [fielSelected, setFielSelected] = useState(new Set());
  const [fielPromoText, setFielPromoText] = useState('');

  // Subscribe to appointments (real-time)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'appointments'), snapshot => {
      setAppointments(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // Subscribe to services (real-time)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'services'), snapshot => {
      setServices(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // Subscribe to clients (real-time)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'clients'), snapshot => {
      setFirestoreClients(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem('admin_auth', 'true');
      setIsAuthenticated(true);
    } else {
      alert('Contraseña incorrecta');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_auth');
    setIsAuthenticated(false);
    setPassword('');
    if (onBack) onBack();
  };

  const deleteAppointment = async (id) => {
    await deleteDoc(doc(db, 'appointments', id));
    setSelectedAppt(null);
  };

  const confirmAppointment = async (appt) => {
    await updateDoc(doc(db, 'appointments', appt.id), { status: 'confirmado' });
    setSelectedAppt(prev => prev?.id === appt.id ? { ...prev, status: 'confirmado' } : prev);
    const msg = `¡Hola ${appt.name}! ✅ Tu turno está *confirmado*.\n\n💅 *${appt.serviceName}*\n📅 ${formatDateFull(appt.date)} a las *${appt.time} hs*\n\nTe esperamos en Julio A. Roca 43. ¡Nos vemos! ✨ - Nails By April`;
    const cleanPhone = appt.phone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/549${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Appointments for the selected date
  const dayAppointments = appointments.filter(a => a.date === selectedDate);

  // Build a map: slot -> appointment (if any)
  function getSlotMap() {
    const map = {};
    dayAppointments.forEach(appt => {
      const idx = ALL_SLOTS.indexOf(appt.time);
      if (idx === -1) return;
      const count = slotsNeeded(appt.duration);
      for (let i = 0; i < count; i++) {
        if (idx + i < ALL_SLOTS.length) {
          map[ALL_SLOTS[idx + i]] = { appt, isStart: i === 0, span: count };
        }
      }
    });
    return map;
  }

  const slotMap = getSlotMap();

  // Stats
  const todayStr = new Date().toISOString().split('T')[0];
  const todayAppts = appointments.filter(a => a.date === todayStr);
  const weekAppts = appointments.filter(a => {
    const d = new Date(a.date + 'T00:00:00');
    const now = new Date();
    const weekFromNow = new Date();
    weekFromNow.setDate(now.getDate() + 7);
    return d >= now && d <= weekFromNow;
  });
  const todayRevenue = todayAppts.reduce((sum, a) => sum + (a.price || 0), 0);
  const tomorrowStr = shiftDate(todayStr, 1);
  const tomorrowAppts = appointments.filter(a => a.date === tomorrowStr).sort((a, b) => a.time.localeCompare(b.time));

  // Merge clients from appointments + Firestore clients collection
  const clientsMap = {};
  appointments.forEach(a => {
    const key = a.phone.replace(/[^0-9]/g, '');
    if (!clientsMap[key]) {
      clientsMap[key] = { name: a.name, phone: a.phone, visits: 0, lastDate: a.date, fiel: false, firestoreId: null };
    }
    clientsMap[key].visits++;
    if (a.date > clientsMap[key].lastDate) {
      clientsMap[key].lastDate = a.date;
      clientsMap[key].name = a.name;
    }
  });
  // Overlay fiel status and manual clients from Firestore
  firestoreClients.forEach(c => {
    const key = c.phone.replace(/[^0-9]/g, '');
    if (!clientsMap[key]) {
      clientsMap[key] = { name: c.name, phone: c.phone, visits: 0, lastDate: null, fiel: c.fiel || false, firestoreId: c.id };
    } else {
      clientsMap[key].fiel = c.fiel || false;
      clientsMap[key].firestoreId = c.id;
    }
  });
  const allClients = Object.values(clientsMap).sort((a, b) => b.visits - a.visits);
  const fielClients = allClients.filter(c => c.fiel);

  function toggleClient(phone) {
    setSelectedClients(prev => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  }

  function selectAllClients() {
    if (selectedClients.size === allClients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(allClients.map(c => c.phone)));
    }
  }

  async function addManualClient() {
    const name = clientForm.name.trim();
    const phone = clientForm.phone.trim().replace(/[^0-9]/g, '');
    if (!name || !phone) return;
    await addDoc(collection(db, 'clients'), { name, phone, fiel: true, source: 'manual', addedAt: new Date().toISOString() });
    setClientForm({ name: '', phone: '' });
    setShowClientForm(false);
  }

  async function toggleFiel(client) {
    if (client.firestoreId) {
      await updateDoc(doc(db, 'clients', client.firestoreId), { fiel: !client.fiel });
    } else {
      await addDoc(collection(db, 'clients'), {
        name: client.name,
        phone: client.phone.replace(/[^0-9]/g, ''),
        fiel: true,
        source: 'auto',
        addedAt: new Date().toISOString(),
      });
    }
  }

  function toggleFielSelected(phone) {
    setFielSelected(prev => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  }

  function selectAllFieles() {
    if (fielSelected.size === fielClients.length) {
      setFielSelected(new Set());
    } else {
      setFielSelected(new Set(fielClients.map(c => c.phone)));
    }
  }

  function sendBulkFieles() {
    const msg = fielPromoText.trim();
    if (!msg) { alert('Escribí el mensaje primero'); return; }
    const targets = fielClients.filter(c => fielSelected.has(c.phone));
    if (targets.length === 0) { alert('Seleccioná al menos un cliente fiel'); return; }
    if (!window.confirm(`Se abrirán ${targets.length} ventana(s) de WhatsApp. ¿Continuar?`)) return;
    targets.forEach((client, i) => {
      setTimeout(() => {
        const cleanPhone = client.phone.replace(/[^0-9]/g, '');
        window.open(`https://wa.me/549${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
      }, i * 800);
    });
  }

  function sendPromo(client) {
    const msg = promoText.trim() || '¡Hola! Tenemos promos especiales en Nails By April. ¡Te esperamos!';
    const cleanPhone = client.phone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/549${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function sendBulkPromo() {
    const msg = promoText.trim();
    if (!msg) { alert('Escribí el mensaje de la promo primero'); return; }
    const targets = allClients.filter(c => selectedClients.has(c.phone));
    if (targets.length === 0) { alert('Seleccioná al menos un cliente'); return; }
    if (!window.confirm(`Se abrirán ${targets.length} ventana(s) de WhatsApp. ¿Continuar?`)) return;
    targets.forEach((client, i) => {
      setTimeout(() => sendPromo(client), i * 800);
    });
  }

  // Service handlers
  function startEditService(svc) {
    setEditService(svc);
    setSvcForm({ name: svc.name, duration: String(svc.duration), price: String(svc.price), description: svc.description || '' });
  }

  async function saveService() {
    const n = svcForm.name.trim();
    const d = parseInt(svcForm.duration, 10);
    const p = parseInt(svcForm.price, 10);
    const desc = svcForm.description.trim();
    if (!n || isNaN(d) || isNaN(p) || d <= 0 || p <= 0) return;
    if (editService) {
      await updateDoc(doc(db, 'services', editService.id), { name: n, duration: d, price: p, description: desc });
    } else {
      await addDoc(collection(db, 'services'), { name: n, duration: d, price: p, description: desc });
    }
    setEditService(null);
    setSvcForm({ name: '', duration: '', price: '', description: '' });
  }

  async function deleteService(id) {
    if (window.confirm('¿Eliminar este servicio?')) {
      await deleteDoc(doc(db, 'services', id));
    }
  }

  // Render a time block (morning or afternoon)
  function renderTimeBlock(label, slots) {
    return (
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <div className="bg-gray-800 px-4 py-2 border-b border-gray-700">
          <h3 className="text-sm font-bold text-amber-400">{label}</h3>
        </div>
        <div className="divide-y divide-gray-800">
          {slots.map(slot => {
            const entry = slotMap[slot];
            const isOccupied = !!entry;
            const isStart = entry?.isStart;

            if (isOccupied && !isStart) {
              const isPending = entry.appt.status === 'pendiente';
              return (
                <div key={slot} className="flex items-stretch min-h-13">
                  <div className="w-16 shrink-0 flex items-center justify-center text-xs text-gray-600 font-mono border-r border-gray-800 bg-gray-950/50">
                    {slot}
                  </div>
                  <div
                    className={`flex-1 border-l-4 px-4 py-2 cursor-pointer transition-colors flex items-center ${isPending ? 'bg-blue-500/10 border-blue-500 hover:bg-blue-500/15' : 'bg-amber-500/10 border-amber-500 hover:bg-amber-500/15'}`}
                    onClick={() => setSelectedAppt(entry.appt)}
                  >
                    <span className={`text-xs italic ${isPending ? 'text-blue-400/60' : 'text-amber-400/60'}`}>— continúa</span>
                  </div>
                </div>
              );
            }

            if (isOccupied && isStart) {
              const isPending = entry.appt.status === 'pendiente';
              return (
                <div key={slot} className="flex items-stretch min-h-13">
                  <div className="w-16 shrink-0 flex items-center justify-center text-xs text-gray-400 font-mono border-r border-gray-800 bg-gray-950/50">
                    {slot}
                  </div>
                  <div
                    className={`flex-1 border-l-4 px-4 py-2 cursor-pointer transition-colors ${isPending ? 'bg-blue-500/10 border-blue-500 hover:bg-blue-500/20' : 'bg-amber-500/10 border-amber-500 hover:bg-amber-500/20'}`}
                    onClick={() => setSelectedAppt(entry.appt)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-white text-sm">{entry.appt.name}</span>
                        <span className="text-gray-400 text-xs ml-2">— {entry.appt.serviceName}</span>
                        {isPending && <span className="ml-2 text-xs font-bold text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded">⏳ Seña pendiente</span>}
                      </div>
                      <span className={`font-bold text-sm ${isPending ? 'text-blue-400' : 'text-amber-500'}`}>${entry.appt.price?.toLocaleString('es-AR')}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{entry.appt.duration} min • {entry.appt.phone}</div>
                  </div>
                </div>
              );
            }

            // Free slot
            return (
              <div key={slot} className="flex items-stretch min-h-13">
                <div className="w-16 shrink-0 flex items-center justify-center text-xs text-gray-600 font-mono border-r border-gray-800 bg-gray-950/50">
                  {slot}
                </div>
                <div className="flex-1 px-4 py-2 flex items-center">
                  <span className="text-xs text-gray-700">Disponible</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Login Screen ───
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 rounded-3xl shadow-2xl p-8 max-w-md w-full border-2 border-gray-700">
          <div className="text-center mb-8">
            <div className="bg-gray-950 w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center shadow-xl p-2">
              <img src="/logo-april.png" alt="Logo" className="w-full h-full object-contain rounded-full" />
            </div>
            <h1 className="text-3xl font-black text-white mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Panel de Admin</h1>
            <p className="text-gray-400">Nails By April</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="mb-6">
              <label className="block text-sm font-bold text-amber-400 mb-2">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Ingresá tu contraseña"
                className="w-full p-4 bg-gray-800 border-2 border-gray-600 rounded-xl text-amber-100 placeholder-gray-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-lg transition-all"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-linear-to-r from-amber-500 to-amber-600 text-gray-950 py-4 rounded-2xl font-bold text-lg hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg hover:shadow-amber-500/25"
            >
              Ingresar
            </button>
            {onBack && (
              <button type="button" onClick={onBack} className="w-full mt-3 text-gray-500 hover:text-gray-300 py-2 text-sm transition-colors">
                ← Volver a turnos
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  // ─── Admin Panel ───
  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24">
      {/* Header — solo título y salir */}
      <header className="bg-gray-900 border-b border-amber-500/20 px-4 py-3 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-gray-950 p-1.5 rounded-xl shadow-lg">
              <img src="/logo-april.png" alt="Logo" className="w-9 h-9 object-contain rounded-lg" />
            </div>
            <div>
              <h1 className="text-lg font-black text-amber-500" style={{ fontFamily: "'Playfair Display', serif" }}>Panel de Admin</h1>
              <p className="text-gray-500 text-xs">Nails By April</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} className="text-gray-400 hover:text-white text-sm transition-colors hidden sm:block">
                ← Volver
              </button>
            )}
            <button onClick={handleLogout} className="text-gray-400 hover:text-white text-sm transition-colors">
              Salir
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 sm:p-6">

      {/* Tabs desktop — ocultos en mobile */}
      <div className="hidden sm:flex bg-gray-800 rounded-xl p-1 gap-1 mb-6">
        <button onClick={() => setActiveTab('agenda')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'agenda' ? 'bg-amber-500 text-gray-950' : 'text-gray-400 hover:text-white'}`}>📅 Agenda</button>
        <button onClick={() => setActiveTab('recordatorios')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'recordatorios' ? 'bg-amber-500 text-gray-950' : 'text-gray-400 hover:text-white'}`}>
          🔔 Recordatorios
          {tomorrowAppts.length > 0 && <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{tomorrowAppts.length}</span>}
        </button>
        <button onClick={() => setActiveTab('turnos')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'turnos' ? 'bg-amber-500 text-gray-950' : 'text-gray-400 hover:text-white'}`}>📋 Turnos</button>
        <button onClick={() => setActiveTab('clientes')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'clientes' ? 'bg-amber-500 text-gray-950' : 'text-gray-400 hover:text-white'}`}>👥 Clientes</button>
        <button onClick={() => setActiveTab('servicios')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'servicios' ? 'bg-amber-500 text-gray-950' : 'text-gray-400 hover:text-white'}`}>✂️ Servicios</button>
      </div>
        {/* ─── AGENDA TAB ─── */}
        {activeTab === 'agenda' && (
          <div>
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Turnos hoy</p>
                <p className="text-3xl font-black text-white">{todayAppts.length}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Próximos 7 días</p>
                <p className="text-3xl font-black text-white">{weekAppts.length}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Facturación hoy</p>
                <p className="text-3xl font-black text-amber-500">${todayRevenue.toLocaleString('es-AR')}</p>
              </div>
            </div>

            {/* Date navigation */}
            <div className="flex items-center justify-between mb-6 bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <button
                onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
                className="bg-gray-800 hover:bg-gray-700 w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-colors"
              >
                ←
              </button>
              <div className="text-center flex-1">
                <p className="text-lg font-bold text-white capitalize">{formatDateFull(selectedDate)}</p>
                <p className="text-sm text-gray-500">
                  {dayAppointments.length} turno{dayAppointments.length !== 1 ? 's' : ''} reservado{dayAppointments.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
                className="bg-gray-800 hover:bg-gray-700 w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-colors"
              >
                →
              </button>
              <div className="ml-3">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-amber-100 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Agenda grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Timeline */}
              <div className="space-y-6">
                {renderTimeBlock('☀️ Mañana — 9:30 a 12:30', MORNING_SLOTS)}
                {renderTimeBlock('🌙 Tarde — 17:30 a 21:00', AFTERNOON_SLOTS)}
              </div>

              {/* Detail panel */}
              <div className="lg:sticky lg:top-20 lg:self-start">
                {selectedAppt ? (
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                    <div className="bg-linear-to-r from-amber-500 to-amber-600 p-5">
                      <h3 className="text-xl font-black text-gray-950">Detalle del turno</h3>
                      <p className="text-amber-900 text-sm font-medium">{selectedAppt.time} hs — {selectedAppt.duration} min</p>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Cliente</p>
                        <p className="text-xl font-bold text-white">{selectedAppt.name}</p>
                        <p className="text-gray-400 mt-1">📱 {selectedAppt.phone}</p>
                      </div>
                      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Servicio</p>
                        <p className="font-bold text-amber-400 text-lg">{selectedAppt.serviceName}</p>
                        <div className="flex gap-4 mt-1 text-sm text-gray-400">
                          <span className="font-semibold text-amber-500">${selectedAppt.price?.toLocaleString('es-AR')}</span>
                          <span>⏱ {selectedAppt.duration} min</span>
                        </div>
                      </div>
                      {selectedAppt.status === 'pendiente' && (
                        <button
                          onClick={() => confirmAppointment(selectedAppt)}
                          className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition-all mb-1"
                        >
                          ✅ Confirmar seña recibida
                        </button>
                      )}
                      <div className="flex gap-3">
                        <a
                          href={`https://wa.me/549${selectedAppt.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola ${selectedAppt.name}, te confirmamos tu turno del ${formatDateFull(selectedAppt.date)} a las ${selectedAppt.time} para ${selectedAppt.serviceName}. ¡Te esperamos! - Nails By April`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 bg-green-600 hover:bg-green-500 text-white text-center py-3 rounded-xl font-semibold transition-all"
                        >
                          💬 WhatsApp
                        </a>
                        <button
                          onClick={() => {
                            if (window.confirm(`¿Cancelar el turno de ${selectedAppt.name} a las ${selectedAppt.time}?`)) {
                              deleteAppointment(selectedAppt.id);
                            }
                          }}
                          className="bg-red-900/30 hover:bg-red-800/50 text-red-400 px-5 py-3 rounded-xl font-semibold transition-all"
                        >
                          🗑 Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
                    <div className="text-5xl mb-4">👈</div>
                    <p className="text-gray-400 font-semibold">Seleccioná un turno de la agenda</p>
                    <p className="text-gray-600 text-sm mt-2">Hacé clic en un turno para ver los detalles</p>
                  </div>
                )}

                {/* Day summary */}
                {dayAppointments.length > 0 && (
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mt-4">
                    <h4 className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-3">Resumen del día</h4>
                    <div className="space-y-2">
                      {dayAppointments
                        .sort((a, b) => a.time.localeCompare(b.time))
                        .map(appt => (
                          <div
                            key={appt.id}
                            onClick={() => setSelectedAppt(appt)}
                            className={`flex items-center justify-between py-2 px-3 rounded-xl cursor-pointer transition-all ${selectedAppt?.id === appt.id ? 'bg-amber-500/10 border border-amber-500/30' : 'hover:bg-gray-800'}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="bg-amber-500 text-gray-950 text-xs font-bold px-2 py-1 rounded-lg">{appt.time}</span>
                              <span className="text-sm font-semibold text-white">{appt.name}</span>
                            </div>
                            <span className="text-xs text-gray-500">{appt.serviceName}</span>
                          </div>
                        ))}
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-800 flex justify-between">
                      <span className="text-sm text-gray-400">Total del día</span>
                      <span className="text-amber-500 font-bold">${dayAppointments.reduce((s, a) => s + (a.price || 0), 0).toLocaleString('es-AR')}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── TURNOS TAB ─── */}
        {activeTab === 'turnos' && (() => {
          const today = new Date().toISOString().split('T')[0];
          const upcoming = appointments
            .filter(a => a.date >= today)
            .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

          // Agrupar por fecha
          const byDate = {};
          upcoming.forEach(a => {
            if (!byDate[a.date]) byDate[a.date] = [];
            byDate[a.date].push(a);
          });
          const dates = Object.keys(byDate).sort();

          return (
            <div className="max-w-3xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">📋 Turnos confirmados</h2>
                  <p className="text-gray-500 text-sm mt-1">{upcoming.length} turno{upcoming.length !== 1 ? 's' : ''} próximo{upcoming.length !== 1 ? 's' : ''}</p>
                </div>
              </div>

              {dates.length === 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
                  <div className="text-5xl mb-4">📭</div>
                  <p className="text-gray-400 font-semibold">No hay turnos próximos</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {dates.map(date => {
                    const isToday = date === today;
                    const isTomorrow = date === tomorrowStr;
                    const label = isToday ? '📍 Hoy' : isTomorrow ? '⏰ Mañana' : null;
                    const dayRevenue = byDate[date].reduce((s, a) => s + (a.price || 0), 0);
                    return (
                      <div key={date}>
                        {/* Encabezado de día */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-white capitalize">
                              {formatDateFull(date)}
                            </h3>
                            {label && (
                              <span className="text-xs font-bold bg-amber-500 text-gray-950 px-2 py-0.5 rounded-full">{label}</span>
                            )}
                          </div>
                          <span className="text-sm text-amber-500 font-semibold">${dayRevenue.toLocaleString('es-AR')}</span>
                        </div>

                        {/* Lista de turnos del día */}
                        <div className="space-y-2">
                          {byDate[date].map(appt => (
                            <div key={appt.id} className={`border rounded-xl p-4 flex items-center justify-between transition-all ${appt.status === 'pendiente' ? 'bg-blue-950/30 border-blue-500/30 hover:border-blue-500/50' : 'bg-gray-900 border-gray-800 hover:border-gray-700'}`}>
                              <div className="flex items-center gap-4">
                                <span className={`text-sm font-black px-3 py-1.5 rounded-lg shrink-0 ${appt.status === 'pendiente' ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500 text-gray-950'}`}>{appt.time}</span>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-bold text-white">{appt.name}</p>
                                    {appt.status === 'pendiente' && <span className="text-xs font-bold text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded">⏳ Seña pendiente</span>}
                                  </div>
                                  <p className={`text-sm ${appt.status === 'pendiente' ? 'text-blue-400' : 'text-amber-400'}`}>{appt.serviceName}</p>
                                  <p className="text-xs text-gray-500 mt-0.5">📱 {appt.phone}{appt.email ? ` • ✉️ ${appt.email}` : ''}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-3">
                                <span className={`font-bold text-sm hidden sm:block ${appt.status === 'pendiente' ? 'text-blue-400' : 'text-amber-500'}`}>${appt.price?.toLocaleString('es-AR')}</span>
                                {appt.status === 'pendiente' && (
                                  <button
                                    onClick={() => confirmAppointment(appt)}
                                    className="bg-blue-600/30 hover:bg-blue-600 text-blue-400 hover:text-white px-3 py-2 rounded-lg transition-all text-sm font-semibold"
                                  >
                                    ✅
                                  </button>
                                )}
                                <a
                                  href={`https://wa.me/549${appt.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola ${appt.name}, te confirmamos tu turno del ${formatDateFull(appt.date)} a las ${appt.time} para ${appt.serviceName}. ¡Te esperamos! - Nails By April`)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white px-3 py-2 rounded-lg transition-all text-sm"
                                >
                                  💬
                                </a>
                                <button
                                  onClick={() => {
                                    if (window.confirm(`¿Cancelar el turno de ${appt.name} a las ${appt.time}?`)) {
                                      deleteAppointment(appt.id);
                                    }
                                  }}
                                  className="bg-red-900/30 hover:bg-red-800/50 text-red-400 px-3 py-2 rounded-lg transition-all text-sm"
                                >
                                  🗑
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ─── SERVICIOS TAB ─── */}
        {activeTab === 'servicios' && (
          <div className="max-w-2xl">
            {/* Form */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
              <h2 className="text-lg font-bold mb-4 text-amber-400">
                {editService ? '✏️ Editar servicio' : '➕ Agregar servicio'}
              </h2>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Nombre del servicio"
                  value={svcForm.name}
                  onChange={e => setSvcForm({ ...svcForm, name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-amber-100 placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-all"
                />
                <input
                  type="text"
                  placeholder="Descripción"
                  value={svcForm.description}
                  onChange={e => setSvcForm({ ...svcForm, description: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-amber-100 placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-all"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Duración (min)"
                    value={svcForm.duration}
                    onChange={e => setSvcForm({ ...svcForm, duration: e.target.value })}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-amber-100 placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-all"
                  />
                  <input
                    type="number"
                    placeholder="Precio ($)"
                    value={svcForm.price}
                    onChange={e => setSvcForm({ ...svcForm, price: e.target.value })}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-amber-100 placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-all"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveService} className="flex-1 bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 font-bold py-3 rounded-xl transition-all shadow-lg">
                    {editService ? 'Guardar cambios' : 'Agregar servicio'}
                  </button>
                  {editService && (
                    <button onClick={() => { setEditService(null); setSvcForm({ name: '', duration: '', price: '', description: '' }); }} className="px-5 bg-gray-700 hover:bg-gray-600 rounded-xl transition-all text-gray-300">
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* List */}
            <div className="space-y-3">
              {services.map(svc => (
                <div key={svc.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center justify-between hover:border-gray-700 transition-all">
                  <div>
                    <p className="font-bold text-white">{svc.name}</p>
                    {svc.description && <p className="text-sm text-gray-400">{svc.description}</p>}
                    <p className="text-sm text-amber-500 font-semibold mt-1">{svc.duration} min — ${svc.price.toLocaleString('es-AR')}</p>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-3">
                    <button onClick={() => startEditService(svc)} className="bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg transition-all text-gray-300 text-sm">
                      ✏️ Editar
                    </button>
                    <button onClick={() => deleteService(svc.id)} className="bg-red-900/30 hover:bg-red-800/50 text-red-400 px-3 py-2 rounded-lg transition-all text-sm">
                      🗑
                    </button>
                  </div>
                </div>
              ))}
              {services.length === 0 && (
                <p className="text-center text-gray-500 py-8">No hay servicios. Agregá uno arriba.</p>
              )}
            </div>
          </div>
        )}

        {/* ─── RECORDATORIOS TAB ─── */}
        {activeTab === 'recordatorios' && (
          <div className="max-w-2xl">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white mb-1">🔔 Recordatorios de mañana</h2>
              <p className="text-gray-500 text-sm">Turnos del {formatDateFull(tomorrowStr)} — Enviá recordatorio por WhatsApp con un clic</p>
            </div>

            {tomorrowAppts.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
                <div className="text-5xl mb-4">✅</div>
                <p className="text-gray-400 font-semibold text-lg">No hay turnos para mañana</p>
                <p className="text-gray-600 text-sm mt-2">No hay recordatorios pendientes</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tomorrowAppts.map(appt => (
                  <div key={appt.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="bg-amber-500 text-gray-950 text-sm font-bold px-3 py-1 rounded-full">{appt.time}</span>
                          <span className="text-white font-bold text-lg">{appt.name}</span>
                        </div>
                        <p className="text-gray-400 text-sm">📱 {appt.phone}</p>
                        <div className="bg-gray-800 rounded-xl p-3 mt-3 border border-gray-700">
                          <p className="font-semibold text-amber-400">{appt.serviceName}</p>
                          <p className="text-sm text-gray-500">${appt.price?.toLocaleString('es-AR')} • {appt.duration} min</p>
                        </div>
                      </div>
                      <a
                        href={`https://wa.me/549${appt.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`¡Hola ${appt.name}! Te recordamos que mañana tenés turno a las ${appt.time} para ${appt.serviceName}. Te esperamos en Julio A. Roca 43. ¡Nos vemos! 💅 - Nails By April`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-green-600 hover:bg-green-500 text-white px-4 py-3 rounded-xl font-semibold transition-all text-sm shrink-0"
                      >
                        💬 Enviar recordatorio
                      </a>
                    </div>
                  </div>
                ))}

                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mt-4">
                  <p className="text-amber-200 text-sm">
                    <strong>💡 Tip:</strong> Revisá esta sección todas las tardes para recordarle a los clientes del día siguiente.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── CLIENTES TAB ─── */}
        {activeTab === 'clientes' && (
          <div className="max-w-3xl">

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-white">👥 {allClients.length} cliente{allClients.length !== 1 ? 's' : ''}</h2>
              <button
                onClick={() => setShowClientForm(v => !v)}
                className="bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold px-4 py-2 rounded-xl text-sm transition-all"
              >
                {showClientForm ? '✕ Cancelar' : '+ Agregar cliente'}
              </button>
            </div>

            {/* Form agregar cliente */}
            {showClientForm && (
              <div className="bg-gray-900 border border-amber-500/30 rounded-2xl p-5 mb-6">
                <h3 className="text-base font-bold text-amber-400 mb-4">Nuevo cliente</h3>
                <div className="flex gap-3 flex-col sm:flex-row">
                  <input
                    type="text"
                    placeholder="Nombre completo"
                    value={clientForm.name}
                    onChange={e => setClientForm(f => ({ ...f, name: e.target.value }))}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-amber-100 placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-all"
                  />
                  <input
                    type="tel"
                    placeholder="Teléfono (solo números)"
                    value={clientForm.phone}
                    onChange={e => setClientForm(f => ({ ...f, phone: e.target.value }))}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-amber-100 placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-all"
                  />
                  <button
                    onClick={addManualClient}
                    disabled={!clientForm.name.trim() || !clientForm.phone.trim()}
                    className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-gray-950 font-bold px-6 py-3 rounded-xl transition-all"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            )}

            {/* ─── Grid dos columnas ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Columna izquierda: Clientes fieles */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">⭐</span>
                  <h3 className="text-base font-bold text-amber-400">Clientes fieles ({fielClients.length})</h3>
                </div>

                {/* Promo para fieles */}
                <div className="bg-gray-900 border border-amber-500/20 rounded-2xl p-4 mb-4">
                  <textarea
                    value={fielPromoText}
                    onChange={e => setFielPromoText(e.target.value)}
                    placeholder="Mensaje exclusivo para tus clientes fieles..."
                    rows={3}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-amber-100 placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-all resize-none mb-3"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <button onClick={selectAllFieles} className="text-xs text-gray-400 hover:text-amber-400 transition-colors">
                      {fielSelected.size === fielClients.length ? '✅ Deselec. todos' : `☑️ Todos (${fielClients.length})`}
                    </button>
                    <button onClick={sendBulkFieles} className="bg-amber-500 hover:bg-amber-400 text-gray-950 px-4 py-2 rounded-xl font-semibold transition-all text-xs">
                      ⭐ Enviar a {fielSelected.size}
                    </button>
                  </div>
                </div>

                {fielClients.length === 0 ? (
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center">
                    <p className="text-4xl mb-2">⭐</p>
                    <p className="text-gray-500 text-sm">Marcá un cliente como fiel para verlo acá</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {fielClients.map(client => {
                      const isSelected = fielSelected.has(client.phone);
                      return (
                        <div
                          key={client.phone}
                          onClick={() => toggleFielSelected(client.phone)}
                          className={`bg-gray-900 border rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all ${isSelected ? 'border-amber-500/50 bg-amber-500/5' : 'border-gray-800 hover:border-gray-700'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-amber-500 border-amber-500' : 'border-gray-600'}`}>
                              {isSelected && <span className="text-gray-950 text-xs font-bold">✓</span>}
                            </div>
                            <div>
                              <p className="font-bold text-white text-sm">{client.name} ⭐</p>
                              <p className="text-gray-500 text-xs">📱 {client.phone}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={e => { e.stopPropagation(); toggleFiel(client); }} className="bg-amber-500/20 hover:bg-red-900/40 text-amber-400 hover:text-red-400 px-2 py-1.5 rounded-lg transition-all text-xs font-semibold">✕</button>
                            <button onClick={e => { e.stopPropagation(); sendPromo(client); }} className="bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white px-2 py-1.5 rounded-lg transition-all text-sm">💬</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Columna derecha: Todos los clientes */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">👥</span>
                  <h3 className="text-base font-bold text-gray-300">Todos los clientes ({allClients.length})</h3>
                </div>

                {/* Promo general */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
                  <textarea
                    value={promoText}
                    onChange={e => setPromoText(e.target.value)}
                    placeholder="Mensaje para todos los clientes..."
                    rows={3}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-amber-100 placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-all resize-none mb-3"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <button onClick={selectAllClients} className="text-xs text-gray-400 hover:text-amber-400 transition-colors">
                      {selectedClients.size === allClients.length ? '✅ Deselec. todos' : `☑️ Todos (${allClients.length})`}
                    </button>
                    <button onClick={sendBulkPromo} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-xl font-semibold transition-all text-xs">
                      💬 Enviar a {selectedClients.size}
                    </button>
                  </div>
                </div>

                {allClients.length === 0 ? (
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center">
                    <p className="text-4xl mb-2">👥</p>
                    <p className="text-gray-500 text-sm">Los clientes aparecerán cuando reserven turnos</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allClients.map(client => {
                      const isSelected = selectedClients.has(client.phone);
                      return (
                        <div
                          key={client.phone}
                          onClick={() => toggleClient(client.phone)}
                          className={`bg-gray-900 border rounded-xl p-3 flex items-center justify-between transition-all cursor-pointer ${isSelected ? 'border-amber-500/50 bg-amber-500/5' : 'border-gray-800 hover:border-gray-700'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-amber-500 border-amber-500' : 'border-gray-600'}`}>
                              {isSelected && <span className="text-gray-950 text-xs font-bold">✓</span>}
                            </div>
                            <div>
                              <p className="font-bold text-white text-sm">{client.name}{client.fiel && ' ⭐'}</p>
                              <p className="text-gray-500 text-xs">📱 {client.phone} • {client.visits} visita{client.visits !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={e => { e.stopPropagation(); toggleFiel(client); }}
                              className={`px-2 py-1.5 rounded-lg transition-all text-xs font-semibold ${client.fiel ? 'bg-amber-500/20 text-amber-400 hover:bg-red-900/40 hover:text-red-400' : 'bg-gray-800 text-gray-500 hover:bg-amber-500/20 hover:text-amber-400'}`}
                            >
                              ⭐
                            </button>
                            <button onClick={e => { e.stopPropagation(); sendPromo(client); }} className="bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white px-2 py-1.5 rounded-lg transition-all text-sm">💬</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </div>

      {/* ─── Bottom nav mobile ─── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-50">
        <div className="flex">
          <button onClick={() => setActiveTab('agenda')} className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs font-semibold transition-all ${activeTab === 'agenda' ? 'text-amber-500' : 'text-gray-500'}`}>
            <span className="text-xl">📅</span>
            Agenda
          </button>
          <button onClick={() => setActiveTab('recordatorios')} className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs font-semibold transition-all relative ${activeTab === 'recordatorios' ? 'text-amber-500' : 'text-gray-500'}`}>
            <span className="text-xl">🔔</span>
            Recordatorios
            {tomorrowAppts.length > 0 && <span className="absolute top-2 right-4 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">{tomorrowAppts.length}</span>}
          </button>
          <button onClick={() => setActiveTab('turnos')} className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs font-semibold transition-all ${activeTab === 'turnos' ? 'text-amber-500' : 'text-gray-500'}`}>
            <span className="text-xl">📋</span>
            Turnos
          </button>
          <button onClick={() => setActiveTab('clientes')} className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs font-semibold transition-all ${activeTab === 'clientes' ? 'text-amber-500' : 'text-gray-500'}`}>
            <span className="text-xl">👥</span>
            Clientes
          </button>
          <button onClick={() => setActiveTab('servicios')} className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs font-semibold transition-all ${activeTab === 'servicios' ? 'text-amber-500' : 'text-gray-500'}`}>
            <span className="text-xl">✂️</span>
            Servicios
          </button>
        </div>
      </nav>
    </div>
  );
}
