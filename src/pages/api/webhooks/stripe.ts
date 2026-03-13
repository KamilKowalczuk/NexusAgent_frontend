import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { Resend } from 'resend';
import crypto from 'crypto';

export const prerender = false;

function generateOnboardingToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function buildOnboardingEmail(params: {
  customerEmail: string;
  token: string;
  dailyLimit: number;
  monthlyAmount: number;
  siteUrl: string;
}): { subject: string; html: string } {
  const { token, dailyLimit, monthlyAmount, siteUrl } = params;
  const link = `${siteUrl}/onboarding/${token}`;

  return {
    subject: 'NEXUS Agent – Twój jednorazowy link do konfiguracji systemu',
    html: `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NEXUS Agent – Onboarding</title>
</head>
<body style="margin:0;padding:0;background:#050508;font-family:'Inter',sans-serif;color:#e2e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050508;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">
              <img
                src="https://nexusagent.pl/logo.webp"
                alt="NEXUS Agent"
                width="120"
                height="120"
                style="display:block;margin:0 auto 12px auto;"
              />
              <div style="font-family:monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#0ceaed;margin-bottom:8px;">NEXUS REVENUE PROTOCOL</div>
              <div style="font-size:28px;font-weight:900;text-transform:uppercase;letter-spacing:-0.02em;color:#fff;">NEXUS Agent</div>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td style="padding:40px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:24px;margin-top:16px;">

              <div style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.2em;color:#0ceaed;margin-bottom:16px;">System gotowy do konfiguracji</div>

              <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;text-transform:uppercase;letter-spacing:-0.02em;color:#fff;line-height:1.2;">
                Płatność potwierdzona.<br/>
                <span style="color:#0ceaed;">Czas uzbrajać system.</span>
              </h1>

              <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.6;">
                Twoja subskrypcja NEXUS jest aktywna. Aby agent mógł rozpocząć pracę,
                musisz wypełnić <strong style="color:#fff;">Brief Wdrożeniowy</strong> – zajmie to maksymalnie 10 minut.
                Na jego podstawie skonfigurujemy cały system pod Twój biznes.
              </p>

              <!-- Plan details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:20px;margin-bottom:32px;">
                <tr>
                  <td style="padding:8px 16px;border-bottom:1px solid rgba(255,255,255,0.05);">
                    <span style="font-size:10px;font-family:monospace;text-transform:uppercase;letter-spacing:0.15em;color:#64748b;">Dzienny limit wysyłki</span><br/>
                    <span style="font-size:18px;font-weight:700;color:#fff;">${dailyLimit} maili / dzień</span>
                  </td>
                  <td style="padding:8px 16px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:right;">
                    <span style="font-size:10px;font-family:monospace;text-transform:uppercase;letter-spacing:0.15em;color:#64748b;">Koszt systemu</span><br/>
                    <span style="font-size:18px;font-weight:700;color:#a855f7;">${monthlyAmount.toLocaleString('pl-PL')} PLN / mc</span>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:8px 16px;">
                    <span style="font-size:10px;font-family:monospace;text-transform:uppercase;letter-spacing:0.15em;color:#64748b;">Status</span><br/>
                    <span style="font-size:14px;font-weight:600;color:#22c55e;">● Aktywna – płatność potwierdzona</span>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <div style="text-align:center;margin-bottom:32px;">
                <a href="${link}"
                   style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;font-weight:800;font-size:14px;text-transform:uppercase;letter-spacing:0.1em;padding:16px 40px;border-radius:100px;text-decoration:none;box-shadow:0 0 30px rgba(168,85,247,0.4);">
                  ⚡ Otwórz Brief Wdrożeniowy
                </a>
              </div>

              <!-- Security notice -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(168,85,247,0.05);border:1px solid rgba(168,85,247,0.2);border-radius:12px;padding:16px;margin-bottom:24px;">
                <tr>
                  <td>
                    <div style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.15em;color:#a855f7;margin-bottom:8px;">🔐 Bezpieczeństwo</div>
                    <div style="font-size:12px;color:#94a3b8;line-height:1.5;">
                      Ten link jest <strong style="color:#e2e8f0;">jednorazowy</strong> i wygaśnie po wypełnieniu formularza.
                      Chronimy Twoje dane szyfrowaniem <strong style="color:#e2e8f0;">Google Cloud KMS</strong>.
                      Jeśli nie składałeś zamówienia – zignoruj tę wiadomość.
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Steps -->
              <div style="font-size:12px;color:#64748b;line-height:1.8;">
                <div style="margin-bottom:6px;">
                  <span style="color:#0ceaed;font-family:monospace;">01</span> &nbsp; Weryfikacja tożsamości przez OTP (e-mail)
                </div>
                <div style="margin-bottom:6px;">
                  <span style="color:#0ceaed;font-family:monospace;">02</span> &nbsp; Wypełnienie Briefu Wdrożeniowego (~10 min)
                </div>
                <div style="margin-bottom:6px;">
                  <span style="color:#0ceaed;font-family:monospace;">03</span> &nbsp; Inicjalizacja agenta (24-48h)
                </div>
                <div>
                  <span style="color:#0ceaed;font-family:monospace;">04</span> &nbsp; NEXUS startuje kampanię
                </div>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;text-align:center;">
              <div style="font-size:10px;font-family:monospace;text-transform:uppercase;letter-spacing:0.15em;color:#334155;">
                NEXUS AGENT v2.4 · nexusagent.pl · Wsparcie: kontakt@nexusagent.pl
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  };
}

export const POST: APIRoute = async ({ request }) => {
  const stripeKey = import.meta.env.STRIPE_SECRET_KEY;
  const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return new Response('Stripe nie skonfigurowany', { status: 503 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2026-02-25.clover' });

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');
  if (!signature) return new Response('Brak podpisu', { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('[Webhook Stripe] Błąd weryfikacji:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const payloadUrl = import.meta.env.PAYLOAD_URL || 'http://127.0.0.1:3000';
  const siteUrl = import.meta.env.SITE_URL || 'https://nexusagent.pl';
  const resendKey = import.meta.env.RESEND_API_KEY;

  console.log(`[Webhook Stripe] Event: ${event.type}`);

  // --- checkout.session.completed ---
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    const customerEmail = session.customer_details?.email;
    const dailyLimit = parseInt(session.metadata?.emailsPerDay || '20');
    const monthlyAmount = parseInt(session.metadata?.priceInPLN || '1999');
    const stripeCustomerId = session.customer as string;
    const stripeSubscriptionId = session.subscription as string;
    const onboardingToken = generateOnboardingToken();

    console.log(`[Webhook Stripe] Nowy klient: ${customerEmail}, token: ${onboardingToken.slice(0, 8)}...`);

    try {
      // Zapisz zamówienie do Payload
      const orderRes = await fetch(`${payloadUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail,
          stripeCustomerId,
          stripeSubscriptionId,
          dailyLimit,
          monthlyAmount,
          subscriptionStatus: 'active',
          onboardingToken,
        }),
      });

      if (!orderRes.ok) {
        console.error('[Webhook Stripe] Błąd zapisu Order:', await orderRes.text());
      } else {
        console.log('[Webhook Stripe] Order zapisany ✓');
      }

      // Aktualizuj sloty w LandingPage global
      try {
        const globalRes = await fetch(`${payloadUrl}/api/globals/landing-page?depth=0`, {
          headers: { 'Content-Type': 'application/json' },
        });
        if (globalRes.ok) {
          const globalData = await globalRes.json();
          const currentUsed = globalData?.slots?.usedSlots ?? 0;
          await fetch(`${payloadUrl}/api/globals/landing-page`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              slots: {
                totalSlots: globalData?.slots?.totalSlots ?? 10,
                usedSlots: currentUsed + 1,
              },
            }),
          });
        }
      } catch (slotErr) {
        console.warn('[Webhook Stripe] Błąd aktualizacji slotów:', slotErr);
      }

      // Wyślij email onboardingowy przez Resend
      if (resendKey && customerEmail) {
        const resend = new Resend(resendKey);
        const { subject, html } = buildOnboardingEmail({
          customerEmail,
          token: onboardingToken,
          dailyLimit,
          monthlyAmount,
          siteUrl,
        });

        const emailResult = await resend.emails.send({
          from: 'NEXUS Agent <onboarding@nexusagent.pl>',
          to: customerEmail,
          subject,
          html,
        });

        if (emailResult.error) {
          console.error('[Webhook Stripe] Błąd wysyłki emaila:', emailResult.error);
        } else {
          console.log(`[Webhook Stripe] Email onboardingowy wysłany na ${customerEmail} ✓`);
        }
      } else {
        console.warn('[Webhook Stripe] Brak RESEND_API_KEY lub customerEmail – email nie wysłany');
      }
    } catch (err) {
      console.error('[Webhook Stripe] Błąd ogólny:', err);
    }
  }

  // --- invoice.payment_succeeded – aktualizacja currentPeriodEnd ---
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = (invoice as any).subscription as string;
    const periodEnd = (invoice as any).lines?.data?.[0]?.period?.end;

    if (subscriptionId) {
      try {
        const searchRes = await fetch(
          `${payloadUrl}/api/orders?where[stripeSubscriptionId][equals]=${subscriptionId}&limit=1`,
          { headers: { 'Content-Type': 'application/json' } }
        );
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData.docs?.length > 0) {
            const orderId = searchData.docs[0].id;
            await fetch(`${payloadUrl}/api/orders/${orderId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                subscriptionStatus: 'active',
                ...(periodEnd ? { currentPeriodEnd: new Date(periodEnd * 1000).toISOString() } : {}),
              }),
            });
            console.log(`[Webhook Stripe] Order ${orderId} zaktualizowany po płatności ✓`);
          }
        }
      } catch (err) {
        console.error('[Webhook Stripe] Błąd aktualizacji invoice:', err);
      }
    }
  }

  // --- customer.subscription.deleted ---
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    try {
      const searchRes = await fetch(
        `${payloadUrl}/api/orders?where[stripeSubscriptionId][equals]=${subscription.id}&limit=1`,
        { headers: { 'Content-Type': 'application/json' } }
      );
      if (searchRes.ok) {
        const data = await searchRes.json();
        if (data.docs?.length > 0) {
          await fetch(`${payloadUrl}/api/orders/${data.docs[0].id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriptionStatus: 'canceled' }),
          });
          console.log(`[Webhook Stripe] Subskrypcja ${subscription.id} anulowana ✓`);
        }
      }
    } catch (err) {
      console.error('[Webhook Stripe] Błąd anulowania subskrypcji:', err);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
