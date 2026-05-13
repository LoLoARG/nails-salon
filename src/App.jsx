import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import emailjs from '@emailjs/browser';
import Admin from './admin';

const DEFAULT_SERVICES = [
  { name: 'Semipermanente', duration: 60, price: 16000, description: 'Esmaltado semipermanente en manos', isExtra: false },
  { name: 'Semi en pies', duration: 60, price: 13000, description: 'Esmaltado semipermanente en pies', isExtra: false },
  { name: 'Soft Gel', duration: 90, price: 18000, description: 'Construcción en soft gel', isExtra: false },
  { name: 'Kapping Gel', duration: 90, price: 18000, description: 'Kapping de gel sobre uña natural', isExtra: false },
  { name: 'Extensión por una', duration: 15, price: 300, description: 'Reparación o extensión de una uña', isExtra: true },
  { name: 'Retirado', duration: 30, price: 5000, description: 'Retiro de gel o semipermanente', isExtra: true },
  { name: 'Diseño por una', duration: 15, price: 200, description: 'Diseño nail art en una uña', isExtra: true },
  { name: 'Deco extra', duration: 15, price: 200, description: 'Decoración extra (precio desde $200)', isExtra: true },
];


const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

const DEFAULT_SLOTS = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30'];
const DEFAULT_HORARIOS = {
  lunes:     { enabled: true,  slots: [...DEFAULT_SLOTS] },
  martes:    { enabled: true,  slots: [...DEFAULT_SLOTS] },
  miercoles: { enabled: true,  slots: [...DEFAULT_SLOTS] },
  jueves:    { enabled: true,  slots: [...DEFAULT_SLOTS] },
  viernes:   { enabled: true,  slots: [...DEFAULT_SLOTS] },
  sabado:    { enabled: true,  slots: [...DEFAULT_SLOTS] },
  domingo:   { enabled: false, slots: [] },
};

function getDaySlots(dateStr, horariosConfig) {
  if (!dateStr) return [];
  const dayName = DAY_NAMES[new Date(dateStr + 'T00:00:00').getDay()];
  const cfg = horariosConfig[dayName];
  if (!cfg || !cfg.enabled) return [];
  return cfg.slots || [];
}

function formatDateLong(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function slotsNeeded(durationMin) {
  return Math.ceil(durationMin / 30);
}

export default function App() {
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [horariosConfig, setHorariosConfig] = useState(DEFAULT_HORARIOS);
  const [loading, setLoading] = useState(true);

  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [showExtras, setShowExtras] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [savedApptId, setSavedApptId] = useState(null);
  const [showAdmin, setShowAdmin] = useState(() =>
    window.location.search.includes('admin') ||
    window.location.pathname.includes('admin') ||
    localStorage.getItem('admin_auth') === 'true'
  );
  const [dateError, setDateError] = useState('');

  const extrasRef = useRef(null);
  const formRef = useRef(null);
  const datosRef = useRef(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'services'), async snapshot => {
      if (snapshot.empty) {
        for (const svc of DEFAULT_SERVICES) {
          await addDoc(collection(db, 'services'), svc);
        }
      } else {
        setServices(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'appointments'), snapshot => {
      setAppointments(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'horarios_config'), snapshot => {
      if (!snapshot.empty) {
        const config = { ...DEFAULT_HORARIOS };
        snapshot.docs.forEach(d => { config[d.id] = d.data(); });
        setHorariosConfig(config);
      }
    });
    return unsub;
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const selectedService = services.find(s => s.id === selectedServiceId) || null;

  function getOccupiedSlots(date, daySlots) {
    const occupied = new Set();
    appointments
      .filter(a => a.date === date)
      .forEach(a => {
        const svc = services.find(s => s.id === a.serviceId);
        if (!svc) return;
        const idx = daySlots.indexOf(a.time);
        if (idx === -1) return;
        const count = slotsNeeded(svc.duration);
        for (let i = 0; i < count; i++) {
          if (idx + i < daySlots.length) occupied.add(daySlots[idx + i]);
        }
      });
    return occupied;
  }

  function getAvailableSlots(date, service, daySlots) {
    if (!date || !service || daySlots.length === 0) return [];
    const occupied = getOccupiedSlots(date, daySlots);
    const needed = slotsNeeded(service.duration);
    return daySlots.filter((_, idx) => {
      for (let i = 0; i < needed; i++) {
        if (idx + i >= daySlots.length) return false;
        if (occupied.has(daySlots[idx + i])) return false;
      }
      return true;
    });
  }

  async function handleConfirm() {
    if (!selectedService || !selectedDate || !selectedTime || !name.trim() || !phone.trim() || !email.trim()) return;
    const newAppt = {
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      price: selectedService.price,
      duration: selectedService.duration,
      date: selectedDate,
      time: selectedTime,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      status: 'pendiente_pago',
      createdAt: new Date().toISOString(),
    };
    const docRef = await addDoc(collection(db, 'appointments'), newAppt);
    setSavedApptId(docRef.id);

    // Notificar a April del nuevo turno
    emailjs.send(
      'service_thyqgmt',
      'template_r5qj0e8',
      {
        client_name: name.trim(),
        client_phone: phone.trim(),
        service_name: selectedService.name,
        date: selectedDate,
        time: selectedTime,
        status: '⏳ Pendiente de pago (seña)',
      },
      { publicKey: 'aVxKa83w3EQOULaoR' }
    ).catch(() => {}); // no bloquear el flujo si falla el email

    setShowConfirmation(true);
  }

  async function handlePayWithMP() {
    if (!selectedService) return;
    if (window.location.hostname === 'localhost') {
      alert('El pago con Mercado Pago solo funciona en producción. ¡Subí el sitio a Netlify para probarlo!');
      return;
    }
    setConfirming(true);
    try {
      const res = await fetch('/.netlify/functions/create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedService.id,
          serviceName: selectedService.name,
          date: selectedDate,
          time: selectedTime,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          appointmentId: savedApptId,
        }),
      });
      const { init_point } = await res.json();
      window.location.assign(init_point);
    } catch {
      setConfirming(false);
      alert('Error al conectar con Mercado Pago. Intentá de nuevo.');
    }
  }

  function resetForm() {
    setSelectedServiceId(null);
    setShowExtras(false);
    setShowForm(false);
    setSelectedDate('');
    setSelectedTime('');
    setName('');
    setPhone('');
    setEmail('');
    setShowConfirmation(false);
  }

  if (showAdmin) {
    return <Admin onBack={() => setShowAdmin(false)} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  // ─── Confirmation Screen ───
  if (showConfirmation && selectedService) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-white p-4 animate-fadeIn">
        <div className="max-w-md mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden mt-8 border border-purple-100">
          <div className="bg-gradient-to-br from-purple-600 via-purple-500 to-pink-500 p-8 text-white text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-white opacity-10"></div>
            <div className="w-24 h-24 bg-white rounded-full mx-auto mb-4 flex items-center justify-center shadow-xl relative z-10 p-2">
              <img src="/logo.jpg" alt="Logo" className="w-full h-full object-contain rounded-full" />
            </div>
            <h2 className="text-3xl font-black mb-2 relative z-10" style={{ fontFamily: "'Playfair Display', serif" }}>¡Turno Confirmado!</h2>
            <p className="text-purple-100 text-lg relative z-10 font-medium">Tu reserva fue registrada con éxito</p>
          </div>

          <div className="p-6 space-y-4">
            <div className="bg-purple-50 rounded-2xl p-5 border border-purple-100">
              <p className="text-sm text-purple-400 mb-1 font-semibold">💅 Servicio</p>
              <p className="font-bold text-xl text-gray-900">{selectedService.name}</p>
              <p className="text-purple-600 font-semibold text-lg">${selectedService.price.toLocaleString('es-AR')} • {selectedService.duration} min</p>
              {selectedService.description && (
                <p className="text-sm text-gray-500 mt-2">{selectedService.description}</p>
              )}
            </div>

            <div className="bg-pink-50 rounded-2xl p-5 border border-pink-100">
              <p className="text-sm text-pink-400 mb-1 font-semibold">📅 Fecha y Hora</p>
              <p className="font-bold text-lg text-gray-900 capitalize">{formatDateLong(selectedDate)}</p>
              <p className="text-pink-500 font-bold text-xl">{selectedTime} hs</p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
              <p className="text-sm text-gray-400 mb-1 font-semibold">👤 Cliente</p>
              <p className="font-bold text-lg text-gray-900">{name}</p>
              <p className="text-gray-500 font-medium">{phone}</p>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5">
              <p className="text-sm text-purple-700 leading-relaxed">
                <strong>⏰ Importante:</strong> Te esperamos 5 minutos antes de tu turno.
                Si necesitás cancelar, avisanos por WhatsApp con anticipación.
              </p>
            </div>

            <button
              onClick={handlePayWithMP}
              disabled={confirming}
              className="w-full flex items-center justify-center gap-3 bg-blue-500 hover:bg-blue-400 disabled:opacity-60 text-white py-5 rounded-2xl font-black text-xl transition-all shadow-lg"
            >
              {confirming ? '⏳ Redirigiendo...' : '💳 Pagar seña con Mercado Pago'}
            </button>

            <button
              onClick={resetForm}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white py-5 rounded-2xl font-black text-xl hover:from-purple-500 hover:to-pink-400 transition-all shadow-lg"
            >
              💅 Volver al menú
            </button>
          </div>
        </div>

        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeIn { animation: fadeIn 0.5s ease-out; }
        `}</style>
      </div>
    );
  }

  // ─── Main App ───
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-50 py-4 px-4 border-b border-purple-100">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <div
            className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl shadow-md cursor-pointer hover:scale-105 transition-transform p-2"
            onClick={() => setShowAdmin(true)}
          >
            <img
              src="/logo.jpg"
              alt="Nails By April"
              className="w-12 h-12 object-contain rounded-xl"
            />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500" style={{ fontFamily: "'Playfair Display', serif" }}>
              Nails By April
            </h1>
            <p className="text-gray-500 font-medium text-sm">Reservá Tu Turno Online</p>
          </div>
        </div>
      </header>

      {/* Info bar */}
      <div className="bg-white/60 border-b border-purple-100 px-4 py-3">
        <div className="max-w-lg mx-auto flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-purple-500">📍</span>
            <span className="font-medium text-gray-600">Julio A. Roca 43, Resistencia, Chaco</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-purple-500">📱</span>
            <a href="https://wa.me/5493625351595" target="_blank" rel="noopener noreferrer" className="font-medium text-gray-600 hover:text-green-600 transition-colors">
              3625-351595
            </a>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-purple-500">🕐</span>
            <span className="font-medium text-gray-600">Lun a Sáb • 9:00 - 13:00 hs</span>
          </div>
        </div>
      </div>

      <main className="max-w-lg mx-auto p-4 pb-12">

        {/* 1 — Servicios */}
        <section className="mb-6">
          <h2 className="text-xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500 flex items-center gap-2">
            <span className="bg-gradient-to-r from-purple-600 to-pink-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shadow-lg">1</span>
            Elegí tu servicio
          </h2>
          <div className="space-y-3">
            {services.filter(s => !s.isExtra).map(svc => (
              <button
                key={svc.id}
                onClick={() => {
                  setSelectedServiceId(svc.id);
                  setSelectedDate(''); setSelectedTime('');
                  if (!showExtras) {
                    setShowExtras(true);
                    setTimeout(() => extrasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                  }
                }}
                className={`w-full text-left rounded-2xl transition-all transform border-2 ${
                  selectedServiceId === svc.id
                    ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-400 shadow-lg shadow-purple-100 scale-[1.02]'
                    : 'bg-white border-gray-200 hover:border-purple-200 hover:shadow-md'
                }`}
              >
                <div className="p-5">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold text-lg text-gray-900">{svc.name}</h4>
                    <span className={`font-bold text-lg ${selectedServiceId === svc.id ? 'text-purple-600' : 'text-pink-500'}`}>${svc.price.toLocaleString('es-AR')}</span>
                  </div>
                  {svc.description && <p className={`text-sm mb-2 ${selectedServiceId === svc.id ? 'text-purple-700/70' : 'text-gray-500'}`}>{svc.description}</p>}
                  <span className={`text-sm font-medium ${selectedServiceId === svc.id ? 'text-purple-500' : 'text-gray-400'}`}>⏱ {svc.duration} min</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* 2 — Extras */}
        {showExtras && services.filter(s => s.isExtra).length > 0 && (
          <section ref={extrasRef} className="mb-6 scroll-mt-24 animate-fadeIn">
            <h2 className="text-xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500 flex items-center gap-2">
              <span className="bg-gradient-to-r from-purple-600 to-pink-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shadow-lg">2</span>
              Extras
            </h2>
            <div className="space-y-3 mb-4">
              {services.filter(s => s.isExtra).map(svc => (
                <button
                  key={svc.id}
                  onClick={() => {
                    setSelectedServiceId(svc.id);
                    setSelectedDate(''); setSelectedTime('');
                    if (!showForm) {
                      setShowForm(true);
                      setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                    }
                  }}
                  className={`w-full text-left rounded-2xl transition-all transform border-2 ${
                    selectedServiceId === svc.id
                      ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-400 shadow-lg shadow-purple-100 scale-[1.02]'
                      : 'bg-white border-gray-200 hover:border-purple-200 hover:shadow-md'
                  }`}
                >
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold text-lg text-gray-900">{svc.name}</h4>
                      <span className={`font-bold text-lg ${selectedServiceId === svc.id ? 'text-purple-600' : 'text-pink-500'}`}>${svc.price.toLocaleString('es-AR')}</span>
                    </div>
                    {svc.description && <p className={`text-sm mb-2 ${selectedServiceId === svc.id ? 'text-purple-700/70' : 'text-gray-500'}`}>{svc.description}</p>}
                    <span className={`text-sm font-medium ${selectedServiceId === svc.id ? 'text-purple-500' : 'text-gray-400'}`}>⏱ {svc.duration} min</span>
                  </div>
                </button>
              ))}
            </div>
            {!showForm && (
              <button
                onClick={() => {
                  setShowForm(true);
                  setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                }}
                className="w-full py-3 rounded-2xl border-2 border-purple-300 text-purple-600 font-semibold hover:bg-purple-50 transition-all"
              >
                Continuar sin extras →
              </button>
            )}
          </section>
        )}

        {/* 3 — Formulario */}
        {showForm && (
          <section ref={formRef} className="mb-8 scroll-mt-24 animate-fadeIn">
            <h2 className="text-xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500 flex items-center gap-2">
              <span className="bg-gradient-to-r from-purple-600 to-pink-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shadow-lg">3</span>
              Tu turno
            </h2>

            <div className="bg-white rounded-2xl p-5 mb-4 border border-gray-200 shadow-sm">
              <label className="block text-sm font-bold text-purple-600 mb-3">📅 Fecha del turno</label>
              <input
                type="date"
                value={selectedDate}
                min={today}
                onChange={e => {
                  const dayName = DAY_NAMES[new Date(e.target.value + 'T00:00:00').getDay()];
                  if (!horariosConfig[dayName]?.enabled) {
                    setDateError('April no trabaja ese día. Por favor elegí otro día.');
                    setSelectedDate(''); setSelectedTime('');
                    return;
                  }
                  setDateError('');
                  setSelectedDate(e.target.value);
                  setSelectedTime('');
                }}
                className="w-full p-4 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-semibold text-lg transition-all"
              />
              {dateError && <p className="text-red-500 text-sm mt-2 font-medium">⚠️ {dateError}</p>}
            </div>

            {selectedDate && (
              <div className="bg-white rounded-2xl p-5 mb-4 border border-gray-200 shadow-sm animate-fadeIn">
                <label className="block text-sm font-bold text-purple-600 mb-4">🕐 Horarios disponibles</label>
                {(() => {
                  const daySlots = getDaySlots(selectedDate, horariosConfig);
                  const available = new Set(getAvailableSlots(selectedDate, selectedService, daySlots));
                  if (daySlots.length === 0 || daySlots.every(s => !available.has(s)))
                    return <p className="text-gray-400 text-center py-4">No hay horarios disponibles para esta fecha.</p>;
                  return (
                    <div className="grid grid-cols-3 gap-3">
                      {daySlots.map(slot => {
                        const isAvailable = available.has(slot);
                        const isSelected = selectedTime === slot;
                        return (
                          <button
                            key={slot}
                            disabled={!isAvailable}
                            onClick={() => { if (isAvailable) { setSelectedTime(slot); setTimeout(() => datosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); } }}
                            className={`p-3.5 rounded-xl font-bold text-base transition-all transform ${
                              isSelected
                                ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-lg scale-105'
                                : isAvailable
                                  ? 'bg-gray-50 hover:bg-purple-50 text-gray-700 border border-gray-200 hover:border-purple-300 hover:scale-105'
                                  : 'bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed line-through'
                            }`}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            <div ref={datosRef} className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4 scroll-mt-24">
              <div>
                <label className="block text-sm font-bold text-purple-600 mb-2">Nombre completo</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: María García"
                  className="w-full p-4 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-lg transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-purple-600 mb-2">Teléfono / WhatsApp</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Ej: 3624-123456"
                  className="w-full p-4 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-lg transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-purple-600 mb-2">Correo electrónico</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Ej: maria@gmail.com"
                  className="w-full p-4 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-lg transition-all"
                />
              </div>
            </div>
          </section>
        )}

        {/* Confirmar */}
        {name.trim() && phone.trim() && email.trim() && selectedService && selectedDate && selectedTime && (
          <button
            onClick={handleConfirm}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white py-6 rounded-2xl font-black text-2xl shadow-2xl hover:from-purple-500 hover:to-pink-400 hover:scale-105 transition-all transform animate-fadeIn"
          >
            💳 Confirmar turno con una seña
          </button>
        )}
      </main>

      <footer className="text-center py-6 text-sm text-gray-400">
        Desarrollado por{' '}
        <a
          href="https://www.instagram.com/codelo.web"
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-500 hover:text-pink-500 font-semibold transition-colors"
        >
          CodeLo
        </a>
      </footer>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.5s ease-out; }
      `}</style>
    </div>
  );
}
