import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import crypto from 'crypto';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { orderId, type } = body as { orderId?: string; type?: 'onboarding' | 'edit' };

  if (!orderId) {
    return new Response(JSON.stringify({ error: 'Brak orderId' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const payloadUrl = import.meta.env.PAYLOAD_URL || 'http://127.0.0.1:3000';
  const siteUrl = import.meta.env.SITE_URL || 'https://nexusagent.pl';
  const resendKey = import.meta.env.RESEND_API_KEY;

  try {
    const orderRes = await fetch(`${payloadUrl}/api/orders/${orderId}?depth=2`, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!orderRes.ok) {
      return new Response(JSON.stringify({ error: 'Nie znaleziono zamówienia' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    const order = await orderRes.json();

    if (!order.customerEmail) {
      return new Response(JSON.stringify({ error: 'Brak emaila klienta w zamówieniu' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const resend = resendKey ? new Resend(resendKey) : null;

    const mode = type || 'onboarding';

    if (mode === 'onboarding') {
      if (order.brief) {
        return new Response(JSON.stringify({ error: 'Brief już wypełniony – użyj trybu edycji.' }), {
          status: 409, headers: { 'Content-Type': 'application/json' },
        });
      }

      const token = order.onboardingToken || crypto.randomBytes(32).toString('hex');

      if (!order.onboardingToken) {
        await fetch(`${payloadUrl}/api/orders/${orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ onboardingToken: token }),
        });
      }

      if (resend) {
        const link = `${siteUrl}/onboarding/${token}`;
        await resend.emails.send({
          from: 'NEXUS Agent <onboarding@nexusagent.pl>',
          to: order.customerEmail,
          subject: 'NEXUS Agent – ponowny link do konfiguracji systemu',
          html: `
            <div style="background:#050508;padding:40px;font-family:monospace;color:#e2e8f0;border-radius:16px;">
              <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#0ceaed;margin-bottom:16px;">NEXUS AGENT – ONBOARDING</div>
              <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin-bottom:24px;">
                Wysyłamy ponownie Twój jednorazowy link do konfiguracji NEXUS.
                Po wypełnieniu briefu link zostanie automatycznie unieważniony.
              </p>
              <div style="text-align:center;margin-bottom:24px;">
                <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;font-weight:800;font-size:14px;text-transform:uppercase;letter-spacing:0.1em;padding:16px 40px;border-radius:100px;text-decoration:none;">Otwórz Brief Wdrożeniowy</a>
              </div>
            </div>
          `,
        });
      }

      return new Response(JSON.stringify({ ok: true, mode: 'onboarding' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    // TRYB EDYCJI
    if (!order.brief) {
      return new Response(JSON.stringify({ error: 'Brak briefu do edycji.' }), {
        status: 409, headers: { 'Content-Type': 'application/json' },
      });
    }

    const editToken = order.editToken || crypto.randomBytes(32).toString('hex');

    if (!order.editToken) {
      await fetch(`${payloadUrl}/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editToken }),
      });
    }

    if (resend) {
      const link = `${siteUrl}/onboarding/${editToken}?mode=edit`;
      await resend.emails.send({
        from: 'NEXUS Agent <onboarding@nexusagent.pl>',
        to: order.customerEmail,
        subject: 'NEXUS Agent – link do edycji briefu wdrożeniowego',
        html: `
          <div style="background:#050508;padding:40px;font-family:monospace;color:#e2e8f0;border-radius:16px;">
            <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#0ceaed;margin-bottom:16px;">NEXUS AGENT – EDYCJA BRIEFU</div>
            <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin-bottom:24px;">
              Otrzymujesz bezpieczny link do edycji wcześniej wypełnionego briefu.
              Każda zmiana zostanie zapisana i uwzględniona przy pracy agenta.
            </p>
            <div style="text-align:center;margin-bottom:24px;">
              <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;font-weight:800;font-size:14px;text-transform:uppercase;letter-spacing:0.1em;padding:16px 40px;border-radius:100px;text-decoration:none;">Edytuj Brief</a>
            </div>
          </div>
        `,
      });
    }

    return new Response(JSON.stringify({ ok: true, mode: 'edit' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[onboarding/resend-link] Error:', err);
    return new Response(JSON.stringify({ error: 'Błąd serwera' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
