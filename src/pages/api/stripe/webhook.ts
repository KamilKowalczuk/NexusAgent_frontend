import type { APIRoute } from 'astro';
import Stripe from 'stripe';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const stripeKey = import.meta.env.STRIPE_SECRET_KEY;
  const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return new Response('Stripe nie skonfigurowany', { status: 503 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2026-02-25.clover' });

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return new Response('Brak podpisu Stripe', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('[Stripe Webhook] Błąd weryfikacji podpisu:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log(`[Stripe Webhook] Zdarzenie: ${event.type}`);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    const emailsPerDay = session.metadata?.emailsPerDay;
    const priceInPLN = session.metadata?.priceInPLN;
    const customerEmail = session.customer_details?.email;
    const subscriptionId = session.subscription as string;

    console.log(`[Stripe Webhook] Nowy klient: ${customerEmail}`);
    console.log(`[Stripe Webhook] Plan: ${emailsPerDay} maili/dzień, ${priceInPLN} PLN/mc`);
    console.log(`[Stripe Webhook] Subscription ID: ${subscriptionId}`);

    // Zapisz zamówienie do Payload CMS
    try {
      const payloadUrl = import.meta.env.PAYLOAD_URL || 'http://127.0.0.1:3000';
      const payloadApiKey = import.meta.env.PAYLOAD_API_KEY;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (payloadApiKey) headers['Authorization'] = `users API-Key ${payloadApiKey}`;

      // 1. Save order
      const orderRes = await fetch(`${payloadUrl}/api/orders`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          clientEmail: customerEmail,
          stripeSubscriptionID: subscriptionId,
          stripeCustomerID: session.customer as string,
          plan: 'starter', // default — could be mapped from emailsPerDay
          status: 'active',
          monthlyAmount: parseInt(priceInPLN || '1999'),
        }),
      });
      if (orderRes.ok) {
        console.log('[Stripe Webhook] Zamówienie zapisane do Payload CMS ✓');
      } else {
        console.warn('[Stripe Webhook] Błąd zapisu zamówienia:', await orderRes.text());
      }

      // 2. Increment usedSlots in LandingPage global
      const globalRes = await fetch(`${payloadUrl}/api/globals/landing-page?depth=0`, { headers });
      if (globalRes.ok) {
        const globalData = await globalRes.json();
        const currentUsed = globalData?.slots?.usedSlots ?? 0;
        const patchRes = await fetch(`${payloadUrl}/api/globals/landing-page`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            slots: {
              totalSlots: globalData?.slots?.totalSlots ?? 10,
              usedSlots: currentUsed + 1,
            },
          }),
        });
        if (patchRes.ok) {
          console.log(`[Stripe Webhook] Sloty zaktualizowane: ${currentUsed} → ${currentUsed + 1} ✓`);
        } else {
          console.warn('[Stripe Webhook] Błąd aktualizacji slotów:', await patchRes.text());
        }
      }
    } catch (e) {
      console.error('[Stripe Webhook] Błąd połączenia z Payload:', e);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    console.log(`[Stripe Webhook] Subskrypcja anulowana: ${subscription.id}`);
    // Tu można zaktualizować status w Payload CMS na 'cancelled'
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
