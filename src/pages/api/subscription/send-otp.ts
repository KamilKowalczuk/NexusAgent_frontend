import type { APIRoute } from 'astro';
import { Resend } from 'resend';

export const prerender = false;

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const body = await request.json();
  const { orderNumber, email } = body as { orderNumber?: string; email?: string };

  if (!orderNumber || !email) {
    return new Response(JSON.stringify({ error: 'Brak numeru zamówienia lub adresu email.' }), {
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
    const res = await fetch(
      `${payloadUrl}/api/orders?where[orderNumber][equals]=${encodeURIComponent(orderNumber.trim())}&limit=1&depth=0`,
      { headers: authHeaders }
    );

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Błąd połączenia z bazą danych.' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    if (!data.docs || data.docs.length === 0) {
      return new Response(JSON.stringify({ error: 'Nie znaleziono zamówienia o podanym numerze.' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    const order = data.docs[0];

    // Spijamy email precyzyjnie
    if (order.customerEmail?.toLowerCase().trim() !== email.toLowerCase().trim()) {
      return new Response(JSON.stringify({ error: 'Podany adres email nie pasuje do zamówienia.' }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Dodatkowe zabezpieczenie: czyszczenie starych OTP
    if (order.otpExpiry) {
      const otpTime = new Date(order.otpExpiry).getTime();
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      if (otpTime < cutoff) {
        await fetch(`${payloadUrl}/api/orders/${order.id}`, {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({ otpCode: null, otpExpiry: null }),
        });
        order.otpCode = null;
        order.otpExpiry = null;
      }
    }

    // TODO: Zaimplementować Rate Limiting w Pamięci/Redis (na razie polegamy na Payload i ukrytym dostępie).

    const otp = generateOtp();
    const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minut

    // Zapisz OTP do Order
    const patchRes = await fetch(`${payloadUrl}/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ otpCode: otp, otpExpiry: expiry }),
    });

    if (!patchRes.ok) {
      console.error('[sub-send-otp] Błąd zapisu OTP, PATCH status:', patchRes.status);
      return new Response(JSON.stringify({ error: 'Błąd generowania kodu dostępu.' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Wyślij OTP przez Resend
    const resendKey = import.meta.env.RESEND_API_KEY || process.env.RESEND_API_KEY;
    if (resendKey) {
      const resend = new Resend(resendKey);
      const emailRes = await resend.emails.send({
        from: 'NEXUS Agent <onboarding@nexusagent.pl>',
        to: email,
        subject: `${otp} – Twój kod dostępu do Panelu ZARZĄDZANIA`,
        html: `
          <div style="background:#050508;padding:40px;font-family:monospace;color:#e2e8f0;border-radius:16px;">
            <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#0ceaed;margin-bottom:16px;">NEXUS AGENT – AUTORYZACJA SESJI KANELU</div>
            <div style="font-size:14px;color:#94a3b8;margin-bottom:24px;">Twój jednorazowy kod weryfikacyjny (OTP):</div>
            <div style="font-size:48px;font-weight:900;letter-spacing:0.15em;color:#0ceaed;text-align:center;padding:24px;background:rgba(12,234,237,0.1);border:1px solid rgba(12,234,237,0.3);border-radius:12px;margin-bottom:24px;">${otp}</div>
            <div style="font-size:12px;color:#64748b;">Kod jest ważny przez <strong style="color:#e2e8f0;">15 minut</strong>. Prosimy go nie udostępniać.</div>
          </div>
        `,
      });
      if (emailRes.error) {
        console.error('[sub-send-otp] Resend API Error:', emailRes.error);
        throw new Error('Resend delivery failed');
      }
    } else {
      console.warn('[sub-send-otp] Brak RESEND_API_KEY w środowisku. Kod OTP:', otp);
    }

    return new Response(JSON.stringify({ sent: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[sub-send-otp] Error:', err);
    return new Response(JSON.stringify({ error: 'Błąd krytyczny serwera.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
