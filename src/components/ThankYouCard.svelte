<script lang="ts">
  let sessionId: string | null = null;
  let isLoading = $state(true);
  let isValid = $state(false);
  let errorMsg = $state('');

  let emailsPerDay = $state(20);
  let priceInPLN = $state(1999);
  let customerEmail = $state('');
  let customerName = $state('');
  let customerPhone = $state('');
  let billingCompanyName = $state('');
  let billingNip = $state('');
  let billingStreet = $state('');
  let billingCity = $state('');
  let billingPostalCode = $state('');
  let billingCountry = $state('');

  $effect(() => {
    const params = new URLSearchParams(window.location.search);
    sessionId = params.get('session_id');

    if (!sessionId) {
      isLoading = false;
      errorMsg = 'no_session';
      return;
    }

    verifySession(sessionId);
  });

  async function verifySession(sid: string) {
    try {
      const res = await fetch(`/api/stripe/verify-session?session_id=${encodeURIComponent(sid)}`);
      const data = await res.json();

      if (!res.ok || !data.valid) {
        isLoading = false;
        errorMsg = data.error || 'invalid';
        return;
      }

      emailsPerDay = data.emailsPerDay;
      priceInPLN = data.priceInPLN;
      customerEmail = data.customerEmail;
      customerName = data.customerName || '';
      customerPhone = data.customerPhone || '';
      billingCompanyName = data.billingCompanyName || '';
      billingNip = data.billingNip || '';
      billingStreet = data.billingStreet || '';
      billingCity = data.billingCity || '';
      billingPostalCode = data.billingPostalCode || '';
      billingCountry = data.billingCountry || '';
      isValid = true;
      isLoading = false;
    } catch {
      isLoading = false;
      errorMsg = 'fetch_error';
    }
  }

  const hasBillingData = $derived(billingCompanyName || billingNip || billingStreet);

  const steps = [
    'Autoryzacja (Natychmiast) – Otrzymujesz na maila potwierdzenie subskrypcji oraz informację o limicie.',
    'Kalibracja Celu (do 24h) – Dostajesz link do technicznego briefu (max 15 minut).',
    'Inicjalizacja Agenta (24-48h) – NEXUS skanuje rynek i buduje bazę firm z Twojej branży.',
    'Uderzenie (od 48h) – Agent rozpoczyna pracę i generuje hiper-spersonalizowane wiadomości.',
    'Raportowanie (Co 3 dni) – Otrzymujesz twarde dane na maila. Ty wkraczasz do akcji tylko przy odpowiedzi od klienta.',
  ];
</script>

{#if isLoading}
  <!-- Loading state -->
  <div class="max-w-2xl w-full relative z-10">
    <div class="rounded-3xl p-[1px] bg-gradient-to-b from-primary/50 to-primary/10">
      <div class="bg-black/90 rounded-3xl p-12 md:p-16 flex flex-col items-center">
        <span class="material-symbols-outlined text-4xl text-primary animate-spin mb-6">sync</span>
        <p class="font-mono text-sm text-slate-400 uppercase tracking-widest">Weryfikacja płatności...</p>
      </div>
    </div>
  </div>

{:else if errorMsg}
  <!-- No valid session / error -->
  <div class="max-w-2xl w-full relative z-10">
    <div class="rounded-3xl p-[1px] bg-gradient-to-b from-red-500/50 to-red-900/10">
      <div class="bg-black/90 rounded-3xl p-12 md:p-16 text-center">
        <span class="material-symbols-outlined text-5xl text-red-400 mb-6">block</span>

        {#if errorMsg === 'no_session'}
          <h1 class="font-display text-3xl md:text-4xl font-bold uppercase tracking-tighter text-white mb-4">
            Brak aktywnej sesji
          </h1>
          <p class="text-slate-400 text-sm leading-relaxed mb-8 max-w-md mx-auto">
            Ta strona jest dostępna wyłącznie po dokonaniu płatności przez system Stripe.
            Jeśli dokonałeś zakupu i widzisz ten komunikat, skontaktuj się z nami.
          </p>
        {:else if errorMsg === 'Płatność nie została potwierdzona'}
          <h1 class="font-display text-3xl md:text-4xl font-bold uppercase tracking-tighter text-white mb-4">
            Płatność w trakcie
          </h1>
          <p class="text-slate-400 text-sm leading-relaxed mb-8 max-w-md mx-auto">
            Twoja płatność nie została jeszcze potwierdzona. Poczekaj chwilę i odśwież stronę.
          </p>
        {:else}
          <h1 class="font-display text-3xl md:text-4xl font-bold uppercase tracking-tighter text-white mb-4">
            Nieprawidłowa sesja
          </h1>
          <p class="text-slate-400 text-sm leading-relaxed mb-8 max-w-md mx-auto">
            Nie udało się zweryfikować Twojej płatności. Spróbuj ponownie lub skontaktuj się z nami.
          </p>
        {/if}

        <a
          href="/"
          class="inline-flex items-center gap-3 border border-white/10 text-slate-400 font-mono uppercase text-[10px] tracking-widest px-8 py-4 rounded-full hover:border-primary/30 hover:text-primary transition-all duration-300"
        >
          <span class="material-symbols-outlined text-sm">arrow_back</span>
          Wróć na stronę główną
        </a>
      </div>
    </div>
  </div>

{:else if isValid}
  <!-- Success state -->
  <div class="max-w-2xl w-full relative z-10">
    <div class="rounded-3xl p-[1px] bg-gradient-to-b from-green-500/50 to-green-900/10 mb-12">
      <div class="bg-black/90 rounded-3xl p-12 md:p-16">

        <!-- Pulsing dot -->
        <span class="relative flex h-6 w-6 mx-auto mb-10">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-6 w-6 bg-green-500 shadow-[0_0_20px_#22c55e]"></span>
        </span>

        <div class="inline-block px-4 py-1.5 bg-green-500/10 border border-green-500/30 rounded-full text-[10px] font-mono text-green-400 uppercase tracking-widest mb-6">
          System aktywny
        </div>

        <h1 class="font-display text-4xl md:text-5xl font-bold uppercase tracking-tighter text-white mb-6">
          NEXUS Agent<br />
          <span class="text-green-400">System sprzedaży uruchomiony</span>
        </h1>

        <p class="text-slate-400 text-sm leading-relaxed mb-10 max-w-md mx-auto">
          Subskrypcja jest aktywna. W ciągu
          <strong class="text-white">24 godzin</strong> otrzymasz link do technicznego briefu.
          Po jego wypełnieniu NEXUS przejmuje kontrolę, a Ty czekasz na gotowe leady.
        </p>

        <!-- Plan summary -->
        <div class="glass rounded-2xl p-6 border border-white/5 text-left mb-10">
          <div class="flex justify-between items-center text-xs font-mono uppercase text-slate-500 mb-5 tracking-widest">
            <span>Twoja subskrypcja</span>
            <span class="text-green-400 flex items-center gap-1.5">
              <span class="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
              Aktywna
            </span>
          </div>
          <div class="flex justify-between items-end gap-4">
            <div class="space-y-3">
              <div>
                <div class="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Dzienna wysyłka</div>
                <div class="text-2xl font-display font-bold text-white">{emailsPerDay} <span class="text-slate-400 text-base font-normal">maili / dzień</span></div>
              </div>
              <div>
                <div class="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Miesięczny wolumen</div>
                <div class="text-white font-mono text-sm">{(emailsPerDay * 30).toLocaleString('pl-PL')} maili / miesiąc</div>
              </div>
            </div>
            <div class="text-right shrink-0">
              <div class="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Koszt systemu</div>
              <div class="text-4xl font-display font-bold text-primary">{priceInPLN.toLocaleString('pl-PL')} zł</div>
              <div class="text-slate-500 text-xs mt-1 font-mono">/ miesiąc · bez prowizji</div>
            </div>
          </div>
        </div>

        {#if customerEmail}
          <div class="glass rounded-xl p-4 border border-white/5 text-left mb-6 flex items-center gap-3">
            <span class="material-symbols-outlined text-green-400 text-lg">mail</span>
            <div>
              <div class="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Potwierdzenie wysłane na</div>
              <div class="text-white text-sm font-mono">{customerEmail}</div>
            </div>
          </div>
        {/if}

        {#if hasBillingData}
          <div class="glass rounded-xl p-5 border border-cyan-500/10 text-left mb-6">
            <div class="text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span class="material-symbols-outlined text-sm">receipt_long</span>
              Dane do faktury
            </div>
            <div class="space-y-1.5 text-sm">
              {#if customerName}
                <div class="flex gap-2">
                  <span class="text-slate-500 text-xs font-mono w-16 shrink-0">Kontakt</span>
                  <span class="text-white">{customerName}{customerPhone ? ` · ${customerPhone}` : ''}</span>
                </div>
              {/if}
              {#if billingCompanyName}
                <div class="flex gap-2">
                  <span class="text-slate-500 text-xs font-mono w-16 shrink-0">Firma</span>
                  <span class="text-white">{billingCompanyName}</span>
                </div>
              {/if}
              {#if billingNip}
                <div class="flex gap-2">
                  <span class="text-slate-500 text-xs font-mono w-16 shrink-0">NIP</span>
                  <span class="text-white font-mono">{billingNip}</span>
                </div>
              {/if}
              {#if billingStreet}
                <div class="flex gap-2">
                  <span class="text-slate-500 text-xs font-mono w-16 shrink-0">Adres</span>
                  <span class="text-white">{billingStreet}, {billingPostalCode} {billingCity}{billingCountry && billingCountry !== 'PL' ? `, ${billingCountry}` : ''}</span>
                </div>
              {/if}
            </div>
            <div class="text-[10px] text-slate-600 mt-3 font-mono">Faktury VAT będą generowane na powyższe dane.</div>
          </div>
        {/if}

        <!-- Next steps -->
        <div class="space-y-3 text-left mb-10">
          {#each steps as step, i}
            <div class="flex items-center gap-4">
              <div class="size-6 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center shrink-0">
                <span class="text-green-400 text-[10px] font-mono font-bold">{i + 1}</span>
              </div>
              <span class="text-slate-300 text-sm">{step}</span>
            </div>
          {/each}
        </div>

        <a
          href="/"
          class="inline-flex items-center gap-3 border border-white/10 text-slate-400 font-mono uppercase text-[10px] tracking-widest px-8 py-4 rounded-full hover:border-primary/30 hover:text-primary transition-all duration-300"
        >
          <span class="material-symbols-outlined text-sm">arrow_back</span>
          Wróć na stronę główną
        </a>
      </div>
    </div>

    <!-- Status bar -->
    <div class="font-mono text-[9px] text-slate-600 uppercase tracking-widest text-center">
      STATUS SYSTEMU: AKTYWNY | NEXUS AGENT v2.4 | SLOT ZAREZERWOWANY ✓
    </div>
  </div>
{/if}
