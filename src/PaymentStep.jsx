import React, { useState } from 'react';
import { CreditCard, ArrowLeft, Loader2 } from 'lucide-react';

export default function PaymentStep({ turnoData, onBack, onPaymentSuccess }) {
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [preferenceId, setPreferenceId] = useState(null);

  const SENA_FIJA = 5000; // Seña de $5.000 para todos
  const ACCESS_TOKEN = import.meta.env.VITE_MP_ACCESS_TOKEN;

  const createPreference = async () => {
    setProcessing(true);

    try {
      // Generar un email temporal si no existe
      const emailCliente = turnoData.clienteEmail || `cliente${Date.now()}@turno.temp`;
      
      // Extraer código de área del teléfono (asumo formato: 3794123456 o 11123456)
      const telefonoCompleto = turnoData.clienteTelefono?.replace(/\D/g, '') || '';
      const areaCode = telefonoCompleto.substring(0, telefonoCompleto.length > 8 ? 4 : 2);
      const number = telefonoCompleto.substring(telefonoCompleto.length > 8 ? 4 : 2);

      const preference = {
        items: [
          {
            title: `Seña - ${turnoData.servicio}`,
            description: `Turno: ${turnoData.fecha} ${turnoData.hora}`,
            quantity: 1,
            unit_price: SENA_FIJA,
            currency_id: 'ARS'
          }
        ],
        payer: {
          name: turnoData.clienteNombre,
          email: emailCliente,
          phone: {
            area_code: areaCode,
            number: number
          }
        },
        back_urls: {
          success: `${window.location.origin}?status=success`,
          failure: `${window.location.origin}?status=failure`,
          pending: `${window.location.origin}?status=pending`
        },
        auto_return: 'approved',
        external_reference: JSON.stringify({
          servicio: turnoData.servicio,
          fecha: turnoData.fecha,
          hora: turnoData.hora,
          clienteNombre: turnoData.clienteNombre,
          clienteTelefono: turnoData.clienteTelefono
        })
        // notification_url se configura después en el panel de MP
      };

      console.log('Enviando preferencia:', preference);

      const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ACCESS_TOKEN}`
        },
        body: JSON.stringify(preference)
      });

      const data = await response.json();
      console.log('Respuesta de MP:', data);

      if (data.id) {
        // Redirigir a Mercado Pago
        window.location.href = data.init_point;
      } else {
        console.error('Error creando preferencia:', data);
        setPaymentStatus('error');
        setProcessing(false);
      }
    } catch (error) {
      console.error('Error:', error);
      setPaymentStatus('error');
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-purple-600 font-semibold mb-4 hover:text-purple-700"
        >
          <ArrowLeft size={20} />
          Volver
        </button>

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border-4 border-purple-200">
          {/* Resumen */}
          <div className="bg-gradient-to-br from-purple-600 via-purple-500 to-pink-400 p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <CreditCard size={32} />
              <div>
                <h2 className="text-2xl font-bold">Pagá la seña</h2>
                <p className="text-purple-100">Para confirmar tu turno</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* Info del turno */}
            <div className="bg-purple-50 rounded-2xl p-4 mb-6 border-2 border-purple-200">
              <h3 className="font-bold text-lg mb-2">{turnoData.servicio}</h3>
              <p className="text-sm text-gray-600">
                📅 {new Date(turnoData.fecha + 'T00:00:00').toLocaleDateString('es-AR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long'
                })} a las {turnoData.hora}
              </p>
              <p className="text-sm text-gray-600">👤 {turnoData.clienteNombre}</p>
            </div>

            {/* Monto */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-400 rounded-2xl p-5 mb-6 text-white text-center">
              <p className="text-sm mb-1">Seña a pagar:</p>
              <p className="text-4xl font-black">${SENA_FIJA.toLocaleString('es-AR')}</p>
            </div>

            {/* Estado del pago */}
            {paymentStatus === 'approved' && (
              <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-4 mb-6 text-center">
                <p className="text-green-800 font-bold text-lg">✅ ¡Pago aprobado!</p>
                <p className="text-sm text-green-700">Redirigiendo...</p>
              </div>
            )}

            {paymentStatus === 'rejected' && (
              <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 mb-6">
                <p className="text-red-800 font-bold">❌ Pago rechazado</p>
                <p className="text-sm text-red-700">Intentá con otro medio de pago</p>
              </div>
            )}

            {paymentStatus === 'error' && (
              <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 mb-6">
                <p className="text-red-800 font-bold">❌ Error en el pago</p>
                <p className="text-sm text-red-700">Por favor intentá nuevamente</p>
              </div>
            )}

            {/* Botón de pago */}
            {processing ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Loader2 className="animate-spin text-purple-600 mb-4" size={48} />
                <p className="text-gray-600">Redirigiendo a Mercado Pago...</p>
              </div>
            ) : paymentStatus !== 'approved' && (
              <div>
                <button
                  onClick={createPreference}
                  disabled={processing}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-400 text-white py-6 rounded-2xl font-black text-xl hover:shadow-2xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  💳 Pagar ${SENA_FIJA.toLocaleString('es-AR')} con Mercado Pago
                </button>

                <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-4 mt-4">
                  <p className="text-sm text-green-900">
                    ✅ <strong>Pago seguro:</strong> Serás redirigido a Mercado Pago para completar el pago de forma segura.
                  </p>
                </div>
              </div>
            )}

            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 mt-6">
              <p className="text-sm text-blue-900">
                💳 <strong>Medios de pago:</strong> Aceptamos tarjetas de débito, crédito y transferencia bancaria.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}