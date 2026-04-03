export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);
    const ACCESS_TOKEN = process.env.VITE_MP_ACCESS_TOKEN;

    const baseUrl = event.headers.origin || 'https://reservas-april.netlify.app';

    const preference = {
      items: [{
        title: `Seña - ${data.serviceName}`,
        unit_price: 5000,
        quantity: 1,
        currency_id: 'ARS',
      }],
      payer: {
        name: data.name,
        email: data.email,
        phone: { number: data.phone },
      },
      external_reference: JSON.stringify({
        serviceId: data.serviceId,
        servicio: data.serviceName,
        fecha: data.date,
        hora: data.time,
        clienteNombre: data.name,
        clienteTelefono: data.phone,
        clienteEmail: data.email,
        appointmentId: data.appointmentId,
      }),
      back_urls: {
        success: `${baseUrl}/?payment=success`,
        failure: `${baseUrl}/?payment=failure`,
        pending: `${baseUrl}/?payment=pending`,
      },
      auto_return: 'approved',
      notification_url: `${baseUrl}/.netlify/functions/webhook`,
    };

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preference),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Error al crear la preferencia');
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ init_point: result.init_point, id: result.id }),
    };
  } catch (error) {
    console.error('Error create-preference:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
