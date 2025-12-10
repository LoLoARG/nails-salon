const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Inicializar Firebase Admin (solo una vez)
let db;
try {
  initializeApp({
    credential: cert({
      projectId: "nails-by-april",
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
  db = getFirestore();
} catch (error) {
  if (error.code !== 'app/duplicate-app') {
    console.error('Error inicializando Firebase:', error);
  }
  db = getFirestore();
}

exports.handler = async (event) => {
  // Solo POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    console.log('Webhook recibido:', body);

    // Verificar que sea notificación de pago
    if (body.type === 'payment' && body.data?.id) {
      const paymentId = body.data.id;

      // Consultar info del pago en Mercado Pago
      const ACCESS_TOKEN = process.env.VITE_MP_ACCESS_TOKEN;
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`
        }
      });

      const payment = await response.json();
      console.log('Pago:', payment);

      // Solo si está aprobado
      if (payment.status === 'approved') {
        // Extraer datos del external_reference
        const turnoData = JSON.parse(payment.external_reference);

        // Guardar en Firebase
        await db.collection('turnos').add({
          servicio: turnoData.servicio,
          fecha: turnoData.fecha,
          hora: turnoData.hora,
          clienteNombre: turnoData.clienteNombre,
          clienteTelefono: turnoData.clienteTelefono,
          precio: '$5.000 (seña)',
          duracion: '1h 30min',
          estado: 'confirmado',
          timestamp: new Date(),
          paymentId: paymentId
        });

        console.log('Turno guardado en Firebase');

        // Enviar WhatsApp a April
        const mensajeApril = `🔔 NUEVO TURNO CONFIRMADO

📅 ${turnoData.fecha} a las ${turnoData.hora}
💅 ${turnoData.servicio}
👤 ${turnoData.clienteNombre}
📱 ${turnoData.clienteTelefono}
💰 Seña pagada: $5.000`;

        const whatsappApril = `https://wa.me/5493624748712?text=${encodeURIComponent(mensajeApril)}`;
        
        // Aquí podrías usar una API de WhatsApp para enviar automático
        console.log('WhatsApp para April:', whatsappApril);

        // Enviar WhatsApp a cliente
        const mensajeCliente = `✅ ¡Turno confirmado!

Hola ${turnoData.clienteNombre}, tu turno está confirmado:

📅 ${turnoData.fecha}
⏰ ${turnoData.hora}
💅 ${turnoData.servicio}

Nos vemos! 💖
- Nails by April`;

        console.log('Mensaje para cliente preparado');
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true })
    };

  } catch (error) {
    console.error('Error en webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};