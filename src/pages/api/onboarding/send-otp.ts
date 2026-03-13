import type { APIRoute } from 'astro';
import { Resend } from 'resend';

export const prerender = false;

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { token, email } = body;

  if (!token || !email) {
    return new Response(JSON.stringify({ error: 'Brak tokenu lub emaila' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const payloadUrl = import.meta.env.PAYLOAD_URL || 'http://127.0.0.1:3000';

  try {
    // Znajdź Order po tokenie i sprawdź email
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

    // Email musi być taki sam jak w zamówieniu
    if (order.customerEmail.toLowerCase() !== email.toLowerCase()) {
      return new Response(JSON.stringify({ error: 'Podany email nie zgadza się z zamówieniem.' }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      });
    }

    const otp = generateOtp();
    const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minut

    // Zapisz OTP do Order
    const patchRes = await fetch(`${payloadUrl}/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otpCode: otp, otpExpiry: expiry }),
    });

    if (!patchRes.ok) {
      return new Response(JSON.stringify({ error: 'Błąd zapisu OTP' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Wyślij OTP przez Resend
    const resendKey = import.meta.env.RESEND_API_KEY;
    if (resendKey) {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: 'NEXUS Agent <onboarding@nexusagent.pl>',
        to: email,
        subject: `${otp} – Twój kod weryfikacyjny NEXUS`,
        html: `
          <div style="background:#050508;padding:40px;font-family:monospace;color:#e2e8f0;border-radius:16px;">
            <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#0ceaed;margin-bottom:16px;">NEXUS AGENT – WERYFIKACJA 2FA</div>
            <div style="font-size:14px;color:#94a3b8;margin-bottom:24px;">Twój jednorazowy kod weryfikacyjny:</div>
            <div style="font-size:48px;font-weight:900;letter-spacing:0.15em;color:#a855f7;text-align:center;padding:24px;background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.3);border-radius:12px;margin-bottom:24px;">${otp}</div>
            <div style="font-size:12px;color:#64748b;">Kod jest ważny przez <strong style="color:#e2e8f0;">10 minut</strong>. Nie udostępniaj go nikomu.</div>
          </div>
        `,
      });
    }

    return new Response(JSON.stringify({ sent: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[send-otp] Error:', err);
    return new Response(JSON.stringify({ error: 'Błąd serwera' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
