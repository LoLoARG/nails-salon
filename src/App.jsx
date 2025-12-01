  import React, { useState, useEffect, useRef } from 'react';
  import { Calendar, Clock, ChevronRight, Phone, MapPin, Sparkles, MessageCircle, Loader2 } from 'lucide-react';
  import { db } from './firebase';
  import { collection, addDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';
  import PaymentStep from './PaymentStep';
  import Admin from './admin';
  import Bio from './Bio';

  export default function NailSalonBooking() {
    const [selectedService, setSelectedService] = useState(null);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTime, setSelectedTime] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [bookedSlots, setBookedSlots] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showAdmin, setShowAdmin] = useState(false);
    const [showPayment, setShowPayment] = useState(false);
    const [pendingTurnoData, setPendingTurnoData] = useState(null);
    const [showBio, setShowBio] = useState(false);


    const dateRef = useRef(null);
    const timeRef = useRef(null);
    const customerRef = useRef(null);

    const services = [
      {
        id: 1,
        category: 'LISTA DE PRECIOS',
        items: [
          {
            name: 'Semipermanentes',
            price: '$14.000',
            duration: '60 min',
            description: 'Esmaltado gel UV de larga duración',
            image: '/semipermanentes.jpg'
          },
          {
            name: 'Kapping Gel',
            price: '$16.000',
            duration: '90 min',
            description: 'Refuerzo de uña natural con gel',
            image: '/kapping.jpg'
          },
          {
            name: 'Soft Gel',
            price: '$16.000',
            duration: '90 min',
            description: 'Sistema de uñas suaves y flexibles',
            image: '/softgel.jpg'
          },
          {
            name: 'Arreglo por Uña',
            price: '$300',
            duration: '15 min',
            description: 'Reparación individual de uña',
            image: '/arreglo.jpg'
          },
          {
            name: 'Retirado de Otro Salón',
            price: '$3.000 - $4.000',
            duration: '30 min',
            description: 'Retiro profesional de trabajos externos',
            image: '/retirado.jpg'
          }
        ]
      },
      {
        id: 2,
        category: 'DECORADO',
        items: [
          { name: 'Diseño por Uña', price: '$200', duration: '10 min', description: 'Arte personalizado en cada uña' },
          { name: 'Efecto Espejo/Aurora', price: '$200', duration: '10 min', description: 'Acabado holográfico y brillante' },
          { name: 'Relieve/Encapsulado', price: '$200', duration: '15 min', description: 'Diseños en 3D y encapsulados' },
          { name: 'Glitter/Ojo de Gato', price: '$200', duration: '10 min', description: 'Efectos magnéticos y brillos' },
          { name: 'Strass (hasta 5 x uña)', price: '$200', duration: '10 min', description: 'Piedras y cristales decorativos' }
        ]
      }
    ];


    const getHorariosPorDia = (fecha) => {
      const horariosDiciembre = {
        '2025-12-01': ['07:00', '09:00', '11:00', '13:00'],
        '2025-12-02': ['07:00', '09:00', '11:00', '12:00', '14:00', '16:00', '18:00'],
        '2025-12-03': ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'],
        '2025-12-04': ['07:00', '09:00', '11:00', '13:00'],
        '2025-12-05': ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'],
        '2025-12-06': ['10:00', '12:00', '12:00', '14:00', '14:00', '16:00', '16:00', '18:00', '18:00'],
        '2025-12-07': ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00'],
        '2025-12-08': ['07:00', '09:00', '11:00', '13:00'],
        '2025-12-09': ['07:00', '09:00', '11:00', '12:00', '14:00', '16:00', '18:00'],
        '2025-12-10': ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'],
        '2025-12-11': ['07:00', '09:00', '11:00', '12:00', '14:00', '16:00', '18:00'],
        '2025-12-12': ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'],
        '2025-12-13': ['10:00', '12:00', '12:00', '14:00', '14:00', '16:00', '16:00', '18:00'],
        '2025-12-14': ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00'],
        '2025-12-15': ['07:00', '09:00', '11:00', '13:00'],
        '2025-12-16': ['07:00', '09:00', '11:00', '12:00', '14:00', '16:00', '18:00'],
        '2025-12-17': ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'],
        '2025-12-18': ['07:00', '09:00', '11:00', '13:00'],
        '2025-12-19': ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'],
        '2025-12-20': ['10:00', '12:00', '14:00', '14:00', '14:00', '14:00', '16:00', '18:00', '18:00'],
        '2025-12-21': ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00'],
        '2025-12-22': ['07:00', '09:00', '11:00', '13:00'],
        '2025-12-23': ['07:00', '09:00', '11:00', '12:00', '14:00', '16:00', '18:00'],
        '2025-12-24': ['08:00', '10:00', '12:00'],
        '2025-12-26': ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'],
        '2025-12-29': ['07:00', '09:00', '11:00', '13:00'],
        '2025-12-30': ['07:00', '09:00', '11:00', '12:00', '14:00', '16:00', '18:00'],
        '2025-12-31': ['08:00', '10:00', '12:00']
      };
    
      // Si es diciembre 2025, usar horarios específicos
      if (horariosDiciembre[fecha]) {
        return horariosDiciembre[fecha];
      }
    
      // Para otros meses, usar estos horarios
      return ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00'];
    };

    // Cargar turnos y horarios bloqueados cuando cambia la fecha
    useEffect(() => {
      const loadBookedSlots = async () => {
        try {
          // Obtener horarios del día
          const horariosDelDia = getHorariosPorDia(selectedDate);

          // Cargar turnos confirmados
          const turnosRef = collection(db, 'turnos');
          const qTurnos = query(turnosRef, where('fecha', '==', selectedDate));
          const turnosSnapshot = await getDocs(qTurnos);

          const slots = [];
          turnosSnapshot.forEach((doc) => {
            slots.push(doc.data().hora);
          });

          // Cargar horarios bloqueados
          const bloqueadosRef = collection(db, 'horarios_bloqueados');

          // Bloqueos de día completo
          const qDiaCompleto = query(
            bloqueadosRef,
            where('tipo', '==', 'dia_completo'),
            where('fecha', '==', selectedDate)
          );
          const diaCompletoSnapshot = await getDocs(qDiaCompleto);

          // Si el día está bloqueado completamente, bloquear todos los horarios
          if (!diaCompletoSnapshot.empty) {
            setBookedSlots(horariosDelDia);
            return;
          }

          // Bloqueos de horarios específicos
          const qHorarios = query(
            bloqueadosRef,
            where('tipo', '==', 'horario_especifico'),
            where('fecha', '==', selectedDate)
          );
          const horariosSnapshot = await getDocs(qHorarios);

          horariosSnapshot.forEach((doc) => {
            slots.push(doc.data().hora);
          });

          setBookedSlots(slots);

        } catch (error) {
          console.error('Error al cargar turnos:', error);
        }
      };

      if (selectedDate) {
        loadBookedSlots();
      }
    }, [selectedDate]);

    useEffect(() => {
      if (selectedService && dateRef.current) {
        setTimeout(() => {
          dateRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    }, [selectedService]);

    useEffect(() => {
      if (selectedDate && timeRef.current) {
        setTimeout(() => {
          timeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    }, [selectedDate]);

    useEffect(() => {
      if (selectedTime && customerRef.current) {
        setTimeout(() => {
          customerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    }, [selectedTime]);

// Detectar retorno de Mercado Pago
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const status = urlParams.get('status');
  
  if (status === 'success' && pendingTurnoData) {
    // El pago fue exitoso, guardar turno y enviar WhatsApp
    handlePaymentSuccess({ id: urlParams.get('payment_id') || 'MP-' + Date.now() });
  }
}, []);

const sendWhatsAppNotification = (service, date, time, name, phone) => {
  const aprilPhone = '5493624748712';
  
  const message = `🎉 *NUEVO TURNO CONFIRMADO* 🎉

💅 *Servicio:* ${service.name}
💰 *Precio:* ${service.price}
⏱️ *Duración:* ${service.duration}

📅 *Fecha:* ${new Date(date + 'T00:00:00').toLocaleDateString('es-AR', { 
  weekday: 'long', 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
})}
🕐 *Hora:* ${time} hs

👤 *Cliente:* ${name}
📱 *Teléfono:* ${phone}

💵 *SEÑA PAGADA: $100* ✅

---
_Reserva realizada desde la web_`;

  const whatsappUrl = `https://wa.me/${aprilPhone}?text=${encodeURIComponent(message)}`;
  
  // Usar setTimeout para evitar bloqueo de pop-ups
  setTimeout(() => {
    window.location.href = whatsappUrl;
  }, 500);
};
    const handleBooking = () => {
      if (selectedService && selectedDate && selectedTime && customerName && customerPhone) {
        const service = getSelectedService();
        
        // Guardar datos del turno pendiente
        const turnoData = {
          servicio: service.name,
          precio: service.price,
          duracion: service.duration,
          fecha: selectedDate,
          hora: selectedTime,
          clienteNombre: customerName,
          clienteTelefono: customerPhone,
          clienteEmail: `${customerPhone}@cliente.com`
        };
        
        // Guardar en localStorage para no perderlo al volver de MP
        localStorage.setItem('pendingTurno', JSON.stringify(turnoData));
        
        setPendingTurnoData(turnoData);
        setShowPayment(true);
      }
    };

    
    const handlePaymentSuccess = async (paymentResult) => {
      setLoading(true);
      
      try {
        // Recuperar datos del localStorage si no están en el estado
        const turnoData = pendingTurnoData || JSON.parse(localStorage.getItem('pendingTurno'));
        
        if (!turnoData) {
          throw new Error('No se encontraron datos del turno');
        }
        
        const service = getSelectedService() || {
          name: turnoData.servicio,
          price: turnoData.precio,
          duration: turnoData.duracion
        };
        
        // Guardar el turno en Firebase
        await addDoc(collection(db, 'turnos'), {
          servicio: turnoData.servicio,
          precio: turnoData.precio,
          duracion: turnoData.duracion,
          fecha: turnoData.fecha,
          hora: turnoData.hora,
          clienteNombre: turnoData.clienteNombre,
          clienteTelefono: turnoData.clienteTelefono,
          senaPagada: 100, // Cambiar a 5000 después de las pruebas
          estadoPago: 'aprobado',
          paymentId: paymentResult.id,
          timestamp: Timestamp.now()
        });
        
        // Enviar WhatsApp a April
        sendWhatsAppNotification(
          service, 
          turnoData.fecha, 
          turnoData.hora, 
          turnoData.clienteNombre, 
          turnoData.clienteTelefono
        );
        
        // Limpiar localStorage
        localStorage.removeItem('pendingTurno');
        
        // Mostrar confirmación
        setShowPayment(false);
        setShowConfirmation(true);
        setLoading(false);
        
        // Limpiar URL
        window.history.replaceState({}, '', window.location.pathname);
        
      } catch (error) {
        console.error('Error al guardar el turno:', error);
        alert('Error al confirmar el turno. Contactá al local.');
        setLoading(false);
      }
    };

// Detectar retorno de Mercado Pago
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const status = urlParams.get('status');
  
  if (status === 'success' || status === 'approved') {
    const turnoGuardado = localStorage.getItem('pendingTurno');
    
    if (turnoGuardado) {
      const turnoData = JSON.parse(turnoGuardado);
      const paymentId = urlParams.get('payment_id') || urlParams.get('collection_id') || 'MP-' + Date.now();
      
      // Guardar turno y enviar WhatsApp
      (async () => {
        setLoading(true);
        
        try {
          const service = {
            name: turnoData.servicio,
            price: turnoData.precio,
            duration: turnoData.duracion
          };
          
          // Guardar en Firebase
          await addDoc(collection(db, 'turnos'), {
            servicio: turnoData.servicio,
            precio: turnoData.precio,
            duracion: turnoData.duracion,
            fecha: turnoData.fecha,
            hora: turnoData.hora,
            clienteNombre: turnoData.clienteNombre,
            clienteTelefono: turnoData.clienteTelefono,
            senaPagada: 100,
            estadoPago: 'aprobado',
            paymentId: paymentId,
            timestamp: Timestamp.now()
          });
          
          // Enviar WhatsApp
          sendWhatsAppNotification(
            service, 
            turnoData.fecha, 
            turnoData.hora, 
            turnoData.clienteNombre, 
            turnoData.clienteTelefono
          );
          
          // Limpiar y mostrar confirmación
          localStorage.removeItem('pendingTurno');
          setSelectedService(turnoData.servicio);
          setSelectedDate(turnoData.fecha);
          setSelectedTime(turnoData.hora);
          setCustomerName(turnoData.clienteNombre);
          setCustomerPhone(turnoData.clienteTelefono);
          setShowConfirmation(true);
          setLoading(false);
          
          // Limpiar URL
          window.history.replaceState({}, '', window.location.pathname);
          
        } catch (error) {
          console.error('Error:', error);
          alert('Error al confirmar el turno');
          setLoading(false);
        }
      })();
    }
  }
}, []);


    const resetForm = () => {
      setSelectedService(null);
      setSelectedDate('');
      setSelectedTime('');
      setCustomerName('');
      setCustomerPhone('');
      setShowConfirmation(false);
      setBookedSlots([]);
    };

    const today = new Date().toISOString().split('T')[0];

    const getSelectedService = () => {
      for (let category of services) {
        const found = category.items.find(item => item.name === selectedService);
        if (found) return found;
      }
      return null;
    };

    const isTimeSlotAvailable = (time) => {
      return !bookedSlots.includes(time);
    };


// Detectar si la URL tiene ?bio
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('bio') !== null) {
    setShowBio(true);
  }
}, []);

// Mostrar página Bio
if (showBio) {
  return <Bio />;
}
    // Mostrar panel de admin
if (showAdmin) {
  return <Admin />;
}

    if (showPayment) {
      return (
        <PaymentStep 
          turnoData={pendingTurnoData}
          onBack={() => setShowPayment(false)}
          onPaymentSuccess={handlePaymentSuccess}
        />
      );
    }
    
    // Resto del código (confirmación, etc.)
    if (showConfirmation) {
      const service = getSelectedService();
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100 p-4 animate-fadeIn">
          <div className="max-w-md mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden mt-8 border-4 border-purple-200">
            <div className="bg-gradient-to-br from-purple-600 via-purple-500 to-pink-400 p-8 text-white text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-white opacity-10"></div>
              <div className="w-24 h-24 bg-white rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg relative z-10 animate-bounce">
                <Sparkles className="text-purple-600" size={48} />
              </div>
              <h2 className="text-3xl font-bold mb-2 relative z-10">¡Turno Confirmado!</h2>
              <p className="text-purple-100 text-lg relative z-10">Tu reserva ha sido registrada con éxito</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-5 border-2 border-purple-200 shadow-md">
                <p className="text-sm text-gray-600 mb-1 font-semibold">💅 Servicio</p>
                <p className="font-bold text-xl text-gray-800">{service.name}</p>
                <p className="text-purple-600 font-semibold text-lg">{service.price} • {service.duration}</p>
                <p className="text-sm text-gray-600 mt-2">{service.description}</p>
              </div>
              
              <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-2xl p-5 border-2 border-pink-200 shadow-md">
                <p className="text-sm text-gray-600 mb-1 font-semibold">📅 Fecha y Hora</p>
                <p className="font-bold text-lg text-gray-800">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-AR', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
                <p className="text-purple-600 font-bold text-xl">{selectedTime} hs</p>
              </div>
              
              <div className="bg-gray-50 rounded-2xl p-5 border-2 border-gray-200 shadow-md">
                <p className="text-sm text-gray-600 mb-1 font-semibold">👤 Cliente</p>
                <p className="font-bold text-lg text-gray-800">{customerName}</p>
                <p className="text-gray-600 font-medium">{customerPhone}</p>
              </div>

              <div className="bg-green-50 border-3 border-green-300 rounded-2xl p-5 mt-6 shadow-md">
                <div className="flex items-start gap-3">
                  <MessageCircle className="text-green-600 flex-shrink-0 mt-1" size={24} />
                  <p className="text-sm text-green-900 leading-relaxed">
                    <strong>✓ Notificación enviada:</strong> Se abrió WhatsApp para notificar a April sobre tu turno. 
                    Si no se abrió automáticamente, contactala al <strong>3624-748712</strong>.
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 border-3 border-blue-300 rounded-2xl p-5 mt-4 shadow-md">
                <p className="text-sm text-blue-900 leading-relaxed">
                  <strong>⏰ Importante:</strong> Te esperamos 5 minutos antes de tu turno. 
                  Si necesitás cancelar o reprogramar, por favor avisanos con 24hs de anticipación.
                </p>
              </div>
              
              <button
                onClick={resetForm}
                className="w-full bg-gradient-to-r from-purple-600 via-purple-500 to-pink-400 text-white py-5 rounded-2xl font-bold text-xl hover:shadow-2xl hover:scale-105 transition-all mt-6 shadow-lg"
              >
                ✨ Volver al Menu
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100">
        {/* Header con logo APRIL */}
        <div className="bg-gradient-to-br from-purple-600 via-purple-500 to-pink-400 text-white p-6 shadow-2xl relative overflow-hidden sticky top-0 z-50">
          <div className="absolute inset-0 bg-white opacity-5"></div>
          <div className="max-w-md mx-auto relative z-10">
          <div className="flex items-center gap-4 mb-3">
  <div 
    className="bg-white p-3 rounded-2xl shadow-xl cursor-pointer"
    onClick={() => setShowAdmin(true)}
  >
    <img 
      src="/logo-april.jpg" 
      alt="April Logo" 
      className="w-14 h-14 object-contain"
    />
  </div>
  <div>
    <h1 className="text-3xl font-black tracking-tight">NAILS BY APRIL</h1>
    <p className="text-purple-100 font-medium text-lg">Reservá tu turno online</p>
  </div>
</div>
            <div className="flex flex-col gap-2 mt-5 text-sm bg-white bg-opacity-10 backdrop-blur-sm p-4 rounded-xl">
              <div className="flex items-center gap-2">
                <MapPin size={18} className="flex-shrink-0" />
                <span className="font-medium">Julio A. Roca 43, Resistencia, Chaco</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={18} className="flex-shrink-0" />
                <span className="font-medium">3624-748712</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={18} className="flex-shrink-0" />
                <span className="font-medium">Lun a Sáb • 9:00 - 18:00 hs</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-md mx-auto p-5 pb-8">
          {/* Selección de Servicio */}
          <div className="mb-8">
            <h2 className="text-2xl font-black mb-5 text-gray-800 flex items-center gap-2">
              <span className="bg-gradient-to-r from-purple-600 to-pink-400 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg">1</span>
              Elegí tu servicio
            </h2>
            
            {services.map((category) => (
              <div key={category.id} className="mb-6">
                <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-400 mb-4 text-center">
                  {category.category}
                </h3>
                <div className="space-y-3">
                  {category.items.map((service) => (
                  <button
                  key={service.name}
                  onClick={() => setSelectedService(service.name)}
                  className={`w-full text-left rounded-2xl transition-all transform overflow-hidden ${
                    selectedService === service.name
                      ? 'bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 text-white shadow-2xl scale-105 border-3 border-white'
                      : 'bg-white hover:shadow-xl border-2 border-purple-200 hover:scale-102'
                  }`}
                >
                  {service.image && (
                    <div className="w-full h-40 overflow-hidden">
                      <img 
                        src={service.image} 
                        alt={service.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-lg">{service.name}</h4>
                      <ChevronRight className={selectedService === service.name ? 'text-white' : 'text-purple-400'} />
                    </div>
                    <p className={`text-sm mb-3 ${selectedService === service.name ? 'text-pink-100' : 'text-gray-600'}`}>
                      {service.description}
                    </p>
                    <div className="flex gap-4 text-sm items-center">
                      <span className={`font-bold text-lg ${selectedService === service.name ? 'text-white' : 'text-purple-600'}`}>
                        {service.price}
                      </span>
                      <span className={`${selectedService === service.name ? 'text-pink-100' : 'text-gray-500'} font-medium`}>
                        ⏱ {service.duration}
                      </span>
                    </div>
                  </div>
                </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Selección de Fecha y Hora */}
          {selectedService && (
            <div className="space-y-8">
              <div ref={dateRef} className="scroll-mt-32">
                <h2 className="text-2xl font-black mb-5 text-gray-800 flex items-center gap-2">
                  <span className="bg-gradient-to-r from-purple-600 to-pink-400 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg animate-pulse">2</span>
                  Elegí fecha y hora
                </h2>
                
                <div className="bg-white rounded-2xl p-5 mb-5 shadow-lg border-2 border-purple-200 transform transition-all hover:scale-102">
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    <Calendar className="inline mr-2 text-purple-600" size={20} />
                    Fecha del turno
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={today}
                    className="w-full p-4 border-3 border-purple-300 rounded-xl focus:border-purple-500 focus:outline-none focus:ring-4 focus:ring-purple-200 font-semibold text-lg transition-all"
                  />
                </div>

                {selectedDate && (
                  <div ref={timeRef} className="bg-white rounded-2xl p-5 shadow-lg border-2 border-purple-200 scroll-mt-32 animate-fadeIn">
                    <label className="block text-sm font-bold text-gray-700 mb-4">
                      <Clock className="inline mr-2 text-purple-600" size={20} />
                      Horarios disponibles
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                    {getHorariosPorDia(selectedDate).map((time) => {
                        const available = isTimeSlotAvailable(time);
                        return (
                          <button
                            key={time}
                            type="button"
                            onClick={() => available && setSelectedTime(time)}
                            disabled={!available}
                            className={`p-4 rounded-xl font-bold text-lg transition-all transform ${
                              selectedTime === time
                                ? 'bg-gradient-to-r from-purple-600 to-pink-400 text-white shadow-xl scale-105'
                                : available
                                ? 'bg-purple-50 hover:bg-purple-100 text-gray-700 border-2 border-purple-200 hover:scale-110'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed line-through'
                            }`}
                          >
                            {time}
                            {!available && <div className="text-xs mt-1">Ocupado</div>}
                          </button>
                        );
                      })}
                    </div>
                    {bookedSlots.length > 0 && (
                      <p className="text-sm text-gray-600 mt-4 text-center">
                        ⚠️ Los horarios tachados ya están reservados
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Datos del Cliente */}
              {selectedDate && selectedTime && (
                <div ref={customerRef} className="scroll-mt-32 animate-fadeIn">
                  <h2 className="text-2xl font-black mb-5 text-gray-800 flex items-center gap-2">
                    <span className="bg-gradient-to-r from-purple-600 to-pink-400 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg animate-pulse">3</span>
                    Tus datos
                  </h2>
                  
                  <div className="bg-white rounded-2xl p-5 shadow-lg border-2 border-purple-200 space-y-5">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Nombre completo
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Ej: María González"
                        className="w-full p-4 border-3 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none focus:ring-4 focus:ring-purple-200 text-lg transition-all"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Teléfono / WhatsApp
                      </label>
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Ej: 3624-123456"
                        className="w-full p-4 border-3 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none focus:ring-4 focus:ring-purple-200 text-lg transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Botón Confirmar */}
              {customerName && customerPhone && (
                <button
                  onClick={handleBooking}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-purple-600 via-purple-500 to-pink-400 text-white py-6 rounded-2xl font-black text-2xl shadow-2xl hover:shadow-3xl hover:scale-105 transition-all transform animate-fadeIn disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={28} />
                      Confirmando...
                    </>
                  ) : (
                    '✨ Confirmar Turno ✨'
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        <style>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .animate-fadeIn {
            animation: fadeIn 0.5s ease-out;
          }
        `}</style>
      </div>
    );
  }
