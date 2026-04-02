import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import Admin from './admin';
import emailjs from '@emailjs/browser';

const EMAILJS_SERVICE_ID = 'service_thyqgmt';
const EMAILJS_TEMPLATE_ID = 'template_8oa2ic8';
const EMAILJS_PUBLIC_KEY = 'aVxKa83w3EQOULaoR';

const DEFAULT_SERVICES = [
  { name: 'Manicura clásica', duration: 30, price: 5000, description: 'Limado, cutícula y esmaltado clásico' },
  { name: 'Manicura gel', duration: 45, price: 7000, description: 'Esmaltado semipermanente de larga duración' },
  { name: 'Uñas acrílicas', duration: 90, price: 12000, description: 'Construcción completa en acrílico' },
  { name: 'Pedicura clásica', duration: 45, price: 6000, description: 'Limado, cutícula y esmaltado en pies' },
];

const SERVICE_IMAGES = {};
const SERVICE_IMAGE_POSITION = {};

function generateSlots() {
  const ranges = [
    { start: 9, startMin: 0, end: 13, endMin: 0 },
    { start: 15, startMin: 0, end: 20, endMin: 0 },
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
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState(1);
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showAdmin, setShowAdmin] = useState(() =>
    window.location.search.includes('admin') ||
    window.location.pathname.includes('admin') ||
    localStorage.getItem('admin_auth') === 'true'
  );
  const [dateError, setDateError] = useState('');

  const dateRef = useRef(null);
  const timeRef = useRef(null);
  const customerRef = useRef(null);

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
    if (step >= 2 && dateRef.current) {
      setTimeout(() => dateRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    }
  }, [selectedServiceId]);

  useEffect(() => {
    if (selectedDate && timeRef.current) {
      setTimeout(() => timeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (selectedTime && customerRef.current) {
      setTimeout(() => customerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    }
  }, [selectedTime]);

  const today = new Date().toISOString().split('T')[0];
  const selectedService = services.find(s => s.id === selectedServiceId) || null;

  function getOccupiedSlots(date) {
    const occupied = new Set();
    appointments
      .filter(a => a.date === date && (a.status === 'confirmado' || !a.status))
      .forEach(a => {
        const svc = services.find(s => s.id === a.serviceId);
        if (!svc) return;
        const idx = ALL_SLOTS.indexOf(a.time);
        if (idx === -1) return;
        const count = slotsNeeded(svc.duration);
        for (let i = 0; i < count; i++) {
          if (idx + i < ALL_SLOTS.length) occupied.add(ALL_SLOTS[idx + i]);
        }
      });
    return occupied;
  }

  function getAvailableSlots(date, service) {
    if (!date || !service) return [];
    const occupied = getOccupiedSlots(date);
    const needed = slotsNeeded(service.duration);
    return ALL_SLOTS.filter((_, idx) => {
      for (let i = 0; i < needed; i++) {
        if (idx + i >= ALL_SLOTS.length) return false;
        if (occupied.has(ALL_SLOTS[idx + i])) return false;
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
      status: 'confirmado',
      createdAt: new Date().toISOString(),
    };
    await addDoc(collection(db, 'appointments'), newAppt);

    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      client_name: name.trim(),
      client_phone: phone.trim(),
      service_name: selectedService.name,
      date: formatDateLong(selectedDate),
      time: selectedTime,
    }, EMAILJS_PUBLIC_KEY).catch(() => {});

    setShowConfirmation(true);
  }

  function resetForm() {
    setStep(1);
    setSelectedServiceId(null);
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
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  // ─── Confirmation Screen ───
  if (showConfirmation && selectedService) {
    return (
      <div className="min-h-screen bg-gray-950 p-4 animate-fadeIn">
        <div className="max-w-md mx-auto bg-gray-900 rounded-3xl shadow-2xl overflow-hidden mt-8 border-2 border-gray-700">
          <div className="bg-linear-to-br from-pink-500 via-pink-600 to-pink-700 p-8 text-white text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-white opacity-10"></div>
            <div className="w-24 h-24 bg-gray-950 rounded-full mx-auto mb-4 flex items-center justify-center shadow-xl relative z-10 p-2">
              <img src="/logo-april.png" alt="Logo" className="w-full h-full object-contain rounded-full" />
            </div>
            <h2 className="text-3xl font-black mb-2 relative z-10" style={{ fontFamily: "'Playfair Display', serif" }}>¡Turno Confirmado!</h2>
            <p className="text-pink-100 text-lg relative z-10 font-medium">Tu reserva fue registrada con éxito</p>
          </div>

          <div className="p-6 space-y-4">
            <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
              <p className="text-sm text-gray-400 mb-1 font-semibold">💅 Servicio</p>
              <p className="font-bold text-xl text-white">{selectedService.name}</p>
              <p className="text-pink-400 font-semibold text-lg">${selectedService.price.toLocaleString('es-AR')} • {selectedService.duration} min</p>
              {selectedService.description && (
                <p className="text-sm text-gray-400 mt-2">{selectedService.description}</p>
              )}
            </div>

            <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
              <p className="text-sm text-gray-400 mb-1 font-semibold">📅 Fecha y Hora</p>
              <p className="font-bold text-lg text-white capitalize">{formatDateLong(selectedDate)}</p>
              <p className="text-pink-400 font-bold text-xl">{selectedTime} hs</p>
            </div>

            <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
              <p className="text-sm text-gray-400 mb-1 font-semibold">👤 Cliente</p>
              <p className="font-bold text-lg text-white">{name}</p>
              <p className="text-gray-400 font-medium">{phone}</p>
            </div>

            <div className="bg-pink-500/10 border border-pink-500/30 rounded-2xl p-5">
              <p className="text-sm text-pink-200 leading-relaxed">
                <strong>⏰ Importante:</strong> Te esperamos 5 minutos antes de tu turno.
                Si necesitás cancelar, avisanos por WhatsApp con anticipación.
              </p>
            </div>

            <a
              href={`https://wa.me/5493625351595?text=${encodeURIComponent(`¡Hola April! Reservé un turno 💅\n\n✨ *${selectedService.name}*\n📅 ${formatDateLong(selectedDate)} a las *${selectedTime} hs*\n👤 ${name}\n📱 ${phone}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-3 bg-green-600 hover:bg-green-500 text-white py-5 rounded-2xl font-black text-xl transition-all shadow-lg hover:shadow-green-500/25"
            >
              💬 Enviar confirmación por WhatsApp
            </a>

            <button
              onClick={resetForm}
              className="w-full bg-linear-to-r from-pink-500 to-pink-600 text-white py-5 rounded-2xl font-black text-xl hover:from-pink-400 hover:to-pink-500 transition-all shadow-lg hover:shadow-pink-500/25"
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
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="bg-gray-900 text-white shadow-2xl sticky top-0 z-50 py-4 px-4 border-b border-pink-500/20">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <div
            className="bg-gray-950 rounded-2xl shadow-xl cursor-pointer hover:scale-105 transition-transform p-2"
            onClick={() => setShowAdmin(true)}
          >
            <img
              src="/logo-april.png"
              alt="Nails By April"
              className="w-12 h-12 object-contain rounded-xl"
            />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-pink-400" style={{ fontFamily: "'Playfair Display', serif" }}>
              Nails By April
            </h1>
            <p className="text-gray-400 font-medium text-sm">Reservá Tu Turno Online</p>
          </div>
        </div>
      </header>

      {/* Info bar */}
      <div className="bg-gray-900/80 border-b border-gray-800 px-4 py-3">
        <div className="max-w-lg mx-auto flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-pink-400">📍</span>
            <span className="font-medium text-gray-300">Julio A. Roca 43, Resistencia, Chaco</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-pink-400">📱</span>
            <a href="https://wa.me/5493625351595" target="_blank" rel="noopener noreferrer" className="font-medium text-gray-300 hover:text-green-400 transition-colors">
              3625-351595
            </a>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-pink-400">🕐</span>
            <span className="font-medium text-gray-300">Lun a Sáb • 9:00 - 13:00 hs</span>
          </div>
        </div>
      </div>

      <main className="max-w-lg mx-auto p-4 pb-12">
        {/* Step 1 */}
        <section className="mb-8">
          <h2 className="text-xl font-black mb-4 text-transparent bg-clip-text bg-linear-to-r from-pink-400 to-pink-600 flex items-center gap-2">
            <span className="bg-linear-to-r from-pink-500 to-pink-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shadow-lg">1</span>
            Elegí tu servicio
          </h2>
          <div className="space-y-3">
            {services.map(svc => (
              <button
                key={svc.id}
                onClick={() => { setSelectedServiceId(svc.id); setStep(2); setSelectedDate(''); setSelectedTime(''); }}
                className={`w-full text-left rounded-2xl transition-all transform overflow-hidden border-2 ${
                  selectedServiceId === svc.id
                    ? 'bg-linear-to-r from-pink-500/20 to-pink-600/10 border-pink-500 shadow-xl shadow-pink-500/10 scale-[1.02]'
                    : 'bg-gray-800 border-gray-700 hover:border-gray-600 hover:shadow-lg'
                }`}
              >
                {SERVICE_IMAGES[svc.name] && (
                  <div className="relative h-36 overflow-hidden">
                    <img
                      src={SERVICE_IMAGES[svc.name]}
                      alt={svc.name}
                      className="w-full h-full object-cover"
                      style={{ objectPosition: SERVICE_IMAGE_POSITION[svc.name] || 'center 40%' }}
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-gray-800 via-gray-800/30 to-transparent" />
                    {selectedServiceId === svc.id && <div className="absolute inset-0 bg-pink-500/10" />}
                  </div>
                )}
                <div className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-lg text-white">{svc.name}</h4>
                    <span className={`font-bold text-lg ${selectedServiceId === svc.id ? 'text-pink-300' : 'text-pink-400'}`}>
                      ${svc.price.toLocaleString('es-AR')}
                    </span>
                  </div>
                  {svc.description && (
                    <p className={`text-sm mb-2 ${selectedServiceId === svc.id ? 'text-pink-200/70' : 'text-gray-400'}`}>
                      {svc.description}
                    </p>
                  )}
                  <span className={`text-sm font-medium ${selectedServiceId === svc.id ? 'text-pink-300' : 'text-gray-500'}`}>
                    ⏱ {svc.duration} min
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Step 2 */}
        {step >= 2 && selectedService && (
          <section ref={dateRef} className="mb-8 scroll-mt-32 animate-fadeIn">
            <h2 className="text-xl font-black mb-4 text-transparent bg-clip-text bg-linear-to-r from-pink-400 to-pink-600 flex items-center gap-2">
              <span className="bg-linear-to-r from-pink-500 to-pink-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shadow-lg">2</span>
              Elegí fecha y hora
            </h2>

            <div className="bg-gray-800 rounded-2xl p-5 mb-4 border-2 border-gray-700 transition-all hover:border-gray-600">
              <label className="block text-sm font-bold text-pink-400 mb-3">📅 Fecha del turno</label>
              <input
                type="date"
                value={selectedDate}
                min={today}
                onChange={e => {
                  const d = new Date(e.target.value + 'T00:00:00');
                  if (d.getDay() === 0) {
                    setDateError('No trabajamos los domingos. Por favor elegí otro día.');
                    return;
                  }
                  setDateError('');
                  setSelectedDate(e.target.value);
                  setSelectedTime('');
                  setStep(3);
                }}
                className="w-full p-4 bg-gray-900 border-2 border-gray-600 rounded-xl text-pink-100 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/30 font-semibold text-lg transition-all"
              />
              {dateError && <p className="text-red-400 text-sm mt-2 font-medium">⚠️ {dateError}</p>}
            </div>

            {selectedDate && (
              <div ref={timeRef} className="bg-gray-800 rounded-2xl p-5 border-2 border-gray-700 scroll-mt-32 animate-fadeIn">
                <label className="block text-sm font-bold text-pink-400 mb-4">🕐 Horarios disponibles</label>
                {(() => {
                  const available = new Set(getAvailableSlots(selectedDate, selectedService));
                  const allFull = ALL_SLOTS.every(s => !available.has(s));
                  if (allFull) return <p className="text-gray-500 text-center py-4">No hay horarios disponibles para esta fecha.</p>;
                  return (
                    <div className="grid grid-cols-3 gap-3">
                      {ALL_SLOTS.map(slot => {
                        const isAvailable = available.has(slot);
                        const isSelected = selectedTime === slot;
                        return (
                          <button
                            key={slot}
                            disabled={!isAvailable}
                            onClick={() => { if (isAvailable) { setSelectedTime(slot); setStep(4); } }}
                            className={`p-3.5 rounded-xl font-bold text-base transition-all transform ${
                              isSelected
                                ? 'bg-linear-to-r from-pink-500 to-pink-600 text-white shadow-xl scale-105'
                                : isAvailable
                                  ? 'bg-gray-900 hover:bg-gray-700 text-gray-300 border border-gray-600 hover:border-pink-500/50 hover:scale-105'
                                  : 'bg-gray-900/40 text-gray-600 border border-gray-800 cursor-not-allowed line-through'
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
          </section>
        )}

        {/* Step 3 */}
        {step >= 4 && selectedTime && (
          <section ref={customerRef} className="mb-8 scroll-mt-32 animate-fadeIn">
            <h2 className="text-xl font-black mb-4 text-transparent bg-clip-text bg-linear-to-r from-pink-400 to-pink-600 flex items-center gap-2">
              <span className="bg-linear-to-r from-pink-500 to-pink-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shadow-lg">3</span>
              Tus datos
            </h2>
            <div className="bg-gray-800 rounded-2xl p-5 border-2 border-gray-700 space-y-4">
              <div>
                <label className="block text-sm font-bold text-pink-400 mb-2">Nombre completo</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: María García"
                  className="w-full p-4 bg-gray-900 border-2 border-gray-600 rounded-xl text-pink-100 placeholder-gray-500 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/30 text-lg transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-pink-400 mb-2">Teléfono / WhatsApp</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Ej: 3624-123456"
                  className="w-full p-4 bg-gray-900 border-2 border-gray-600 rounded-xl text-pink-100 placeholder-gray-500 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/30 text-lg transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-pink-400 mb-2">Correo electrónico</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Ej: maria@gmail.com"
                  className="w-full p-4 bg-gray-900 border-2 border-gray-600 rounded-xl text-pink-100 placeholder-gray-500 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/30 text-lg transition-all"
                />
                <p className="text-xs text-gray-600 mt-2">📧 Te enviaremos un recordatorio el día anterior a tu turno</p>
              </div>
            </div>
          </section>
        )}

        {/* Confirm Button */}
        {name.trim() && phone.trim() && email.trim() && selectedService && selectedDate && selectedTime && (
          <button
            onClick={handleConfirm}
            className="w-full bg-linear-to-r from-pink-500 via-pink-500 to-pink-600 text-white py-6 rounded-2xl font-black text-2xl shadow-2xl hover:from-pink-400 hover:to-pink-500 hover:scale-105 transition-all transform animate-fadeIn hover:shadow-pink-500/30"
          >
            💅 Confirmar Turno
          </button>
        )}
      </main>

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
