import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const token = body.token;
  const otp = body.otp;
  const mode = body.mode as 'onboarding' | 'edit' | undefined;

  if (!token || !otp) {
    return new Response(JSON.stringify({ error: 'Brak tokenu lub kodu OTP' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const payloadUrl = import.meta.env.PAYLOAD_URL || 'http://127.0.0.1:3000';
  
  // Jeśli front-end nie podał jawnie trybu, sam wykryj tryb po tokenie
  const apiKey = import.meta.env.PAYLOAD_API_KEY;
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    authHeaders['Authorization'] = `users API-Key ${apiKey}`;
  }

  let finalMode = mode;
  let order: any = null;

  try {
    // Najpierw szukamy w onboardingToken
    const searchResOnboarding = await fetch(
      `${payloadUrl}/api/orders?where[onboardingToken][equals]=${encodeURIComponent(token)}&limit=1`,
      { headers: authHeaders }
    );
    const searchDataOnboarding = await searchResOnboarding.json();

    if (searchDataOnboarding.docs?.length > 0) {
      finalMode = 'onboarding';
      order = searchDataOnboarding.docs[0];
    } else {
      // Szukamy w editToken
      const searchResEdit = await fetch(
        `${payloadUrl}/api/orders?where[editToken][equals]=${encodeURIComponent(token)}&limit=1&depth=0`,
        { headers: authHeaders }
      );
      const searchDataEdit = await searchResEdit.json();
      if (searchDataEdit.docs?.length > 0) {
        finalMode = 'edit';
        order = searchDataEdit.docs[0];
      }
    }

    if (!order) {
      return new Response(JSON.stringify({ error: 'Nieprawidłowy token' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    // W trybie edit brief musi istnieć; w trybie onboarding brief nie może istnieć (burn after reading)
    if (finalMode === 'edit' && !order.brief) {
      return new Response(JSON.stringify({ error: 'Brak briefu do edycji.' }), {
        status: 409, headers: { 'Content-Type': 'application/json' },
      });
    }
    if (finalMode !== 'edit' && order.brief) {
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
      headers: authHeaders,
      body: JSON.stringify({ otpCode: null, otpExpiry: null }),
    });

    // Jeżeli edycja, pobieramy Brief
    let briefData: Record<string, unknown> | null = null;
    let briefId = null;
    if (finalMode === 'edit' && order.brief) {
      briefId = typeof order.brief === 'object' ? order.brief.id : order.brief;
      const briefRes = await fetch(`${payloadUrl}/api/briefs/${briefId}`, { headers: authHeaders });
      if (briefRes.ok) {
        const briefJson = await briefRes.json();
        briefData = (briefJson.doc ?? briefJson) as Record<string, unknown>;
      }
    }

    return new Response(JSON.stringify({
      verified: true,
      mode: finalMode,
      orderId: order.id,
      customerEmail: order.customerEmail,
      dailyLimit: order.dailyLimit,
      monthlyAmount: order.monthlyAmount,
      briefId,
      brief: briefData,
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
