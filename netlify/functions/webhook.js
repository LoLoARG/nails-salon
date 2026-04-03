import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let db;
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: "nails-by-april",
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}
db = getFirestore();

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    console.log('Webhook recibido:', body);

    if (body.type === 'payment' && body.data?.id) {
      const paymentId = body.data.id;

      const ACCESS_TOKEN = process.env.VITE_MP_ACCESS_TOKEN;
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
      });

      const payment = await response.json();
      console.log('Pago:', payment);

      if (payment.status === 'approved') {
        const turnoData = JSON.parse(payment.external_reference);

        await db.collection('appointments').doc(turnoData.appointmentId).update({
          status: 'confirmado',
          paymentId: paymentId,
          paidAt: new Date().toISOString(),
        });

        console.log('Turno confirmado en Firebase:', turnoData.appointmentId);
      }
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };

  } catch (error) {
    console.error('Error en webhook:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
