import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { verifySession } from '../../../utils/session';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const sessionCookie = cookies.get('nexus_sub_session')?.value;
  const secret = import.meta.env.PAYLOAD_API_KEY || 'fallback_dev_secret_unsecure_!!';

  const orderId = verifySession(sessionCookie, secret);
  
  if (!orderId) {
    return new Response(JSON.stringify({ error: 'Nieautoryzowany dostęp.' }), { status: 401 });
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
    // 1. Pobierz dane subskrypcji z Payloada
    const searchRes = await fetch(`${payloadUrl}/api/orders/${orderId}?depth=0`, { headers: authHeaders });
    
    if (!searchRes.ok) {
      return new Response(JSON.stringify({ error: 'Błąd połączenia z bazą.' }), { status: 500 });
    }

    const order = await searchRes.json();
    if (!order || !order.stripeSubscriptionId) {
      return new Response(JSON.stringify({ error: 'Brak aktywnej subskrypcji Stripe w zamówieniu.' }), { status: 400 });
    }

    if (order.subscriptionStatus === 'canceled') {
      return new Response(JSON.stringify({ error: 'Subskrypcja jest już anulowana.' }), { status: 400 });
    }

    // 2. Anuluj w Stripe API z zachowaniem okresu
    const stripeSecret = import.meta.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      return new Response(JSON.stringify({ error: 'Brak konfiguracji Stripe' }), { status: 500 });
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: '2026-02-25.clover',
    });

    const updatedSubscription = await stripe.subscriptions.update(
      order.stripeSubscriptionId,
      {
        cancel_at_period_end: true,
      }
    );

    // 3. Zaktualizuj status w Payload CMS
    const patchRes = await fetch(`${payloadUrl}/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ 
        subscriptionStatus: 'canceled',
        cancelAtDate: new Date(updatedSubscription.cancel_at! * 1000).toISOString(),
      }),
    });

    if (!patchRes.ok) {
      console.error('[cancel-subscription] Błąd synchronizacji anulowania bazy Payload:', patchRes.statusText);
      // Nie rzucamy bledu frontendowi, bo w Stripe juz wylaczono, a Webhook ostatecznie to dogra
    }

    return new Response(JSON.stringify({
      success: true,
      canceledAt: new Date(updatedSubscription.cancel_at! * 1000).toISOString(),
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[cancel-subscription] Error:', err);
    return new Response(JSON.stringify({ error: 'Wystąpił nieoczekiwany błąd w API anulowania Stripe.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
