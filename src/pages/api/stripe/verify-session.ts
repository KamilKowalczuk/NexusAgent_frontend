import type { APIRoute } from 'astro';
import Stripe from 'stripe';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const sessionId = url.searchParams.get('session_id');

  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: 'Brak session_id' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const stripeKey = import.meta.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return new Response(
      JSON.stringify({ error: 'Stripe nie skonfigurowany' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: '2026-02-25.clover' });

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'line_items'],
    });

    if (session.payment_status !== 'paid') {
      return new Response(
        JSON.stringify({ error: 'Płatność nie została potwierdzona' }),
        { status: 402, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const emailsPerDay = parseInt(session.metadata?.emailsPerDay || '20');
    const priceInPLN = parseInt(session.metadata?.priceInPLN || '1999');
    const customerEmail = session.customer_details?.email || '';
    const customerName = session.customer_details?.name || '';
    const customerPhone = (session as any).customer_details?.phone || '';

    // Custom fields (NIP, firma)
    const customFields = (session as any).custom_fields || [];
    const nipField = customFields.find((f: any) => f.key === 'nip');
    const companyField = customFields.find((f: any) => f.key === 'company_name');

    const billingNip = nipField?.text?.value || '';
    const billingCompanyName = companyField?.text?.value || '';

    // Adres rozliczeniowy
    const address = session.customer_details?.address;
    const billingStreet = [address?.line1, address?.line2].filter(Boolean).join(', ') || '';
    const billingCity = address?.city || '';
    const billingPostalCode = address?.postal_code || '';
    const billingCountry = address?.country || 'PL';

    // ─── Payload: pobierz orderNumber + obsłuż slot increment ─────────────
    let orderNumber = '';
    try {
      const payloadUrl = import.meta.env.PAYLOAD_URL || 'http://127.0.0.1:3000';
      const apiKey = import.meta.env.PAYLOAD_API_KEY;
      const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) authHeaders['Authorization'] = `users API-Key ${apiKey}`;

      // Sprawdź czy order już istnieje dla tego klienta
      const orderRes = await fetch(
        `${payloadUrl}/api/orders?where[customerEmail][equals]=${encodeURIComponent(customerEmail)}&limit=1&sort=-createdAt`,
        { headers: authHeaders }
      );

      if (orderRes.ok) {
        const orderData = await orderRes.json();
        const existingOrder = orderData.docs?.[0];
        orderNumber = existingOrder?.orderNumber || '';

        // ─── Slot increment (tylko jeśli webhook jeszcze nie stworzył zamówienia) ─
        // Jeśli order istnieje → webhook zdążył i już zinkrementował slot → SKIP
        // Jeśli order nie istnieje → webhook jeszcze nie zadziałał → my inkrementujemy
        if (!existingOrder) {
          try {
            const globalRes = await fetch(`${payloadUrl}/api/globals/landing-page?depth=0`, {
              headers: authHeaders,
            });
            if (globalRes.ok) {
              const globalData = await globalRes.json();
              const currentUsed = globalData?.slots?.usedSlots ?? 0;
              await fetch(`${payloadUrl}/api/globals/landing-page`, {
                method: 'PATCH',
                headers: authHeaders,
                body: JSON.stringify({
                  slots: {
                    totalSlots: globalData?.slots?.totalSlots ?? 10,
                    usedSlots: currentUsed + 1,
                  },
                }),
              });
              console.log(`[verify-session] Slot zinkrementowany (fallback — webhook nie zdążył). usedSlots: ${currentUsed} → ${currentUsed + 1}`);
            }
          } catch (slotErr) {
            console.warn('[verify-session] Błąd inkrementu slotu:', slotErr);
          }
        }
      }
    } catch (e) {
      console.warn('[verify-session] Nie udało się obsłużyć Payload:', e);
    }

    return new Response(
      JSON.stringify({
        valid: true,
        emailsPerDay,
        priceInPLN,
        customerEmail,
        customerName,
        customerPhone,
        billingCompanyName,
        billingNip,
        billingStreet,
        billingCity,
        billingPostalCode,
        billingCountry,
        orderNumber,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[Stripe Verify] Error:', err.message);
    return new Response(
      JSON.stringify({ error: 'Nieprawidłowa sesja płatności' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
