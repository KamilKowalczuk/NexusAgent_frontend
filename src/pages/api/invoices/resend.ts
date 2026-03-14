import type { APIRoute } from 'astro';
import { sendInvoiceByEmail } from '../../../utils/fakturownia';

export const prerender = false;

/**
 * POST /api/invoices/resend
 * Body: { fakturowniaInvoiceId: string }
 * Ponownie wysyła fakturę emailem przez Fakturownia API.
 */
export const POST: APIRoute = async ({ request }) => {
  let body: { fakturowniaInvoiceId?: string } = {};

  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Nieprawidłowy JSON' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const { fakturowniaInvoiceId } = body;

  if (!fakturowniaInvoiceId || fakturowniaInvoiceId.trim() === '') {
    return new Response(
      JSON.stringify({ error: 'Brak fakturowniaInvoiceId' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const invoiceIdNum = parseInt(fakturowniaInvoiceId, 10);
  if (isNaN(invoiceIdNum) || invoiceIdNum <= 0) {
    return new Response(
      JSON.stringify({ error: 'Nieprawidłowy fakturowniaInvoiceId (musi być liczbą > 0)' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const success = await sendInvoiceByEmail(invoiceIdNum);

  if (!success) {
    return new Response(
      JSON.stringify({ error: 'Fakturownia zwróciła błąd podczas wysyłki – sprawdź logi serwera.' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: `Faktura ${fakturowniaInvoiceId} wysłana ponownie.` }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
