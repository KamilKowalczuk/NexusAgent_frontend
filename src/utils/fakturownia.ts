/**
 * fakturownia.ts – Klient API Fakturowni dla NEXUS Agent
 *
 * Zmienne środowiskowe wymagane:
 *   FAKTUROWNIA_API_TOKEN – token konta (np. vKEwWyPC5-clyh2kqnm1)
 *   FAKTUROWNIA_DOMAIN    – prefiks domeny (np. nobelion → nobelion.fakturownia.pl)
 */

export interface FakturowniaClientData {
  companyName: string;
  firstName?: string;
  lastName?: string;
  email: string;
  taxNo?: string;       // NIP
  street?: string;
  city?: string;
  postCode?: string;
  country?: string;
  phone?: string;
}

export interface FakturowniaInvoiceParams {
  client: FakturowniaClientData;
  orderNumber: string;
  serviceName: string;    // np. "NEXUS Agent – 20 maili/dzień – Plan miesięczny"
  totalPriceGross: number; // kwota brutto w PLN (np. 1999)
  taxRate?: number;        // stawka VAT % (domyślnie 23)
  issueDateOverride?: string; // YYYY-MM-DD, domyślnie dzisiaj
}

export interface FakturowniaInvoiceResult {
  id: number;
  viewUrl: string;   // Link do podglądu faktury
  pdfUrl: string;    // Link do pobrania PDF
}

// ─── Pomocniki ───────────────────────────────────────────────────────────────

function getBase(): string {
  const domain = import.meta.env.FAKTUROWNIA_DOMAIN;
  if (!domain) throw new Error('[Fakturownia] Brak FAKTUROWNIA_DOMAIN w .env');
  return `https://${domain}.fakturownia.pl`;
}

function getToken(): string {
  const token = import.meta.env.FAKTUROWNIA_API_TOKEN;
  if (!token) throw new Error('[Fakturownia] Brak FAKTUROWNIA_API_TOKEN w .env');
  return token;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ─── 1. Utwórz lub znajdź klienta ────────────────────────────────────────────

/**
 * Szuka klienta po NIP, a jeśli nie ma – po emailu.
 * Jeśli nie istnieje, tworzy nowy wpis. Zwraca Fakturownia client_id.
 */
export async function createOrFindClient(data: FakturowniaClientData): Promise<number | null> {
  const base = getBase();
  const token = getToken();

  try {
    // 1a. Szukaj po NIP (jeśli podany)
    if (data.taxNo) {
      const res = await fetch(
        `${base}/clients.json?tax_no=${encodeURIComponent(data.taxNo)}&api_token=${token}`,
      );
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          return list[0].id as number;
        }
      }
    }

    // 1b. Szukaj po emailu
    if (data.email) {
      const res = await fetch(
        `${base}/clients.json?email=${encodeURIComponent(data.email)}&api_token=${token}`,
      );
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          return list[0].id as number;
        }
      }
    }

    // 1c. Utwórz nowego klienta
    const createRes = await fetch(`${base}/clients.json`, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_token: token,
        client: {
          name: data.companyName || `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim(),
          email: data.email,
          tax_no: data.taxNo || '',
          person: data.firstName && data.lastName ? `${data.firstName} ${data.lastName}` : '',
          phone: data.phone || '',
          street: data.street || '',
          city: data.city || '',
          post_code: data.postCode || '',
          country: data.country || 'PL',
        },
      }),
    });

    if (!createRes.ok) {
      console.error('[Fakturownia] createClient failed:', await createRes.text());
      return null;
    }

    const created = await createRes.json();
    return (created.id as number) || null;
  } catch (err) {
    console.error('[Fakturownia] createOrFindClient error:', err);
    return null;
  }
}

// ─── 2. Utwórz fakturę VAT ────────────────────────────────────────────────────

export async function createInvoice(params: FakturowniaInvoiceParams): Promise<FakturowniaInvoiceResult | null> {
  const base = getBase();
  const token = getToken();

  const today = params.issueDateOverride || todayISO();
  const paymentTo = addDays(7);
  const taxRate = params.taxRate ?? 23;

  const clientId = await createOrFindClient(params.client);

  const invoiceBody: Record<string, unknown> = {
    kind: 'vat',
    number: null,
    issue_date: today,
    sell_date: today,
    payment_to: paymentTo,
    oid: params.orderNumber,

    // Dane sprzedawcy (pobierane z ustawień konta Fakturowni)
    // Dane nabywcy
    ...(clientId
      ? { client_id: clientId }
      : {
          buyer_name: params.client.companyName,
          buyer_email: params.client.email,
          buyer_tax_no: params.client.taxNo || '',
          buyer_street: params.client.street || '',
          buyer_city: params.client.city || '',
          buyer_post_code: params.client.postCode || '',
          buyer_country: params.client.country || 'PL',
        }),

    positions: [
      {
        name: params.serviceName,
        quantity: 1,
        tax: taxRate,
        total_price_gross: params.totalPriceGross,
      },
    ],
  };

  try {
    const res = await fetch(`${base}/invoices.json`, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_token: token, invoice: invoiceBody }),
    });

    if (!res.ok) {
      console.error('[Fakturownia] createInvoice failed:', res.status, await res.text());
      return null;
    }

    const invoice = await res.json();
    const invoiceId = invoice.id as number;

    return {
      id: invoiceId,
      viewUrl: `${base}/invoices/${invoiceId}`,
      pdfUrl: `${base}/invoices/${invoiceId}.pdf?api_token=${token}`,
    };
  } catch (err) {
    console.error('[Fakturownia] createInvoice error:', err);
    return null;
  }
}

// ─── 3. Wyślij fakturę emailem ────────────────────────────────────────────────

export async function sendInvoiceByEmail(invoiceId: number): Promise<boolean> {
  const base = getBase();
  const token = getToken();

  try {
    const res = await fetch(
      `${base}/invoices/${invoiceId}/send_by_email.json?api_token=${token}`,
      { method: 'POST' },
    );

    if (!res.ok) {
      console.error('[Fakturownia] sendInvoiceByEmail failed:', res.status, await res.text());
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Fakturownia] sendInvoiceByEmail error:', err);
    return false;
  }
}
