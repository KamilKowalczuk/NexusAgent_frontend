import type { APIRoute } from 'astro';
import crypto from 'node:crypto';

export const prerender = false;

// Funkcja pomocnicza do budowy podpisu anty-fałszerstwo dla ciastka z sesją
export function signSessionId(orderId: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(orderId).digest('hex');
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const body = await request.json();
  const { orderNumber, email, otp } = body as { orderNumber?: string; email?: string; otp?: string; };

  if (!orderNumber || !email || !otp) {
    return new Response(JSON.stringify({ error: 'Brakujące dane autoryzacyjne.' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const payloadUrl = import.meta.env.PAYLOAD_URL || 'http://127.0.0.1:3000';
  const apiKey = import.meta.env.PAYLOAD_API_KEY;
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    authHeaders['Authorization'] = `users API-Key ${apiKey}`;
  }

  try {
    const searchRes = await fetch(
      `${payloadUrl}/api/orders?where[orderNumber][equals]=${encodeURIComponent(orderNumber.trim())}&limit=1&depth=0`,
      { headers: authHeaders }
    );
    
    if (!searchRes.ok) {
      return new Response(JSON.stringify({ error: 'Błąd połączenia z bazą.' }), { status: 500 });
    }

    const data = await searchRes.json();
    if (!data.docs || data.docs.length === 0) {
      return new Response(JSON.stringify({ error: 'Nieprawidłowy adres email lub nr zamówienia.' }), { status: 401 });
    }

    const order = data.docs[0];

    // Ochrona przed atakiem: sprawdzamy zgodność emaila
    if (order.customerEmail?.toLowerCase().trim() !== email.toLowerCase().trim()) {
      return new Response(JSON.stringify({ error: 'Nieprawidłowy adres email lub nr zamówienia.' }), { status: 401 });
    }

    // Walidacja istnienia kodu
    if (!order.otpCode || order.otpCode.trim() !== otp.trim()) {
      return new Response(JSON.stringify({ error: 'Nieprawidłowy kod OTP. Upewnij się, że wpisujesz najnowszy.' }), { status: 401 });
    }

    // Walidacja czasu życia kodu
    if (!order.otpExpiry || new Date(order.otpExpiry) < new Date()) {
      return new Response(JSON.stringify({ error: 'Kod wygasł. Musisz wygenerować nowy.' }), { status: 401 });
    }

    // 1. Zwycięstwo! Kasujemy użyty OTP:
    await fetch(`${payloadUrl}/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ otpCode: null, otpExpiry: null }),
    });

    // 2. Osadzamy ciasteczko sesji
    // Ponieważ Payload nie zarządza naszymi sesjami w klasyczny sposób dla Klientów (mając tylko API keys admina),
    // zbudujemy proste HMAC podpisane przez payload api key
    const sessionSecret = apiKey || 'fallback_dev_secret_unsecure_!!';
    const signature = signSessionId(order.id, sessionSecret);
    const cookieValue = `${order.id}.${signature}`;

    cookies.set('nexus_sub_session', cookieValue, {
      path: '/',
      httpOnly: true,
      secure: import.meta.env.PROD, // wylacz na dev (http)
      sameSite: 'strict',
      maxAge: 60 * 60 * 2 // Sesja w panelu jest krótka (2 godziny) = max bezpieczeństwo
    });

    return new Response(JSON.stringify({
      verified: true,
      orderId: order.id,
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[verify-otp] Error:', err);
    return new Response(JSON.stringify({ error: 'Wewnętrzny błąd serwera.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
