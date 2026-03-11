import type { APIRoute } from 'astro';
import { Resend } from 'resend';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const resendKey = import.meta.env.RESEND_API_KEY || process.env.RESEND_API_KEY;
    
    if (!resendKey) {
      console.error('[API Contact] Brak klucza RESEND_API_KEY');
      return new Response(
        JSON.stringify({ error: 'Błąd konfiguracji serwera (brak klucza API).' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const resend = new Resend(resendKey);
    const body = await request.json();

    // Honeypot check (jeśli bot_field jest wypełnione, to bot)
    if (body.bot_field) {
      console.log('[API Contact] Odrzucono przez honeypot');
      return new Response(
        JSON.stringify({ error: 'Zgłoszenie odrzucone (Honeypot).' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { name, company, nip, phone, email, message, privacyConsent } = body;

    // Walidacja podstawowa na backendzie
    if (!name || !email || !phone || !message || !privacyConsent) {
      return new Response(
        JSON.stringify({ error: 'Brakujące pola wymagane.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Odbiorca maila (Twój adres)
    const toEmail = import.meta.env.CONTACT_EMAIL || process.env.CONTACT_EMAIL || 'kontakt@nexusagent.pl';

    // Wysyłka przez Resend
    const { data, error } = await resend.emails.send({
      from: 'NEXUS System <onboarding@nexusagent.pl>', // Musi być zweryfikowana domena w Resend!
      to: [toEmail],
      replyTo: email,
      subject: `[NEXUS LEAD] Nowe zgłoszenie od: ${name} ${company ? `(${company})` : ''}`,
      html: `
        <h2>Nowy lead z formularza NEXUS</h2>
        <p><strong>Imię i Nazwisko:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Telefon:</strong> ${phone}</p>
        <p><strong>Firma:</strong> ${company || 'Brak'}</p>
        <p><strong>NIP:</strong> ${nip || 'Brak'}</p>
        <p><strong>Zgoda na politykę:</strong> ${privacyConsent ? 'TAK' : 'NIE'}</p>
        <hr />
        <h3>Wiadomość:</h3>
        <p style="white-space: pre-wrap;">${message}</p>
      `,
    });

    if (error) {
      console.error('[API Contact] Resend Error:', error);
      return new Response(
        JSON.stringify({ error: `Błąd wysyłki: ${error.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: data?.id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[API Contact] Catch Error:', err);
    return new Response(
      JSON.stringify({ error: 'Wewnętrzny błąd serwera. Spróbuj ponownie.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
