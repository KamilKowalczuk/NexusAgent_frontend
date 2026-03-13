import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get('token');
  const mode = url.searchParams.get('mode') || 'onboarding';

  if (!token) {
    return new Response(JSON.stringify({ valid: false, error: 'Brak tokenu' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const payloadUrl = import.meta.env.PAYLOAD_URL || 'http://127.0.0.1:3000';

  try {
    // TRYB 1: Onboarding (pierwsze wypełnienie briefu)
    if (mode !== 'edit') {
      const res = await fetch(
        `${payloadUrl}/api/orders?where[onboardingToken][equals]=${token}&limit=1&depth=1`,
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (!res.ok) {
        return new Response(JSON.stringify({ valid: false, error: 'Błąd bazy danych' }), {
          status: 500, headers: { 'Content-Type': 'application/json' },
        });
      }

      const data = await res.json();
      if (!data.docs?.length) {
        return new Response(JSON.stringify({ valid: false, error: 'Nieprawidłowy lub wygasły link' }), {
          status: 404, headers: { 'Content-Type': 'application/json' },
        });
      }

      const order = data.docs[0];

      // Sprawdź czy brief już wypełniony (burn after reading)
      if (order.brief) {
        return new Response(JSON.stringify({ valid: false, error: 'Ten link został już wykorzystany. Brief wdrożeniowy jest w trakcie realizacji.' }), {
          status: 410, headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        valid: true,
        mode: 'onboarding',
        orderId: order.id,
        customerEmail: order.customerEmail,
        dailyLimit: order.dailyLimit,
        monthlyAmount: order.monthlyAmount,
      }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    // TRYB 2: Edycja istniejącego briefu
    const editRes = await fetch(
      `${payloadUrl}/api/orders?where[editToken][equals]=${token}&limit=1&depth=2`,
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (!editRes.ok) {
      return new Response(JSON.stringify({ valid: false, error: 'Błąd bazy danych' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    const editData = await editRes.json();
    if (!editData.docs?.length) {
      return new Response(JSON.stringify({ valid: false, error: 'Nieprawidłowy lub wygasły link edycji' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    const order = editData.docs[0];

    if (!order.brief) {
      return new Response(JSON.stringify({ valid: false, error: 'Ten link nie ma jeszcze podpiętego briefu do edycji.' }), {
        status: 409, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      valid: true,
      mode: 'edit',
      orderId: order.id,
      customerEmail: order.customerEmail,
      dailyLimit: order.dailyLimit,
      monthlyAmount: order.monthlyAmount,
      briefId: typeof order.brief === 'object' ? order.brief.id : order.brief,
      brief: order.brief,
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[verify-token] Error:', err);
    return new Response(JSON.stringify({ valid: false, error: 'Błąd serwera' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
