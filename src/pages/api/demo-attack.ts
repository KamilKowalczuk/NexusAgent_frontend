import type { APIRoute } from 'astro';
import { streamText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

export const prerender = false;

const google = createGoogleGenerativeAI({
  apiKey: import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '',
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    console.log('[API Demo] Received body:', body);

    let rawUrl = body.url || body.prompt || '';
    const industry = body.industry || '';

    if (!rawUrl) {
      return new Response('Missing URL', { status: 400 });
    }

    // Prosta sanitacja i ujednolicenie URL dla scrapera
    rawUrl = rawUrl.replace(/[<>]/g, '').trim();
    if (!rawUrl.startsWith('http')) {
      rawUrl = `https://${rawUrl}`;
    }

    // 1. Firecrawl Scraping (Lite version)
    const firecrawlKey = import.meta.env.FIRECRAWL_API_KEY || process.env.FIRECRAWL_API_KEY;
    let scrapedMarkdown = "";

    if (firecrawlKey) {
      try {
        const firecrawlRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            url: rawUrl,
            formats: ["markdown"],
            onlyMainContent: true,
            timeout: 10000 // 10s timeout for demo
          })
        });

        if (firecrawlRes.ok) {
          const data = await firecrawlRes.json();
          scrapedMarkdown = data?.data?.markdown || "";
        } else {
          console.warn("[Demo] Firecrawl error", firecrawlRes.statusText);
        }
      } catch (e) {
        console.warn("[Demo] Firecrawl fetch error", e);
      }
    }

    if (!scrapedMarkdown) {
      scrapedMarkdown = `Firma z branży: ${industry || 'B2B'}. (Brak dostępu do strony lub brak klucza API do dema)`;
    }

    // Ograniczamy markdown żeby nie zapchać promptu w demie
    const truncatedMarkdown = scrapedMarkdown.slice(0, 15000);

    console.log('[API Demo] Starting Gemini streaming...');

    // 2. LLM Streaming 
    const result = streamText({
      model: google('gemini-2.0-flash'),
      system: `Jesteś agentem sprzedaży B2B firmy NEXUS Agent – platformy do automatyzacji pozyskiwania klientów.
Twoje zadanie: napisać hiper-spersonalizowany cold email OFERUJĄCY usługę NEXUS Agent firmie, którą właśnie przeanalizowałeś.

CO ROBI NEXUS AGENT:
- Autonomicznie skanuje strony firm i identyfikuje osoby decyzyjne
- Pisze spersonalizowane cold maile oparte na twardych faktach z researchu (case studies, stos technologiczny, wyzwania)
- Zastępuje dział SDR przy ułamku kosztów (1999 PLN/mc vs ~10 000 PLN/mc za handlowca)
- Działa 24/7, wysyła 1500+ spersonalizowanych wiadomości miesięcznie

ZASADY cold maila:
1. Zacznij od konkretnego obserwacji o FIRMIE KLIENTA (wyciągniętej z researchu) – pokaż że ich znasz.
2. Połącz to z problemem, który NEXUS Agent rozwiązuje (np. manualny research, generyczne maile, koszty SDR).
3. Złóż krótką, konkretną ofertę / CTA (np. "Pokażę Ci jak NEXUS działa na Twojej branży w 15 min").
4. Ton: ludzki, bezpośredni, nie korporacyjny. Bez placeholderów [Imię] – jeśli nie wiesz, zacznij od "Cześć,".
5. Max 4-5 zdań + Subject.
6. Branża klienta: ${industry || 'B2B'}.

Wygeneruj WYŁĄCZNIE:
Temat: [tytuł]

[treść maila]

Zero innych komentarzy, zero Markdown wokół wyniku.`,
      prompt: `Przeanalizuj dane ze strony prospekta: ${rawUrl}

Research ze strony:
${truncatedMarkdown}

Napisz cold email od NEXUS Agent DO tej firmy, oferując im naszą usługę automatyzacji sprzedaży B2B.`,
      temperature: 0.75,
    });

    return result.toTextStreamResponse();
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
