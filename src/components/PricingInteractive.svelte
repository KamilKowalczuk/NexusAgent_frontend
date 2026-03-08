<script lang="ts">
  import WaitlistModal from './WaitlistModal.svelte';

  interface Props {
    initialTotal?: number;
    initialUsed?: number;
    emailsPerDay?: number;
  }

  let {
    initialTotal = 10,
    initialUsed = 0,
    emailsPerDay: initialEmails = 20,
  }: Props = $props();

  // Slider state — use $state with prop-derived initial value
  let emailsPerDay = $state(20);
  let titanCost = $derived(1999 + Math.max(0, emailsPerDay - 20) * 25);
  let fillPercent = $derived(((emailsPerDay - 10) / (100 - 10)) * 100);

  // Slots state — refreshed on mount from /api/slots
  let totalSlots = $state(10);
  let usedSlots = $state(0);
  let availableSlots = $derived(Math.max(0, totalSlots - usedSlots));
  // 10 kropek = 100% — ile zamalować (zaokrąglenie do całej kropki zawsze)
  let filledDots = $derived(totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 10) : 0);
  let slotsLoaded = $state(false);

  // UI state
  let showWaitlist = $state(false);
  let isLoading = $state(false);

  function handleSliderInput(e: Event) {
    emailsPerDay = parseInt((e.target as HTMLInputElement).value);
  }

  async function handleActivate() {
    if (isLoading) return;
    isLoading = true;
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailsPerDay }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Wystąpił błąd. Spróbuj ponownie.');
        isLoading = false;
      }
    } catch (err) {
      alert('Nie udało się połączyć z systemem płatności. Sprawdź połączenie.');
      isLoading = false;
    }
  }

  // Re-check slots client-side on mount — also set initial values from props
  $effect(() => {
    emailsPerDay = initialEmails;
    totalSlots = initialTotal;
    usedSlots = initialUsed;
    fetch('/api/slots')
      .then(r => r.json())
      .then(data => {
        totalSlots = data.total ?? initialTotal;
        usedSlots = data.used ?? initialUsed;
        slotsLoaded = true;
      })
      .catch(() => {
        slotsLoaded = true;
      });
  });
</script>

<div class="relative">
  <!-- Slider section -->
  <div class="mb-8">
    <div class="flex justify-between items-center mb-4">
      <span class="font-mono text-[11px] text-slate-500 uppercase tracking-widest">Ilość maili / dzień</span>
      <span class="font-mono text-accent font-bold text-sm">{emailsPerDay} maili</span>
    </div>
    <div class="relative py-2">
      <input
        class="pricing-slider w-full appearance-none bg-transparent cursor-pointer relative z-10"
        type="range"
        min="10"
        max="100"
        value={emailsPerDay}
        oninput={handleSliderInput}
      />
      <!-- Custom track -->
      <div class="absolute top-1/2 left-0 right-0 h-[4px] -translate-y-1/2 rounded-full bg-white/8 pointer-events-none">
        <div
          class="h-full rounded-full transition-all duration-150"
          style="width: {fillPercent}%; background: linear-gradient(90deg, hsl(270, 60%, 50%), hsl(280, 70%, 65%)); box-shadow: 0 0 8px hsl(270, 60%, 40%);"
        ></div>
      </div>
    </div>
    <div class="flex justify-between text-[10px] text-slate-600 font-mono mt-3 uppercase tracking-widest">
      <span>10 / dzień</span>
      <span>55 / dzień</span>
      <span>100 / dzień</span>
    </div>
  </div>

  <!-- Dynamic Price Display -->
  <div class="text-center mb-8 py-6 border-y border-white/5">
    <div class="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Twoja cena miesięcznie</div>
    <div
      class="text-6xl font-display font-bold text-white py-1"
      style="font-variant-numeric: tabular-nums; transition: color 0.3s ease;"
    >
      {titanCost.toLocaleString('pl-PL')} <span class="text-2xl font-normal text-slate-400">PLN/mc</span>
    </div>
    <div class="text-slate-600 text-xs font-mono mt-2">
      {emailsPerDay * 30} maili miesięcznie · {emailsPerDay} dziennie · 24/7
    </div>
  </div>

  <!-- Slots counter -->
  <div class="flex items-center justify-center gap-3 mb-6 min-h-[28px]">
    {#if slotsLoaded}
      <div class="flex gap-1">
        {#each Array(10) as _, i}
          <div
            class="w-2.5 h-2.5 rounded-full transition-all duration-500"
            style="background: {i < filledDots ? 'hsl(270, 60%, 55%)' : 'rgba(255,255,255,0.08)'}; box-shadow: {i < filledDots ? '0 0 6px hsl(270, 60%, 40%)' : 'none'};"
          ></div>
        {/each}
      </div>
      <span class="font-mono text-[10px] text-slate-500 uppercase tracking-widest">
        {usedSlots} / {totalSlots} zajętych slotów
      </span>
    {:else}
      <span class="font-mono text-[10px] text-slate-600 uppercase tracking-widest animate-pulse">Sprawdzanie dostępności...</span>
    {/if}
  </div>

  <!-- CTA Button -->
  {#if !slotsLoaded || availableSlots > 0}
    <button
      onclick={handleActivate}
      disabled={isLoading}
      class="w-full text-white font-display font-bold text-sm uppercase py-5 rounded-2xl transition-all duration-300 mt-auto disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
      style="background: linear-gradient(135deg, hsl(270, 60%, 45%), hsl(280, 70%, 55%)); box-shadow: 0 0 30px hsl(270, 60%, 30%), 0 0 60px hsl(270, 60%, 15%);"
    >
      {#if isLoading}
        <span class="material-symbols-outlined animate-spin text-sm">sync</span>
        Przekierowanie do płatności...
      {:else}
        <span class="material-symbols-outlined text-sm">bolt</span>
        Aktywuj NEXUS · {titanCost.toLocaleString('pl-PL')} PLN/mc
      {/if}
    </button>
  {:else}
    <button
      onclick={() => showWaitlist = true}
      class="w-full bg-white/5 hover:bg-white/8 border border-white/15 hover:border-white/30 text-white font-display font-bold text-sm uppercase py-5 rounded-2xl transition-all duration-300 mt-auto flex items-center justify-center gap-3"
    >
      <span class="material-symbols-outlined text-sm">queue</span>
      Zapisz się na Listę Oczekujących
    </button>
  {/if}

  <!-- Micro-trust signals -->
  <div class="flex items-center justify-center flex-wrap gap-4 mt-5 text-[9px] font-mono text-slate-600 uppercase tracking-widest">
    <span class="flex items-center gap-1">
      <span class="material-symbols-outlined text-[12px] text-green-500/70">verified_user</span> Anti-Spam Protocol
    </span>
    <span class="flex items-center gap-1">
      <span class="material-symbols-outlined text-[12px] text-green-500/70">lock</span> Bezpieczna płatność Stripe
    </span>
    <span class="flex items-center gap-1">
      <span class="material-symbols-outlined text-[12px] text-green-500/70">cancel</span> Anuluj kiedy chcesz
    </span>
  </div>
</div>

<!-- Waitlist Modal -->
{#if showWaitlist}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    aria-label="Lista Oczekujących"
    tabindex="-1"
    onkeydown={(e) => { if (e.key === 'Escape') showWaitlist = false; }}
  >
    <!-- Backdrop -->
    <button
      type="button"
      class="absolute inset-0 bg-black/80 backdrop-blur-sm w-full h-full border-0 cursor-default"
      onclick={() => showWaitlist = false}
      aria-label="Zamknij modal"
    ></button>
    <!-- Modal -->
    <div class="relative z-10 w-full max-w-lg">
      <WaitlistModal
        {emailsPerDay}
        onClose={() => showWaitlist = false}
      />
    </div>
  </div>
{/if}

<style>
  .pricing-slider {
    height: 24px;
  }
  .pricing-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: hsl(275, 65%, 62%);
    cursor: pointer;
    box-shadow: 0 0 12px hsl(270, 60%, 50%), 0 0 24px hsl(270, 60%, 30%);
    border: 2px solid rgba(255,255,255,0.3);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  .pricing-slider::-webkit-slider-thumb:hover {
    transform: scale(1.25);
    box-shadow: 0 0 18px hsl(270, 60%, 55%), 0 0 36px hsl(270, 60%, 30%);
  }
  .pricing-slider::-moz-range-thumb {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: hsl(275, 65%, 62%);
    cursor: pointer;
    border: 2px solid rgba(255,255,255,0.3);
    box-shadow: 0 0 12px hsl(270, 60%, 50%);
  }
  .pricing-slider::-webkit-slider-runnable-track {
    height: 4px;
    background: transparent;
  }
  .pricing-slider::-moz-range-track {
    height: 4px;
    background: transparent;
  }
</style>
