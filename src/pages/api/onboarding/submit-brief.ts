import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import PDFDocument from 'pdfkit';

export const prerender = false;

async function generateBriefPdf(brief: Record<string, any>, order: Record<string, any>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const cyan = '#0ceaed';
    const purple = '#a855f7';
    const dark = '#0a0a0f';
    const gray = '#64748b';

    // Background
    doc.rect(0, 0, 595, 842).fill(dark);

    // Header
    doc.fontSize(8).fillColor(cyan).font('Helvetica')
      .text('NEXUS AGENT v2.4 · BRIEF WDROŻENIOWY · POUFNE', 50, 40, { align: 'center' });

    doc.moveDown(0.5);
    doc.fontSize(22).fillColor('#ffffff').font('Helvetica-Bold')
      .text('BRIEF WDROŻENIOWY', { align: 'center' });
    doc.fontSize(14).fillColor(purple)
      .text(brief.companyName?.toUpperCase() || 'KLIENT', { align: 'center' });

    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(purple).lineWidth(1).stroke();
    doc.moveDown(1);

    const section = (title: string) => {
      doc.moveDown(0.8);
      doc.fontSize(8).fillColor(cyan).font('Helvetica')
        .text(title.toUpperCase(), { characterSpacing: 2 });
      doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).strokeColor('#1e293b').lineWidth(0.5).stroke();
      doc.moveDown(0.5);
    };

    const field = (label: string, value: string | undefined | null) => {
      if (!value) return;
      doc.fontSize(8).fillColor(gray).font('Helvetica').text(label + ':', { continued: false });
      doc.fontSize(10).fillColor('#e2e8f0').font('Helvetica').text(value, { indent: 10 });
      doc.moveDown(0.4);
    };

    // Dane ogólne
    section('Dane Ogólne');
    field('Firma', brief.companyName);
    field('Branża', brief.industry);
    field('Nadawca', brief.senderName);
    field('Strona WWW', brief.websiteUrl);

    // Plan
    section('Plan Subskrypcji');
    field('Dzienny limit wysyłki', `${order.dailyLimit} maili / dzień`);
    field('Koszt miesięczny', `${order.monthlyAmount?.toLocaleString('pl-PL')} PLN / miesiąc`);
    field('Tryb działania agenta', brief.actionMode === 'auto_send' ? 'Auto Send' : 'Save to Drafts');

    // Mózg AI
    section('Konfiguracja AI');
    field('Cel kampanii', brief.campaignGoal);
    field('Propozycja wartości', brief.valueProposition);
    field('Idealny profil klienta (ICP)', brief.idealCustomerProfile);
    field('Ton głosu', brief.toneOfVoice);
    field('Ograniczenia', brief.negativeConstraints);
    field('Case Studies', brief.caseStudies);

    // Uwierzytelnienie
    section('Metoda Uwierzytelnienia Poczty');
    const authLabels: Record<string, string> = {
      nexus_lookalike_domain: 'NEXUS Infrastructure (domena lookalike)',
      oauth: 'Google / Microsoft OAuth',
      imap_encrypted_vault: 'IMAP Encrypted Vault (GCP KMS)',
    };
    field('Metoda', authLabels[brief.authMethod] || brief.authMethod);
    if (brief.authMethod === 'nexus_lookalike_domain' && brief.requestedDomain) {
      field('Żądana domena', brief.requestedDomain);
    }
    if (brief.authMethod === 'imap_encrypted_vault') {
      field('IMAP Host', brief.imapHost);
      field('IMAP Port', brief.imapPort);
      field('IMAP Użytkownik', brief.imapUser);
      field('Hasło IMAP', '[Zabezpieczono w Google Cloud KMS – brak dostępu]');
    }

    // Ustawienia
    section('Ustawienia Systemu');
    field('Warm-up domenowy', brief.warmupStrategy ? 'Włączony (zalecane)' : 'Wyłączony');
    field('Auto-generuj stopkę', brief.autoGenerateSignature ? 'Tak' : 'Nie');

    // Footer
    doc.fontSize(7).fillColor('#1e293b')
      .text(
        `Wygenerowano: ${new Date().toLocaleString('pl-PL')} · NEXUS AGENT · nexusagent.pl`,
        50, 800, { align: 'center' }
      );

    doc.end();
  });
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { token, orderId, briefData, briefId: existingBriefId, mode } = body;

  if (!token || !orderId || !briefData) {
    return new Response(JSON.stringify({ error: 'Niekompletne dane' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const payloadUrl = import.meta.env.PAYLOAD_URL || 'http://127.0.0.1:3000';
  const resendKey = import.meta.env.RESEND_API_KEY;
  const siteUrl = import.meta.env.SITE_URL || 'https://nexusagent.pl';
  const apiKey = import.meta.env.PAYLOAD_API_KEY;
  const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) authHeaders['Authorization'] = `users API-Key ${apiKey}`;

  try {
    // Zweryfikuj token – ostatni raz
    const tokenField = mode === 'edit' ? 'editToken' : 'onboardingToken';
    const orderCheckRes = await fetch(
      `${payloadUrl}/api/orders?where[${tokenField}][equals]=${encodeURIComponent(token)}&limit=1`,
      { headers: authHeaders }
    );
    const orderCheck = await orderCheckRes.json();

    if (!orderCheck.docs?.length || String(orderCheck.docs[0].id) !== String(orderId)) {
      return new Response(JSON.stringify({ error: 'Nieprawidłowy token lub zamówienie' }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      });
    }

    const order = orderCheck.docs[0];

    let briefId = existingBriefId as string | undefined;

    // Sanityzacja briefData – usuń pola, które mogą zepsuć zapis Payload CMS przy operacji PATCH/POST
    const sanitized = { ...briefData } as Record<string, unknown>;
    
    // Lista pól zarządzanych wewnętrznie przez CMS:
    const fieldsToDrop = [
      'id', 'createdAt', 'updatedAt', 'globalType', 
      '_status', '_isTitle', '_magic', 'sizes', 
      'filename', 'mimeType', 'filesize', 'url'
    ];
    
    for (const field of fieldsToDrop) {
      if (field in sanitized) {
        delete sanitized[field];
      }
    }

    // Specyficzne traktowanie hasła IMAP zabezpieczanego w Cloud KMS (jeśli jest to pusta wartość lub "przedszyfrowany" marker - zignoruj)
    const placeholder = '[ZASZYFROWANE PRZEZ GOOGLE KMS]';
    if (sanitized.imapPassword === placeholder || !String(sanitized.imapPassword || '').trim()) {
      delete sanitized.imapPassword;
    }

    // Tryb edycji – aktualizujemy istniejący brief
    if (mode === 'edit') {
      if (!briefId || !order.brief) {
        return new Response(JSON.stringify({ error: 'Brak istniejącego briefu do edycji.' }), {
          status: 409, headers: { 'Content-Type': 'application/json' },
        });
      }

      const patchBriefRes = await fetch(`${payloadUrl}/api/briefs/${briefId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify(sanitized),
      });

      if (!patchBriefRes.ok) {
        const errText = await patchBriefRes.text();
        console.error('[submit-brief] Błąd edycji Brief:', errText);
        return new Response(JSON.stringify({
          error: 'Błąd zapisu briefu',
          details: errText.slice(0, 300),
        }), {
          status: 500, headers: { 'Content-Type': 'application/json' },
        });
      }

      console.log(`[submit-brief] Brief ${briefId} zaktualizowany (edycja) ✓`);
    } else {
      // Pierwsze wypełnienie – utwórz nowy Brief
      if (order.brief) {
        return new Response(JSON.stringify({ error: 'Ten formularz został już wypełniony.' }), {
          status: 410, headers: { 'Content-Type': 'application/json' },
        });
      }

      const briefRes = await fetch(`${payloadUrl}/api/briefs`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(sanitized),
      });

      if (!briefRes.ok) {
        const errText = await briefRes.text();
        console.error('[submit-brief] Błąd tworzenia Brief:', errText);
        return new Response(JSON.stringify({ error: 'Błąd zapisu briefu' }), {
          status: 500, headers: { 'Content-Type': 'application/json' },
        });
      }

      const briefDoc = await briefRes.json();
      briefId = briefDoc.doc?.id || briefDoc.id;

      // BURN AFTER READING: powiąż Brief z Order i zablokuj token onboardingowy
      await fetch(`${payloadUrl}/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: briefId,
          onboardingToken: null, // unieważnij token
        }),
      });

      console.log(`[submit-brief] Brief ${briefId} zapisany i token unieważniony ✓`);
    }

    // Generuj PDF
    const pdfBuffer = await generateBriefPdf(briefData, order);

    // Wyślij email z PDF przez Resend
    if (resendKey && order.customerEmail) {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: 'NEXUS Agent <onboarding@nexusagent.pl>',
        to: order.customerEmail,
        subject: 'NEXUS Agent – Twój Brief Wdrożeniowy (potwierdzenie)',
        html: `
          <div style="background:#050508;padding:40px;font-family:monospace;color:#e2e8f0;border-radius:16px;">
            <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#0ceaed;margin-bottom:16px;">NEXUS AGENT – POTWIERDZENIE KONFIGURACJI</div>
            <h2 style="color:#fff;font-size:20px;margin:0 0 16px;">Brief wdrożeniowy otrzymany.</h2>
            <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin-bottom:24px;">
              Twój brief wdrożeniowy został zapisany i przekazany do naszego systemu.
              W ciągu <strong style="color:#fff;">24-48h</strong> NEXUS zostanie skonfigurowany pod Twój biznes.
            </p>
            <div style="background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.3);border-radius:12px;padding:16px;margin-bottom:24px;">
              <div style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#a855f7;margin-bottom:8px;">Co dalej?</div>
              <div style="font-size:13px;color:#cbd5e1;line-height:1.8;">
                1. Inicjalizacja agenta (24-48h)<br/>
                2. Konfiguracja poczty wychodzącej<br/>
                3. NEXUS startuje kampanię<br/>
                4. Raport co 3 dni na Twój email
              </div>
            </div>
            <p style="color:#64748b;font-size:12px;">
              W załączniku znajdziesz PDF z podsumowaniem Twojego profilu konfiguracyjnego.
            </p>
          </div>
        `,
        attachments: [
          {
            filename: `nexus-brief-${briefData.companyName?.toLowerCase().replace(/\s+/g, '-') || 'onboarding'}.pdf`,
            content: pdfBuffer.toString('base64'),
          },
        ],
      });

      console.log(`[submit-brief] Email z PDF wysłany na ${order.customerEmail} ✓`);
    }

    return new Response(JSON.stringify({ success: true, briefId }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[submit-brief] Error:', err);
    return new Response(JSON.stringify({ error: 'Błąd serwera' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
