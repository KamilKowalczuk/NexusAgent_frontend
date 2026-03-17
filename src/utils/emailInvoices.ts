import { Resend } from 'resend';

function buildInvoiceEmail(params: {
  customerEmail: string;
  orderNumber: string;
  serviceName: string;
  amountGross: number;
}): { subject: string; html: string } {
  const { customerEmail, orderNumber, serviceName, amountGross } = params;

  return {
    subject: `NEXUS Agent – Faktura VAT do Zamówienia ${orderNumber}`,
    html: `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NEXUS Agent – Faktura Dokumentowa</title>
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
              <div style="font-family:monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#0ceaed;margin-bottom:8px;">Dział Księgowości i Rozliczeń</div>
              <div style="font-size:28px;font-weight:900;text-transform:uppercase;letter-spacing:-0.02em;color:#fff;">Faktura VAT</div>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td style="padding:40px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:24px;margin-top:16px;">

              <div style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.2em;color:#0ceaed;margin-bottom:16px;">Dokument Wygenerowany Systemowo</div>

              <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;text-transform:uppercase;letter-spacing:-0.02em;color:#fff;line-height:1.2;">
                Odnowienie usług.<br/>
                <span style="color:#0ceaed;">Faktura w załączeniu.</span>
              </h1>

              <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.6;">
                Dziękujemy za kontynuowanie korzystania z technologii <strong>NEXUS Agent</strong>. 
                W załączeniu do tej wiadomości znajdziesz elektroniczną kopię faktury VAT za opłaconą usługę (format PDF).
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:20px;margin-bottom:24px;">
                <tr>
                  <td style="padding:8px 16px;border-bottom:1px solid rgba(255,255,255,0.05);">
                    <span style="font-size:10px;font-family:monospace;text-transform:uppercase;letter-spacing:0.15em;color:#64748b;">Opłacona Usługa</span><br/>
                    <span style="font-size:16px;font-weight:700;color:#fff;">${serviceName}</span>
                  </td>
                  <td style="padding:8px 16px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:right;">
                    <span style="font-size:10px;font-family:monospace;text-transform:uppercase;letter-spacing:0.15em;color:#64748b;">Opłacono Kwotę</span><br/>
                    <span style="font-size:18px;font-weight:700;color:#a855f7;">${amountGross.toLocaleString('pl-PL')} PLN</span>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:8px 16px;">
                    <span style="font-size:10px;font-family:monospace;text-transform:uppercase;letter-spacing:0.15em;color:#64748b;">Status Rachunku</span><br/>
                    <span style="font-size:14px;font-weight:600;color:#22c55e;">● Opłacono wg dyspozycji Stripe</span>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(12,234,237,0.04);border:1px solid rgba(12,234,237,0.15);border-radius:12px;padding:16px;margin-bottom:24px;">
                <tr>
                  <td>
                    <div style="font-size:10px;font-family:monospace;text-transform:uppercase;letter-spacing:0.15em;color:#0ceaed;margin-bottom:6px;">📄 Zamówienie / Referencja</div>
                    <div style="font-size:20px;font-weight:800;font-family:monospace;color:#fff;letter-spacing:0.1em;">${orderNumber}</div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <tr>
            <td style="padding:24px 40px;text-align:center;">
              <div style="font-size:10px;font-family:monospace;text-transform:uppercase;letter-spacing:0.15em;color:#334155;">
                NEXUS AGENT v2.4 · nexusagent.pl · Faktury: faktura@nexusagent.pl
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

/**
 * Wysyła maila "Faktura wygenerowana" w stylu Onboarding/Cold z załączonym PDF po przez Resend.
 */
export async function dispatchInvoiceEmailWithPdf(params: {
  toEmail: string;
  pdfBuffer: Buffer;
  orderNumber: string;
  serviceName: string;
  amountGross: number;
}): Promise<boolean> {
  const resendKey = import.meta.env.RESEND_API_KEY;

  if (!resendKey) {
    console.error('[Resend/Invoice] Brak RESEND_API_KEY w zmiennych środowiskowych.');
    return false;
  }

  const { toEmail, pdfBuffer, orderNumber, serviceName, amountGross } = params;
  const resend = new Resend(resendKey);

  const { subject, html } = buildInvoiceEmail({
    customerEmail: toEmail,
    orderNumber,
    serviceName,
    amountGross,
  });

  try {
    const emailResult = await resend.emails.send({
      from: 'NEXUS Agent <faktura@nexusagent.pl>',
      to: toEmail,
      subject,
      html,
      attachments: [
        {
          filename: `Faktura-Nexus-Agent-${orderNumber}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (emailResult.error) {
      console.error('[Resend/Invoice] Błąd wysyłki e-mailem:', emailResult.error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Resend/Invoice] Nieoczekiwany wyjątek', err);
    return false;
  }
}
