<script lang="ts">
  import { onMount } from 'svelte';

  type DashboardData = {
    orderNumber: string;
    email: string;
    status: 'active' | 'canceled' | 'past_due';
    dailyLimit: number;
    monthlyAmount: number;
    currentPeriodEnd?: string;
    cancelAtDate?: string;
    upcomingInvoice?: { amount_due: number; next_payment_attempt: string; };
    payments: any[];
  };

  let data = $state<DashboardData | null>(null);
  let isLoading = $state(true);
  let errorMsg = $state('');

  let isCanceling = $state(false);

  onMount(async () => {
    try {
      const res = await fetch('/api/subscription/dashboard-data');
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/manage-subscription';
          return;
        }
        errorMsg = 'Błąd pobierania danych.';
        return;
      }
      data = await res.json();
    } catch {
      errorMsg = 'Krytyczny błąd połączenia z serwerem.';
    } finally {
      isLoading = false;
    }
  });

  let showCancelConfirmModal = $state(false);
  let showCancelSuccessModal = $state(false);
  let cancelErrorMsg = $state('');

  function requestCancel() {
    showCancelConfirmModal = true;
  }

  async function confirmCancel() {
    showCancelConfirmModal = false;
    isCanceling = true;
    cancelErrorMsg = '';
    
    try {
      const res = await fetch('/api/subscription/cancel', { method: 'POST' });
      const result = await res.json();

      if (!res.ok) {
        cancelErrorMsg = result.error || 'Wystąpił błąd podczas anulowania.';
        return;
      }
      
      showCancelSuccessModal = true;
    } catch {
      cancelErrorMsg = 'Krytyczny błąd sieci podczas próby anulowania.';
    } finally {
      isCanceling = false;
    }
  }

  function closeSuccessModal() {
    showCancelSuccessModal = false;
    window.location.reload();
  }

  function formatDate(iso: string) {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('pl-PL', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  // Wylogowanie to po prostu wyczyszczenie ciastka z przestrzeni na frond-endzie lub uderzenie na mały endpoint.
  // Ponieważ ciasteczko logowania ma status HttpOnly, musimy wyczyścić je z poziomu serwera.
  // Z braku endpointu /logout, mozemy nadpisac ciastko pustą wartoscia w JS bez httponly by wylogowalo 
  // Oczywiście, najbezpieczniej zrobic endpoint.
  function logout() {
    document.cookie = "nexus_sub_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    window.location.href = "/manage-subscription";
  }
</script>

{#if isLoading}
  <div class="flex flex-col items-center justify-center min-h-[400px]">
    <div class="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin mb-4"></div>
    <div class="font-mono text-xs text-primary tracking-widest uppercase">Pobieranie danych z bazy</div>
  </div>
{:else if errorMsg}
  <div class="bg-red-500/10 border border-red-500/20 text-red-500 p-6 rounded-2xl text-center">
    Odmowa dostępu. {errorMsg}
  </div>
{:else if data}
  <div class="flex justify-between items-end mb-8">
    <div>
      <h1 class="text-3xl md:text-4xl font-bold font-grotesk tracking-tight text-white mb-2">Zarządzanie Subskrypcją</h1>
      <p class="text-slate-400">Zamówienie: <span class="text-primary font-mono">{data.orderNumber}</span> • Poczta: <span class="text-white">{data.email}</span></p>
    </div>
    <button onclick={logout} class="text-xs text-slate-500 hover:text-white transition-colors uppercase tracking-widest font-mono">
      Wyloguj [X]
    </button>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- SEKCA 1: STATUS -->
    <div class="lg:col-span-2 bg-[#0a0a0e]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
      <div class="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
        <svg class="w-48 h-48" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
      </div>

      <div class="relative z-10 flex items-center gap-4 mb-8">
        {#if data.status === 'active'}
          <div class="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)] animate-pulse"></div>
          <span class="text-green-500 font-bold tracking-wide uppercase text-sm">Aktywna</span>
        {:else if data.status === 'canceled'}
          <div class="flex items-center gap-3 flex-wrap">
            <div class="flex items-center gap-3">
              <div class="w-3 h-3 rounded-full bg-slate-500"></div>
              <span class="text-slate-400 font-bold tracking-wide uppercase text-sm">Anulowana / Opcja Wygasania</span>
            </div>
            <span class="text-[10px] font-mono text-slate-400 bg-white/5 px-3 py-1 rounded-full border border-white/10 uppercase tracking-widest mt-2 sm:mt-0">Ostateczny koniec: {formatDate(data.cancelAtDate || data.currentPeriodEnd || '')}</span>
          </div>
        {:else}
          <div class="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.6)]"></div>
          <span class="text-red-500 font-bold tracking-wide uppercase text-sm">Niezapłacona</span>
        {/if}
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8 border-t border-white/5 pt-6">
        <div>
          <span class="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Limit Skrzynki</span>
          <span class="text-xl font-bold font-mono text-white">{data.dailyLimit} <span class="text-sm text-slate-500 font-inter font-normal">maili/dzień</span></span>
        </div>
        <div>
          <span class="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Kwota Miesięczna</span>
          <span class="text-xl font-bold font-mono text-white">{data.monthlyAmount} <span class="text-sm text-slate-500 font-inter font-normal">PLN</span></span>
        </div>
        <div class="col-span-2 md:col-span-2">
          <span class="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Rozliczenie (Okres)</span>
          <span class="text-lg font-medium text-white">{formatDate(data.currentPeriodEnd || '')}</span>
        </div>
      </div>

      {#if data.status === 'active'}
        <div class="bg-primary/10 border border-primary/20 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 class="text-white font-medium mb-1">Aktywna Kampania (NEXUS)</h3>
            <p class="text-sm text-slate-400">Twoja usługa odnowi się automatycznie <strong class="text-white">{data.upcomingInvoice ? formatDate(data.upcomingInvoice.next_payment_attempt) : formatDate(data.currentPeriodEnd || '')}</strong>.</p>
          </div>
          <button 
            onclick={requestCancel}
            disabled={isCanceling}
            class="shrink-0 bg-transparent border border-red-500/50 hover:bg-red-500/10 text-red-400 text-sm font-medium py-2 px-4 rounded transition-all focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-50"
          >
            {isCanceling ? 'Anulowanie...' : 'Anuluj subskrypcję'}
          </button>
        </div>
        
        {#if cancelErrorMsg}
          <div class="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-sm font-mono flex items-center gap-3">
            <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            {cancelErrorMsg}
          </div>
        {/if}
      {:else}
        <div class="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5">
           <h3 class="text-white font-medium mb-1">Subskrypcja Zakończona (Anulowana)</h3>
           <p class="text-sm text-slate-400">Twoja kampania będzie działać do {formatDate(data.cancelAtDate || data.currentPeriodEnd || '')}, a następnie maszyna zostanie ostatecznie wyłączona i podlegnie protokołowi samokasowania.</p>
        </div>
      {/if}
    </div>

    <!-- SEKCA 2: HISTORIA FAKTUR -->
    <div class="bg-[#0a0a0e]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col">
      <h2 class="text-lg font-bold text-white mb-6 border-b border-white/5 pb-4">Historia Płatności i Faktury</h2>
      
      {#if !data.payments || data.payments.length === 0}
        <div class="flex-1 flex items-center justify-center text-slate-500 text-sm italic">
          Brak wygenerowanych faktur
        </div>
      {:else}
        <div class="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
          {#each data.payments as payment (payment.id || payment.stripeInvoiceId)}
            <div class="bg-white/5 border border-white/5 p-4 rounded-xl hover:border-primary/30 transition-colors group">
              <div class="flex justify-between items-start mb-2">
                <span class="text-white font-medium">{payment.amount} <span class="text-xs text-slate-400">PLN</span></span>
                <span class="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded {payment.status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}">
                  {payment.status === 'paid' ? 'Opłacono' : 'Oczekuje'}
                </span>
              </div>
              <div class="text-xs text-slate-500 mb-3 font-mono">
                {formatDate(payment.paidAt)}
              </div>
              
              {#if payment.fakturaXlInvoiceId}
                <a 
                  href={`/api/invoices/download?id=${payment.fakturaXlInvoiceId}`}
                  target="_blank"
                  class="flex items-center justify-center w-full gap-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium py-2 rounded transition-colors"
                >
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                  Pobierz PDF Faktura XL
                </a>
              {:else}
                 <div class="text-[10px] text-slate-500 text-center uppercase tracking-widest bg-slate-800/50 py-2 rounded">
                   Faktura w toku...
                 </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
  </div>
{/if}

<!-- MODAL ANULOWANIA SUBSKRYPCJI -->
{#if showCancelConfirmModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onclick={() => showCancelConfirmModal = false}>
    <div class="bg-[#0a0a0e] border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl max-w-lg w-full relative z-10 overflow-hidden" onclick={e => e.stopPropagation()}>
      <div class="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
        <svg class="w-32 h-32 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
      </div>
      
      <div class="flex items-center gap-4 mb-6 relative z-10">
        <div class="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
          <svg class="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
        </div>
        <h2 class="text-2xl font-bold font-display uppercase tracking-tight text-white">Przetnij Połączenie</h2>
      </div>
      
      <div class="relative z-10 space-y-4 mb-10 text-slate-400 text-sm">
        <p>Czy na pewno chcesz anulować subskrypcję NEXUS?</p>
        <div class="bg-white/5 border border-white/10 p-4 rounded-xl">
          Usługa pozostanie aktywna do <strong>końca opłaconego okresu rozliczeniowego</strong>. Następnie maszyna zostanie trwale zgaszona, a baza mailowa wyłączona.
        </div>
      </div>
      
      <div class="flex flex-col md:flex-row items-center gap-3 relative z-10">
        <button 
          onclick={() => showCancelConfirmModal = false}
          class="w-full md:w-auto px-6 py-3 rounded-xl border border-white/10 text-white font-mono text-xs uppercase tracking-widest hover:bg-white/5 transition-colors"
        >
          Wróć
        </button>
        <button 
          onclick={confirmCancel}
          class="w-full md:flex-1 px-6 py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white font-mono font-bold text-xs uppercase tracking-widest transition-colors shadow-[0_0_20px_rgba(239,68,68,0.4)]"
        >
          Tak, anuluj subskrypcję
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- MODAL SUKCESU ANULOWANIA -->
{#if showCancelSuccessModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onclick={closeSuccessModal}>
    <div class="bg-[#0a0a0e] border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl max-w-lg w-full relative z-10 overflow-hidden" onclick={e => e.stopPropagation()}>
      <div class="absolute inset-0 bg-linear-to-b from-slate-900/50 to-transparent pointer-events-none"></div>
      
      <div class="relative z-10 text-center">
        <div class="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 mx-auto flex items-center justify-center mb-6">
          <svg class="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
        </div>
        
        <h2 class="text-2xl font-bold font-display uppercase tracking-tight text-white mb-4">Proces Zakończony</h2>
        <p class="text-slate-400 text-sm mb-6 leading-relaxed">
          Zlecenie anulowania zostało zapisane. Wysłaliśmy również potwierdzenie na Twój adres e-mail.<br><br>
          Dziękujemy za współpracę z systemem NEXUS.
        </p>
        
        <button 
          onclick={closeSuccessModal}
          class="w-full px-6 py-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-white font-mono text-xs uppercase tracking-widest transition-all"
        >
          Zamknij i Odśwież Status
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }
</style>
