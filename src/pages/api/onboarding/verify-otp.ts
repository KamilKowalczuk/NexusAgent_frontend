import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const token = body.token as string | undefined;
  const otp = body.otp as string | undefined;

  if (!token || !otp) {
    return new Response(JSON.stringify({ error: 'Brak tokenu lub kodu OTP' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const payloadUrl = import.meta.env.PAYLOAD_URL || 'http://127.0.0.1:3000';

  // Autoryzacja z API Key
  const apiKey = import.meta.env.PAYLOAD_API_KEY;
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    authHeaders['Authorization'] = `users API-Key ${apiKey}`;
  }

  let finalMode: 'onboarding' | 'edit' = 'onboarding';
  let order: any = null;

  try {
    // ─── AUTO-DETEKCJA trybu po tokenie ───────────────────────────────────
    // Najpierw szukamy w onboardingToken
    const searchResOnboarding = await fetch(
      `${payloadUrl}/api/orders?where[onboardingToken][equals]=${encodeURIComponent(token)}&limit=1&depth=0`,
      { headers: authHeaders }
    );
    if (searchResOnboarding.ok) {
      const dataOnboarding = await searchResOnboarding.json();
      if (dataOnboarding.docs?.length > 0) {
        finalMode = 'onboarding';
        order = dataOnboarding.docs[0];
      }
    }

    // Jeśli nie znaleziono w onboardingToken, szukamy w editToken
    // UWAGA: depth=2 — Payload zagnieżdźi obiekt Brief inline w order.brief
    if (!order) {
      const searchResEdit = await fetch(
        `${payloadUrl}/api/orders?where[editToken][equals]=${encodeURIComponent(token)}&limit=1&depth=2`,
        { headers: authHeaders }
      );
      if (searchResEdit.ok) {
        const dataEdit = await searchResEdit.json();
        if (dataEdit.docs?.length > 0) {
          finalMode = 'edit';
          order = dataEdit.docs[0];
        }
      }
    }

    if (!order) {
      return new Response(JSON.stringify({ error: 'Nieprawidłowy token' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[verify-otp] Znaleziono order ${order.id}, mode=${finalMode}, brief=${JSON.stringify(order.brief)}`);

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
          headers: authHeaders,
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

    // ─── Jeżeli edycja, brief jest już zagnieżdżony w order.brief (depth=2) ──
    let briefData: Record<string, unknown> | null = null;
    let briefId: string | number | null = null;

    if (finalMode === 'edit' && order.brief) {
      if (typeof order.brief === 'object' && order.brief !== null) {
        briefId = order.brief.id;
        briefData = order.brief as Record<string, unknown>;
        console.log(`[verify-otp] Brief pobrany inline (depth=2), companyName=${briefData?.companyName}`);
      } else {
        briefId = order.brief;
        console.warn(`[verify-otp] Brief jest stringiem (${briefId}), depth=2 zablokowany przez Access Control. Wymuszam pobranie bezp...`);
        
        try {
          const forceAuthHeaders = {
            'Content-Type': 'application/json',
            ...(apiKey ? { 'Authorization': `users API-Key ${apiKey.trim()}` } : {})
          };

          const briefRes = await fetch(`${payloadUrl}/api/briefs/${briefId}?depth=0`, { 
            headers: forceAuthHeaders 
          });

          console.log(`[verify-otp] Fallback fetch status: ${briefRes.status}`);

          if (briefRes.ok) {
            const briefJson = await briefRes.json();
            briefData = (briefJson.doc || briefJson) as Record<string, unknown>;
            console.log(`[verify-otp] Fallback success: companyName=${briefData?.companyName}`);
          } else {
            console.error(`[verify-otp] Fallback fetch failed: ${await briefRes.text()}`);
          }
        } catch (e) {
          console.error(`[verify-otp] Błąd poczas force fetch briefa:`, e);
        }
      }
    }

    console.log(`[verify-otp] Odpowiedź: mode=${finalMode}, briefId=${briefId}, hasBrief=${!!briefData}`);

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
