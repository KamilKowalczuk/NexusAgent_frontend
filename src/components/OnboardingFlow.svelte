<script lang="ts">
  interface Props {
    token: string;
  }
  let { token }: Props = $props();

  // ─── STAN GLOBALNY ────────────────────────────────────────────────────────
  type Stage = 'loading' | 'invalid' | 'used' | 'otp-email' | 'otp-verify' | 'brief' | 'success';
  let stage = $state<Stage>('loading');
  let errorMsg = $state('');

  // Dane zamówienia
  let orderId = $state('');
  let customerEmail = $state('');
  let dailyLimit = $state(20);
  let monthlyAmount = $state(1999);
  let briefId = $state<string | null>(null);
  let mode = $state<'onboarding' | 'edit'>('onboarding');

  // OTP
  let emailInput = $state('');
  let otpInput = $state('');
  let otpSending = $state(false);
  let otpVerifying = $state(false);

  // Brief
  let submitting = $state(false);
  let brief = $state({
    companyName: '',
    industry: '',
    senderName: '',
    websiteUrl: '',
    actionMode: 'save_to_drafts',
    campaignGoal: '',
    valueProposition: '',
    idealCustomerProfile: '',
    toneOfVoice: 'professional',
    negativeConstraints: '',
    caseStudies: '',
    signatureHtml: '',
    autoGenerateSignature: true,
    warmupStrategy: true,
    authMethod: 'nexus_lookalike_domain',
    requestedDomain: '',
    imapHost: '',
    imapPort: '993',
    imapUser: '',
    imapPassword: '',
  });

  // ─── INICJALIZACJA – weryfikacja tokenu ──────────────────────────────────
  $effect(() => {
    if (!token) { stage = 'invalid'; errorMsg = 'Brak tokenu w URL.'; return; }

    fetch(`/api/onboarding/verify-token?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (!data.valid) {
          if (data.error?.includes('już wykorzystany')) { stage = 'used'; }
          else { stage = 'invalid'; errorMsg = data.error || 'Nieprawidłowy link.'; }
          return;
        }
        orderId = data.orderId;
        customerEmail = data.customerEmail;
        dailyLimit = data.dailyLimit;
        monthlyAmount = data.monthlyAmount;
        // emailInput pozostaje pusty - wymóg zabezpieczenia, klient wpisuje go sam
        mode = data.mode === 'edit' ? 'edit' : 'onboarding';

        stage = 'otp-email';
      })
      .catch(() => { stage = 'invalid'; errorMsg = 'Błąd połączenia z serwerem.'; });
  });

  // ─── OTP – wyślij kod ────────────────────────────────────────────────────
  async function sendOtp() {
    otpSending = true; errorMsg = '';
    try {
      const res = await fetch('/api/onboarding/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email: emailInput, mode }),
      });
      const data = await res.json();
      if (!res.ok) { errorMsg = data.error || 'Błąd wysyłki OTP.'; return; }
      stage = 'otp-verify';
    } catch { errorMsg = 'Błąd połączenia.'; }
    finally { otpSending = false; }
  }

  // ─── OTP – weryfikuj kod ─────────────────────────────────────────────────
  async function verifyOtp() {
    otpVerifying = true; errorMsg = '';
    try {
      const res = await fetch('/api/onboarding/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, otp: otpInput }),
      });
      const data = await res.json();
      console.log('[OnboardingFlow] verify-otp response:', JSON.stringify(data, null, 2));

      if (!res.ok) { errorMsg = data.error || 'Błąd weryfikacji.'; return; }

      orderId = data.orderId;
      mode = data.mode === 'edit' ? 'edit' : 'onboarding';
      console.log('[OnboardingFlow] Detected mode:', mode, 'briefId:', data.briefId, 'hasBrief:', !!data.brief);

      // Przypisanie obiektu Brief dla formularza, jeśli backend zwrócił je jako odpowiedź OTP.
      if (mode === 'edit' && data.brief && typeof data.brief === 'object') {
        briefId = data.briefId ?? data.brief?.id ?? null;
        const b = data.brief;
        brief = {
          companyName: b.companyName ?? '',
          industry: b.industry ?? '',
          senderName: b.senderName ?? '',
          websiteUrl: b.websiteUrl ?? '',
          actionMode: b.actionMode ?? 'save_to_drafts',
          campaignGoal: b.campaignGoal ?? '',
          valueProposition: b.valueProposition ?? '',
          idealCustomerProfile: b.idealCustomerProfile ?? '',
          toneOfVoice: b.toneOfVoice ?? 'professional',
          negativeConstraints: b.negativeConstraints ?? '',
          caseStudies: b.caseStudies ?? '',
          signatureHtml: b.signatureHtml ?? '',
          autoGenerateSignature: !!b.autoGenerateSignature,
          warmupStrategy: b.warmupStrategy !== false,
          authMethod: b.authMethod ?? 'nexus_lookalike_domain',
          requestedDomain: b.requestedDomain ?? '',
          imapHost: b.imapHost ?? '',
          imapPort: b.imapPort ?? '993',
          imapUser: b.imapUser ?? '',
          imapPassword: '', // Nigdy nie prefilluj – hasło jest zawsze ukryte / KMS
        };
        console.log('[OnboardingFlow] Brief załadowany:', brief.companyName, brief.industry);
      }

      stage = 'brief';
    } catch { errorMsg = 'Błąd połączenia.'; }
    finally { otpVerifying = false; }
  }

  // ─── BRIEF – wyślij formularz ────────────────────────────────────────────
  async function submitBrief() {
    submitting = true; errorMsg = '';
    try {
      const res = await fetch('/api/onboarding/submit-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, orderId, briefData: brief, briefId, mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        errorMsg = data.details ? `${data.error}: ${data.details}` : (data.error || 'Błąd zapisu.');
        return;
      }
      stage = 'success';
    } catch { errorMsg = 'Błąd połączenia.'; }
    finally { submitting = false; }
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────
  const authOptions = [
    {
      value: 'nexus_lookalike_domain',
      label: 'NEXUS Infrastructure',
      desc: 'Tworzymy dla Ciebie domenę lookalike (np. twojaFirma-outreach.com). Konfigurujemy SPF, DKIM, DMARC. Zero pracy po Twojej stronie. Zalecane na start.',
      icon: 'rocket_launch',
    },
    {
      value: 'oauth',
      label: 'Google / Microsoft OAuth',
      desc: 'Autoryzujesz swoje konto Google Workspace lub Microsoft 365 jednym kliknięciem. Agent wysyła z Twojej domeny. Wymaga zatwierdzenia w panelu Google/MS.',
      icon: 'key',
    },
    {
      value: 'imap_encrypted_vault',
      label: 'IMAP Encrypted Vault',
      desc: 'Podajesz dane własnego serwera IMAP. Hasło zostaje natychmiast zaszyfrowane przez Google Cloud KMS. Nawet my nie mamy do niego dostępu. Maksymalna kontrola.',
      icon: 'shield_lock',
    },
  ];
</script>

<!-- ═══════════════ LOADING ═══════════════ -->
{#if stage === 'loading'}
  <div class="max-w-xl w-full text-center">
    <div class="rounded-3xl p-[1px] bg-gradient-to-b from-primary/40 to-primary/5">
      <div class="bg-black/90 rounded-3xl p-16 flex flex-col items-center gap-4">
        <span class="material-symbols-outlined text-5xl text-primary animate-spin">sync</span>
        <p class="font-mono text-sm text-slate-400 uppercase tracking-widest">Weryfikacja linku...</p>
      </div>
    </div>
  </div>

<!-- ═══════════════ INVALID TOKEN ═══════════════ -->
{:else if stage === 'invalid'}
  <div class="max-w-xl w-full text-center">
    <div class="rounded-3xl p-[1px] bg-gradient-to-b from-red-500/40 to-red-900/10">
      <div class="bg-black/90 rounded-3xl p-12 md:p-16">
        <span class="material-symbols-outlined text-5xl text-red-400 mb-6 block">link_off</span>
        <h1 class="font-display text-3xl font-bold uppercase tracking-tighter text-white mb-4">Nieprawidłowy link</h1>
        <p class="text-slate-400 text-sm mb-8">{errorMsg}</p>
        <a href="/" class="inline-flex items-center gap-2 border border-white/10 text-slate-400 font-mono text-[10px] uppercase tracking-widest px-8 py-4 rounded-full hover:border-primary/30 hover:text-primary transition-all">
          <span class="material-symbols-outlined text-sm">arrow_back</span> Wróć na stronę główną
        </a>
      </div>
    </div>
  </div>

<!-- ═══════════════ ALREADY USED (BURN AFTER READING) ═══════════════ -->
{:else if stage === 'used'}
  <div class="max-w-xl w-full text-center">
    <div class="rounded-3xl p-[1px] bg-gradient-to-b from-green-500/30 to-green-900/5">
      <div class="bg-black/90 rounded-3xl p-12 md:p-16">
        <span class="material-symbols-outlined text-5xl text-green-400 mb-6 block">check_circle</span>
        <div class="inline-block px-4 py-1.5 bg-green-500/10 border border-green-500/30 rounded-full text-[10px] font-mono text-green-400 uppercase tracking-widest mb-6">
          Konfiguracja zakończona
        </div>
        <h1 class="font-display text-3xl font-bold uppercase tracking-tighter text-white mb-4">
          Brief już wypełniony
        </h1>
        <p class="text-slate-400 text-sm leading-relaxed mb-8">
          Ten jednorazowy link wygasł po pierwszym użyciu. Twój brief wdrożeniowy jest już w naszym systemie.
          NEXUS zostanie uruchomiony w ciągu <strong class="text-white">24-48h</strong>.
        </p>
        <a href="/" class="inline-flex items-center gap-2 border border-white/10 text-slate-400 font-mono text-[10px] uppercase tracking-widest px-8 py-4 rounded-full hover:border-primary/30 hover:text-primary transition-all">
          <span class="material-symbols-outlined text-sm">arrow_back</span> Wróć na stronę główną
        </a>
      </div>
    </div>
  </div>

<!-- ═══════════════ ETAP 1A: PODAJ EMAIL ═══════════════ -->
{:else if stage === 'otp-email'}
  <div class="max-w-lg w-full">
    <div class="rounded-3xl p-[1px] bg-gradient-to-b from-primary/50 to-primary/10">
      <div class="bg-black/90 rounded-3xl p-10">
        <!-- Progress -->
        <div class="flex items-center gap-3 mb-8">
          <div class="flex-1 h-1 rounded-full bg-primary/60"></div>
          <div class="flex-1 h-1 rounded-full bg-white/10"></div>
        </div>

        <div class="inline-block px-3 py-1 bg-primary/10 border border-primary/30 rounded-full text-[10px] font-mono text-primary uppercase tracking-widest mb-6">
          Krok 1 z 2 · Weryfikacja tożsamości
        </div>

        <h2 class="font-display text-2xl font-bold uppercase tracking-tighter text-white mb-3">
          Potwierdź swój adres email
        </h2>
        <p class="text-slate-400 text-sm mb-8 leading-relaxed">
          Wyślemy 6-cyfrowy kod weryfikacyjny na Twój adres email, aby potwierdzić tożsamość przed wypełnieniem briefu.
        </p>

        <div class="space-y-4">
          <div>
            <label for="emailInput" class="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Adres email</label>
            <input
              id="emailInput"
              type="email"
              bind:value={emailInput}
              class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-primary/50 transition-colors"
              placeholder="twoj@email.pl"
              disabled={otpSending}
            />
          </div>

          {#if errorMsg}
            <p class="text-red-400 text-xs font-mono bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{errorMsg}</p>
          {/if}

          <button
            onclick={sendOtp}
            disabled={otpSending || !emailInput}
            class="w-full py-4 rounded-2xl font-display font-bold uppercase text-sm text-white transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style="background: linear-gradient(135deg, hsl(270,60%,45%), hsl(280,70%,55%)); box-shadow: 0 0 30px hsl(270,60%,30%);"
          >
            {#if otpSending}
              <span class="material-symbols-outlined animate-spin text-sm">sync</span>
              Wysyłanie kodu...
            {:else}
              <span class="material-symbols-outlined text-sm">send</span>
              Wyślij kod weryfikacyjny
            {/if}
          </button>
        </div>

        <!-- Security badge -->
        <div class="mt-6 flex items-center gap-2 text-xs text-slate-600 font-mono">
          <span class="material-symbols-outlined text-sm text-slate-600">shield</span>
          Weryfikacja 2FA · Kod ważny 10 minut
        </div>
      </div>
    </div>
  </div>

<!-- ═══════════════ ETAP 1B: WPISZ KOD OTP ═══════════════ -->
{:else if stage === 'otp-verify'}
  <div class="max-w-lg w-full">
    <div class="rounded-3xl p-[1px] bg-gradient-to-b from-primary/50 to-primary/10">
      <div class="bg-black/90 rounded-3xl p-10">
        <!-- Progress -->
        <div class="flex items-center gap-3 mb-8">
          <div class="flex-1 h-1 rounded-full bg-primary/60"></div>
          <div class="flex-1 h-1 rounded-full bg-white/10"></div>
        </div>

        <div class="inline-block px-3 py-1 bg-primary/10 border border-primary/30 rounded-full text-[10px] font-mono text-primary uppercase tracking-widest mb-6">
          Krok 1 z 2 · Weryfikacja OTP
        </div>

        <h2 class="font-display text-2xl font-bold uppercase tracking-tighter text-white mb-3">
          Wpisz kod z maila
        </h2>
        <p class="text-slate-400 text-sm mb-8">
          Wysłaliśmy 6-cyfrowy kod na <strong class="text-white">{emailInput}</strong>. Sprawdź skrzynkę (i spam).
        </p>

        <div class="space-y-4">
          <div>
            <label for="otpInput" class="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Kod OTP (6 cyfr)</label>
            <input
              id="otpInput"
              type="text"
              bind:value={otpInput}
              maxlength={6}
              class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white font-mono text-2xl text-center tracking-[0.5em] focus:outline-none focus:border-primary/50 transition-colors"
              placeholder="000000"
              disabled={otpVerifying}
            />
          </div>

          {#if errorMsg}
            <p class="text-red-400 text-xs font-mono bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{errorMsg}</p>
          {/if}

          <button
            onclick={verifyOtp}
            disabled={otpVerifying || otpInput.length !== 6}
            class="w-full py-4 rounded-2xl font-display font-bold uppercase text-sm text-white transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style="background: linear-gradient(135deg, hsl(270,60%,45%), hsl(280,70%,55%)); box-shadow: 0 0 30px hsl(270,60%,30%);"
          >
            {#if otpVerifying}
              <span class="material-symbols-outlined animate-spin text-sm">sync</span>
              Weryfikacja...
            {:else}
              <span class="material-symbols-outlined text-sm">verified</span>
              Zweryfikuj i przejdź dalej
            {/if}
          </button>

          <button
            onclick={() => { stage = 'otp-email'; errorMsg = ''; otpInput = ''; }}
            class="w-full py-3 text-slate-500 font-mono text-xs uppercase tracking-widest hover:text-slate-300 transition-colors"
          >
            ← Zmień adres email
          </button>
        </div>
      </div>
    </div>
  </div>

<!-- ═══════════════ ETAP 2: BRIEF WDROŻENIOWY ═══════════════ -->
{:else if stage === 'brief'}
  <div class="max-w-2xl w-full">
    <!-- Progress -->
    <div class="flex items-center gap-3 mb-6">
      <div class="flex-1 h-1 rounded-full bg-primary/60"></div>
      <div class="flex-1 h-1 rounded-full bg-primary/60"></div>
    </div>

    <div class="inline-block px-3 py-1 bg-primary/10 border border-primary/30 rounded-full text-[10px] font-mono text-primary uppercase tracking-widest mb-6">
      Krok 2 z 2 · Brief Wdrożeniowy
    </div>

    <h2 class="font-display text-3xl font-bold uppercase tracking-tighter text-white mb-2">
      Konfiguracja NEXUS
    </h2>
    <p class="text-slate-400 text-sm mb-8">
      Wypełnij formularz (~10 min). Na jego podstawie skonfigurujemy agenta pod Twój biznes.
      Po wysłaniu otrzymasz PDF z podsumowaniem na email.
    </p>

    <form onsubmit={(e) => { e.preventDefault(); submitBrief(); }}>
      <div class="space-y-6">

        <!-- DANE OGÓLNE -->
        <div class="rounded-2xl p-[1px] bg-gradient-to-b from-white/10 to-white/5">
          <div class="bg-black/80 rounded-2xl p-6">
            <h3 class="font-mono text-[10px] uppercase tracking-widest text-primary mb-5">01 · Dane Ogólne</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="companyName" class="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Nazwa Firmy *</label>
                <input id="companyName" type="text" bind:value={brief.companyName} required class="input-field" placeholder="Nexus Systems sp. z o.o." />
              </div>
              <div>
                <label for="industry" class="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Branża *</label>
                <input id="industry" type="text" bind:value={brief.industry} required class="input-field" placeholder="Software House / SaaS / Fintech..." />
              </div>
              <div>
                <label for="senderName" class="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Imię i Nazwisko Nadawcy *</label>
                <input id="senderName" type="text" bind:value={brief.senderName} required class="input-field" placeholder="Jan Kowalski" />
              </div>
              <div>
                <label for="websiteUrl" class="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Strona WWW</label>
                <input id="websiteUrl" type="url" bind:value={brief.websiteUrl} class="input-field" placeholder="https://twojastrona.pl" />
              </div>
            </div>
          </div>
        </div>

        <!-- USTAWIENIA KAMPANII -->
        <div class="rounded-2xl p-[1px] bg-gradient-to-b from-white/10 to-white/5">
          <div class="bg-black/80 rounded-2xl p-6">
            <h3 class="font-mono text-[10px] uppercase tracking-widest text-primary mb-5">02 · Tryb Działania</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              {#each [
                { value: 'save_to_drafts', label: 'Save to Drafts', desc: 'Każdy mail trafia do Twoich roboczych. Przeglądasz i zatwierdzasz. Zalecane na start.' },
                { value: 'auto_send', label: 'Auto Send', desc: 'Agent wysyła automatycznie bez Twojej ingerencji. Dla zaawansowanych po weryfikacji jakości.' },
              ] as mode}
                <button
                  type="button"
                  onclick={() => brief.actionMode = mode.value}
                  class="text-left p-4 rounded-xl border transition-all duration-200 {brief.actionMode === mode.value ? 'border-primary/50 bg-primary/10' : 'border-white/10 bg-white/3 hover:border-white/20'}"
                >
                  <div class="font-display font-bold text-sm text-white mb-1">{mode.label}</div>
                  <div class="text-slate-500 text-xs leading-relaxed">{mode.desc}</div>
                </button>
              {/each}
            </div>
          </div>
        </div>

        <!-- MÓZG AI -->
        <div class="rounded-2xl p-[1px] bg-gradient-to-b from-white/10 to-white/5">
          <div class="bg-black/80 rounded-2xl p-6">
            <h3 class="font-mono text-[10px] uppercase tracking-widest text-primary mb-5">03 · Konfiguracja AI</h3>
            <div class="space-y-4">
              <div>
                <label for="campaignGoal" class="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Cel Kampanii *</label>
                <textarea id="campaignGoal" bind:value={brief.campaignGoal} required rows={2} class="input-field resize-none" placeholder="Np. Umówić 5 demo tygodniowo z CTOs firm 50-200 os. z branży SaaS w Polsce i DACH."></textarea>
              </div>
              <div>
                <label for="valueProposition" class="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Propozycja Wartości *</label>
                <textarea id="valueProposition" bind:value={brief.valueProposition} required rows={2} class="input-field resize-none" placeholder="Dlaczego klient ma odpowiedzieć? Jaki problem rozwiązujesz? (1-2 zdania)"></textarea>
              </div>
              <div>
                <label for="idealCustomerProfile" class="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Idealny Profil Klienta (ICP) *</label>
                <textarea id="idealCustomerProfile" bind:value={brief.idealCustomerProfile} required rows={2} class="input-field resize-none" placeholder="Branża, wielkość firmy, kraj, stanowisko decydenta, inne kryteria..."></textarea>
              </div>
              <div>
                <label for="toneOfVoice" class="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Ton Głosu</label>
                <select id="toneOfVoice" bind:value={brief.toneOfVoice} class="input-field">
                  <option value="formal">Formalny / Korporacyjny</option>
                  <option value="professional">Profesjonalny / Partnerski</option>
                  <option value="direct">Bezpośredni / Konkretny</option>
                  <option value="technical">Techniczny / Ekspercki</option>
                </select>
              </div>
              <div>
                <label for="negativeConstraints" class="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Czego NEXUS NIE może robić</label>
                <textarea id="negativeConstraints" bind:value={brief.negativeConstraints} rows={2} class="input-field resize-none" placeholder="Np. Nie wspominaj o cenie. Nie pisz do firm poniżej 10 osób. Nie wymieniaj konkurencji X."></textarea>
              </div>
              <div>
                <label for="caseStudies" class="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Case Studies / Dowody Społeczne</label>
                <textarea id="caseStudies" bind:value={brief.caseStudies} rows={2} class="input-field resize-none" placeholder="Krótkie opisy sukcesów lub linki. Agent będzie się na nie powoływać w mailach."></textarea>
              </div>
            </div>
          </div>
        </div>

        <!-- METODA AUTH -->
        <div class="rounded-2xl p-[1px] bg-gradient-to-b from-white/10 to-white/5">
          <div class="bg-black/80 rounded-2xl p-6">
            <h3 class="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">04 · Metoda Uwierzytelnienia Poczty *</h3>
            <p class="text-slate-500 text-xs mb-5">Jak NEXUS będzie wysyłać maile w Twoim imieniu?</p>

            <div class="space-y-3 mb-6">
              {#each authOptions as opt}
                <button
                  type="button"
                  onclick={() => brief.authMethod = opt.value}
                  class="w-full text-left p-4 rounded-xl border transition-all duration-200 {brief.authMethod === opt.value ? 'border-primary/50 bg-primary/10' : 'border-white/10 bg-white/3 hover:border-white/20'}"
                >
                  <div class="flex items-center gap-3 mb-2">
                    <span class="material-symbols-outlined text-lg {brief.authMethod === opt.value ? 'text-primary' : 'text-slate-500'}">{opt.icon}</span>
                    <span class="font-display font-bold text-sm text-white">{opt.label}</span>
                    {#if opt.value === 'nexus_lookalike_domain'}
                      <span class="ml-auto text-[9px] font-mono text-green-400 border border-green-500/30 bg-green-500/10 px-2 py-0.5 rounded-full">Zalecane</span>
                    {/if}
                  </div>
                  <p class="text-slate-500 text-xs leading-relaxed pl-8">{opt.desc}</p>
                </button>
              {/each}
            </div>

            <!-- Dodatkowe pola dla nexus_lookalike_domain -->
            {#if brief.authMethod === 'nexus_lookalike_domain'}
              <div>
                <label for="requestedDomain" class="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Żądana Domena (opcjonalne)</label>
                <input id="requestedDomain" type="text" bind:value={brief.requestedDomain} class="input-field" placeholder="twojaFirma-reach.com (propozycja – finalny wybór po naszej analizie)" />
              </div>
            {/if}

            <!-- Dodatkowe pola dla IMAP -->
            {#if brief.authMethod === 'imap_encrypted_vault'}
              <div class="space-y-3 p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
                <div class="flex items-center gap-2 text-[10px] font-mono text-purple-400 uppercase tracking-widest">
                  <span class="material-symbols-outlined text-sm">lock</span>
                  Dane szyfrowane przez Google Cloud KMS – nikt nie ma do nich dostępu
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label for="imapHost" class="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">IMAP Host</label>
                    <input id="imapHost" type="text" bind:value={brief.imapHost} class="input-field" placeholder="mail.firma.pl" />
                  </div>
                  <div>
                    <label for="imapPort" class="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Port</label>
                    <input id="imapPort" type="text" bind:value={brief.imapPort} class="input-field" placeholder="993" />
                  </div>
                </div>
                <div>
                  <label for="imapUser" class="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Email / Login IMAP</label>
                  <input id="imapUser" type="text" bind:value={brief.imapUser} class="input-field" placeholder="jan@firma.pl" />
                </div>
                <div>
                  <label for="imapPassword" class="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Hasło IMAP</label>
                  <input id="imapPassword" type="password" bind:value={brief.imapPassword} class="input-field" placeholder="••••••••••" />
                  <p class="text-slate-600 text-[10px] font-mono mt-1.5">
                    {#if mode === 'edit'}
                      🔐 Puste = zachowaj obecne hasło. Wpisanie nowego nadpisze je (szyfrowanie GCP KMS).
                    {:else}
                      🔐 Zaszyfrowane natychmiast przy zapisie przez GCP KMS
                    {/if}
                  </p>
                </div>
              </div>
            {/if}
          </div>
        </div>

        <!-- USTAWIENIA DODATKOWE -->
        <div class="rounded-2xl p-[1px] bg-gradient-to-b from-white/10 to-white/5">
          <div class="bg-black/80 rounded-2xl p-6">
            <h3 class="font-mono text-[10px] uppercase tracking-widest text-primary mb-5">05 · Ustawienia Systemu</h3>
            <div class="space-y-3">
              <label class="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-white/3 transition-colors">
                <input type="checkbox" bind:checked={brief.warmupStrategy} class="w-4 h-4 accent-primary" />
                <div>
                  <div class="text-white text-sm font-display font-bold">Włącz strategię warm-up</div>
                  <div class="text-slate-500 text-xs">Stopniowe zwiększanie wolumenu przez pierwsze 2 tygodnie. Chroni reputację domeny.</div>
                </div>
              </label>
              <label class="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-white/3 transition-colors">
                <input type="checkbox" bind:checked={brief.autoGenerateSignature} class="w-4 h-4 accent-primary" />
                <div>
                  <div class="text-white text-sm font-display font-bold">Auto-generuj stopkę maila</div>
                  <div class="text-slate-500 text-xs">NEXUS stworzy profesjonalną stopkę na podstawie danych firmy.</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {#if errorMsg}
          <div class="text-red-400 text-sm font-mono bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{errorMsg}</div>
        {/if}

        <!-- SUBMIT -->
        <button
          type="submit"
          disabled={submitting}
          class="w-full py-5 rounded-2xl font-display font-bold uppercase text-white text-sm tracking-wider transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          style="background: linear-gradient(135deg, hsl(270,60%,45%), hsl(280,70%,55%)); box-shadow: 0 0 40px hsl(270,60%,25%);"
        >
          {#if submitting}
            <span class="material-symbols-outlined animate-spin">sync</span>
            Zapisywanie i generowanie PDF...
          {:else}
            <span class="material-symbols-outlined">rocket_launch</span>
            Uruchom NEXUS · Wyślij Brief
          {/if}
        </button>

        <p class="text-center text-slate-600 text-[10px] font-mono uppercase tracking-widest">
          Po wysłaniu otrzymasz potwierdzenie i PDF na email · Link wygasa jednorazowo
        </p>
      </div>
    </form>
  </div>

<!-- ═══════════════ SUCCESS ═══════════════ -->
{:else if stage === 'success'}
  <div class="max-w-xl w-full text-center">
    <div class="rounded-3xl p-[1px] bg-gradient-to-b from-green-500/50 to-green-900/10 mb-8">
      <div class="bg-black/90 rounded-3xl p-12 md:p-16">

        <span class="relative flex h-8 w-8 mx-auto mb-8">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-8 w-8 bg-green-500 shadow-[0_0_24px_#22c55e]"></span>
        </span>

        <div class="inline-block px-4 py-1.5 bg-green-500/10 border border-green-500/30 rounded-full text-[10px] font-mono text-green-400 uppercase tracking-widest mb-6">
          Brief wdrożeniowy zapisany
        </div>

        <h1 class="font-display text-3xl md:text-4xl font-bold uppercase tracking-tighter text-white mb-4">
          NEXUS jest w trakcie<br/>
          <span class="text-green-400">inicjalizacji</span>
        </h1>

        <p class="text-slate-400 text-sm leading-relaxed mb-10">
          Twój brief dotarł do systemu. Na maila otrzymałeś PDF z podsumowaniem konfiguracji.
          W ciągu <strong class="text-white">24-48h</strong> NEXUS rozpocznie kampanię.
        </p>

        <div class="space-y-3 text-left mb-10">
          {#each [
            'Inicjalizacja agenta i analiza branży (24-48h)',
            'Konfiguracja domeny i poczty wychodzącej',
            'NEXUS startuje kampanię cold email',
            'Raport wyników co 3 dni na Twój email',
          ] as step, i}
            <div class="flex items-center gap-4">
              <div class="size-6 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center shrink-0">
                <span class="text-green-400 text-[10px] font-mono font-bold">{i + 1}</span>
              </div>
              <span class="text-slate-300 text-sm">{step}</span>
            </div>
          {/each}
        </div>

        <a href="/" class="inline-flex items-center gap-2 border border-white/10 text-slate-400 font-mono text-[10px] uppercase tracking-widest px-8 py-4 rounded-full hover:border-primary/30 hover:text-primary transition-all">
          <span class="material-symbols-outlined text-sm">arrow_back</span>
          Wróć na stronę główną
        </a>
      </div>
    </div>
    <div class="font-mono text-[9px] text-slate-600 uppercase tracking-widest">
      STATUS SYSTEMU: INICJALIZACJA | NEXUS AGENT v2.4 | BRIEF ZASZYFROWANY I ZAPISANY ✓
    </div>
  </div>
{/if}

<style>
  :global(.input-field) {
    width: 100%;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 0.75rem;
    padding: 0.75rem 1rem;
    color: #fff;
    font-family: 'Inter', monospace;
    font-size: 0.875rem;
    transition: border-color 0.2s;
    outline: none;
  }
  :global(.input-field:focus) {
    border-color: rgba(168, 85, 247, 0.5);
  }
  :global(.input-field::placeholder) {
    color: #475569;
  }
  :global(select.input-field option) {
    background: #0a0a0f;
    color: #e2e8f0;
  }
</style>
