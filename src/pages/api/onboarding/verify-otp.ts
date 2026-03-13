import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { token, otp } = body;

  if (!token || !otp) {
    return new Response(JSON.stringify({ error: 'Brak tokenu lub kodu OTP' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const payloadUrl = import.meta.env.PAYLOAD_URL || 'http://127.0.0.1:3000';

  try {
    const searchRes = await fetch(
      `${payloadUrl}/api/orders?where[onboardingToken][equals]=${token}&limit=1`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    const searchData = await searchRes.json();

    if (!searchData.docs?.length) {
      return new Response(JSON.stringify({ error: 'Nieprawidłowy token' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    const order = searchData.docs[0];

    // Jeśli brief już istnieje, link powinien być martwy nawet gdy onboardingToken jeszcze jest w bazie
    if (order.brief) {
      return new Response(JSON.stringify({ error: 'Ten link został już wykorzystany. Brief jest zapisany.' }), {
        status: 410, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Czyścimy przestarzałe OTP (>24h) jeśli istnieje
    if (order.otpExpiry) {
      const otpTime = new Date(order.otpExpiry).getTime();
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      if (otpTime < cutoff) {
        await fetch(`${payloadUrl}/api/orders/${order.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ otpCode: null, otpExpiry: null }),
        });
        order.otpCode = null;
        order.otpExpiry = null;
      }
    }

    if (!order.otpCode || order.otpCode !== otp.trim()) {
      return new Response(JSON.stringify({ error: 'Nieprawidłowy kod. Sprawdź email i spróbuj ponownie.' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!order.otpExpiry || new Date(order.otpExpiry) < new Date()) {
      return new Response(JSON.stringify({ error: 'Kod wygasł. Wygeneruj nowy.' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }

    // OTP prawidłowy – wyczyść go z bazy
    await fetch(`${payloadUrl}/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otpCode: null, otpExpiry: null }),
    });

    return new Response(JSON.stringify({
      verified: true,
      orderId: order.id,
      customerEmail: order.customerEmail,
      dailyLimit: order.dailyLimit,
      monthlyAmount: order.monthlyAmount,
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[verify-otp] Error:', err);
    return new Response(JSON.stringify({ error: 'Błąd serwera' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
