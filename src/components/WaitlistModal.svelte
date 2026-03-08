<script lang="ts">
  interface Props {
    emailsPerDay?: number;
    onClose: () => void;
    onSuccess?: () => void;
  }

  let { emailsPerDay = 20, onClose, onSuccess }: Props = $props();

  let firstName = $state('');
  let lastName = $state('');
  let email = $state('');
  let phone = $state('');

  let isLoading = $state(false);
  let isSuccess = $state(false);
  let errorMessage = $state('');

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (isLoading) return;

    errorMessage = '';

    // Client validation
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      errorMessage = 'Imię, nazwisko i email są wymagane.';
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      errorMessage = 'Podaj prawidłowy adres email.';
      return;
    }

    isLoading = true;

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          emailsPerDay,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        errorMessage = data.error || 'Wystąpił błąd. Spróbuj ponownie.';
        return;
      }

      isSuccess = true;
      onSuccess?.();

      // Auto-close after 3s
      setTimeout(() => {
        onClose();
      }, 3000);
    } catch (err: any) {
      errorMessage = 'Błąd połączenia. Sprawdź internet i spróbuj ponownie.';
    } finally {
      isLoading = false;
    }
  }
</script>

<div
  class="glass rounded-3xl border border-white/10 p-8 md:p-10 bg-black/95 shadow-2xl"
  onclick={(e) => e.stopPropagation()}
  role="none"
>
  {#if !isSuccess}
    <!-- Header -->
    <div class="flex items-start justify-between mb-8">
      <div>
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/20 bg-accent/5 mb-3 text-[10px] font-mono text-accent uppercase tracking-[0.2em]">
          Lista Oczekujących
        </div>
        <h3 class="font-display text-2xl font-bold uppercase tracking-tighter text-white">
          Zarezerwuj swoje miejsce
        </h3>
        <p class="text-slate-500 text-sm mt-2 leading-relaxed">
          Gdy tylko zwolni się slot, skontaktujemy się z Tobą jako pierwszy.
        </p>
      </div>
      <button
        onclick={onClose}
        class="size-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all shrink-0 mt-1"
        aria-label="Zamknij"
      >
        <span class="material-symbols-outlined text-slate-400 text-base">close</span>
      </button>
    </div>

    <!-- Form -->
    <form onsubmit={handleSubmit} class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-1.5">
          <label for="wl-firstname" class="font-mono text-[10px] uppercase text-slate-500 tracking-widest">Imię *</label>
          <input
            id="wl-firstname"
            bind:value={firstName}
            type="text"
            required
            disabled={isLoading}
            placeholder="Jan"
            class="w-full bg-white/5 border border-white/10 focus:border-accent/40 focus:ring-1 focus:ring-accent/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-700 outline-none transition-all"
          />
        </div>
        <div class="space-y-1.5">
          <label for="wl-lastname" class="font-mono text-[10px] uppercase text-slate-500 tracking-widest">Nazwisko *</label>
          <input
            id="wl-lastname"
            bind:value={lastName}
            type="text"
            required
            disabled={isLoading}
            placeholder="Kowalski"
            class="w-full bg-white/5 border border-white/10 focus:border-accent/40 focus:ring-1 focus:ring-accent/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-700 outline-none transition-all"
          />
        </div>
      </div>

      <div class="space-y-1.5">
        <label for="wl-email" class="font-mono text-[10px] uppercase text-slate-500 tracking-widest">Email *</label>
        <input
          id="wl-email"
          bind:value={email}
          type="email"
          required
          disabled={isLoading}
          placeholder="jan@firma.pl"
          class="w-full bg-white/5 border border-white/10 focus:border-accent/40 focus:ring-1 focus:ring-accent/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-700 outline-none transition-all"
        />
      </div>

      <div class="space-y-1.5">
        <label for="wl-phone" class="font-mono text-[10px] uppercase text-slate-500 tracking-widest">Telefon (opcjonalnie)</label>
        <input
          id="wl-phone"
          bind:value={phone}
          type="tel"
          disabled={isLoading}
          placeholder="+48 600 000 000"
          class="w-full bg-white/5 border border-white/10 focus:border-accent/40 focus:ring-1 focus:ring-accent/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-700 outline-none transition-all"
        />
      </div>

      {#if errorMessage}
        <div class="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <span class="material-symbols-outlined text-base shrink-0">error</span>
          {errorMessage}
        </div>
      {/if}

      <button
        type="submit"
        disabled={isLoading}
        class="w-full bg-accent hover:brightness-110 text-white font-display font-bold text-sm uppercase py-4 rounded-2xl transition-all duration-300 neon-shadow-purple disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 mt-2"
      >
        {#if isLoading}
          <span class="material-symbols-outlined animate-spin text-sm">sync</span>
          Zapisuję...
        {:else}
          <span class="material-symbols-outlined text-sm">queue</span>
          Zapisz mnie na listę
        {/if}
      </button>

      <p class="text-center text-[10px] text-slate-600 font-mono">
        Twoje dane są bezpieczne. Nie udostępniamy ich osobom trzecim.
      </p>
    </form>
  {:else}
    <!-- Success state -->
    <div class="text-center py-8">
      <span class="relative flex h-16 w-16 mx-auto mb-6">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-30"></span>
        <span class="relative inline-flex rounded-full h-16 w-16 bg-accent/20 border border-accent/40 items-center justify-center">
          <span class="material-symbols-outlined text-accent text-3xl">done</span>
        </span>
      </span>
      <h3 class="font-display text-2xl font-bold uppercase tracking-tighter text-white mb-3">
        Jesteś na liście!
      </h3>
      <p class="text-slate-400 text-sm leading-relaxed">
        Gdy tylko zwolni się slot, skontaktujemy się z Tobą na adres<br />
        <strong class="text-white">{email}</strong>
      </p>
      <div class="mt-4 text-[10px] font-mono text-slate-600 uppercase tracking-widest">
        Okno zamknie się automatycznie...
      </div>
    </div>
  {/if}
</div>

<style>
  .glass {
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }
</style>
