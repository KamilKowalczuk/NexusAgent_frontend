import type { Context } from '@netlify/edge-functions';

export default async (request: Request, context: Context) => {
    const response = await context.next();
    const headers = new Headers(response.headers);

    const nonce = headers.get('X-Page-Nonce');

    // Astro + Svelte wymagają unsafe-inline do poprawnej hydracji
    const scriptSrc = nonce
        ? `'self' 'nonce-${nonce}' 'unsafe-inline' 'wasm-unsafe-eval' 'unsafe-eval'`
        : `'self' 'unsafe-inline' 'wasm-unsafe-eval' 'unsafe-eval'`;

    // Czy jesteśmy w trybie GTM Preview/Debug?
    const url = new URL(request.url);
    const isGtmPreview =
        url.searchParams.has('gtm_debug') ||
        url.searchParams.has('gtm_auth') ||
        url.searchParams.has('gtm_preview');

    // Zaufane domeny dla skryptów (GTM, GA4, Stripe)
    const trustedScriptDomains = [
        'https://www.googletagmanager.com',
        'https://www.google-analytics.com',
        'https://analytics.google.com',
        'https://js.stripe.com',             // Stripe.js
        'https://cdn.jsdelivr.net',          // Ewentualne CDN bibliotek
    ].join(' ');

    // connect-src — API backendu (Payload CMS) + Stripe + Analytics
    const connectSrc = [
        "'self'",
        'https://www.googletagmanager.com',
        'https://www.google-analytics.com',
        'https://*.google-analytics.com',
        'https://stats.g.doubleclick.net',
        'https://api.stripe.com',            // Stripe API calls
        'https://*.stripe.com',
        // Backend Payload — ustaw poprawną domenę produkcyjną w zmiennych środowiskowych Netlify
        // np. https://backend.agentnexus.pl lub adres Railway/Render
        'http://localhost:3000',             // Backend lokalny (dev)
        'http://localhost:4321',             // Frontend lokalny (dev)
    ].join(' ');

    // style-src
    const styleSrc = [
        "'self'",
        "'unsafe-inline'",
        'https://fonts.googleapis.com',
        'https://fonts.gstatic.com',
        ...(isGtmPreview ? ['https://www.googletagmanager.com'] : []),
    ].join(' ');

    // img-src — bez Cloudinary, dodane domeny Stripe i Google
    const imgSrc = [
        "'self'",
        'data:',
        'blob:',
        'https://www.google-analytics.com',
        'https://analytics.google.com',
        'https://www.googletagmanager.com',
        'https://fonts.gstatic.com',
        'https://www.gstatic.com',
        'https://*.stripe.com',              // Stripe banki i ikony kart
        'http://localhost:3000',             // Obrazki z Payload (Media)
        'http://localhost:*',                // Dev
    ].join(' ');

    // frame-src — Stripe Checkout w iframe, GTM noscript, Google Maps jeśli potrzeba
    const frameSrc = [
        "'self'",
        'https://js.stripe.com',             // Stripe Payment Element / 3DS
        'https://hooks.stripe.com',          // Stripe 3DS challenge frames
        'https://www.googletagmanager.com',
    ].join(' ');

    // Złożenie CSP
    const csp = [
        "default-src 'self'",
        `script-src ${scriptSrc} ${trustedScriptDomains}`,
        `style-src ${styleSrc}`,
        `img-src ${imgSrc}`,
        "font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com",
        `connect-src ${connectSrc}`,
        `frame-src ${frameSrc}`,
        "worker-src 'self' blob: data:",
        "child-src 'self' blob: data:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self' https://checkout.stripe.com",
        "manifest-src 'self'",
        "media-src 'self'",
        'upgrade-insecure-requests',
    ].join('; ');

    // Security headers
    headers.set('Content-Security-Policy', csp);
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-XSS-Protection', '1; mode=block');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set(
        'Strict-Transport-Security',
        'max-age=63072000; includeSubDomains; preload'
    );

    // Permissions Policy — wyłączamy niepotrzebne urządzenia
    // payment=(self) zostawiamy bo używamy Stripe Checkout
    headers.set(
        'Permissions-Policy',
        [
            'geolocation=()',
            'microphone=()',
            'camera=()',
            'payment=(self)',                // Stripe wymaga tego uprawnienia
            'usb=()',
            'magnetometer=()',
            'accelerometer=()',
            'gyroscope=()',
            'fullscreen=(self)',
            'display-capture=()',
            'clipboard-read=()',
            'clipboard-write=(self)',
        ].join(', ')
    );

    // Cross-Origin — unsafe-none dla Stripe Checkout (iframe z innej domeny)
    headers.set('Cross-Origin-Embedder-Policy', 'unsafe-none');
    headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups'); // Stripe otwiera popup w niektórych flywach
    headers.set('Cross-Origin-Resource-Policy', 'cross-origin');

    headers.delete('X-Page-Nonce');

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
};