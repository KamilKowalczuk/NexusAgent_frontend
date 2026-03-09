<script lang="ts">
  import { Completion } from "@ai-sdk/svelte";

  const {
    badge = "SYMULACJA_TERMINALA NA ŻYWO",
    headline = "Protokół Analizy Systemowej",
    inputLabelUrl = "URL firmy do ataku",
    inputLabelIndustry = "Branża docelowa",
  } = $props<{
    badge?: string;
    headline?: string;
    inputLabelUrl?: string;
    inputLabelIndustry?: string;
  }>();

  let targetUrl = $state("");
  let industry = $state("");

  let terminalLines = $state<string[]>([
    "nexus@agent:~$ oczekiwanie na cel...",
  ]);

  // Używamy instancji wbudowanej w Runes The (Svelte 5 API z Vercela)
  const generator = new Completion({
    api: "/api/demo-attack",
    streamProtocol: "text",
    onFinish: () => {
      terminalLines = [
        ...terminalLines,
        `[SYSTEM] Symulacja ataku zakończona. Cel namierzony.`,
      ];
    },
    onError: (err) => {
      terminalLines = [...terminalLines, `[ERROR] API Error: ${err.message}`];
    },
  });

  async function startAttack() {
    if (!targetUrl) return;

    let domain = "";
    try {
      domain = new URL(
        targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`,
      ).hostname;
    } catch (e) {
      domain = targetUrl;
    }

    terminalLines = [
      `nexus@agent:~$ symulacja-cold-mail --cel=${domain} ${industry ? `--branza=${industry}` : ""} --gleboki-skan`,
      `[SYSTEM] Inicjacja Symulacji Ataku Cold Email...`,
      `[INFO] Lokalizowanie danych celu...`,
      `[INFO] Omijanie standardowych filtrów spamowych...`,
    ];

    try {
      // The options.body wasn't reacting appropriately in older `@ai-sdk/svelte` without passing payload directly,
      // so let's pass it via stringified options to complete.
      await generator.complete(targetUrl, {
        body: { url: targetUrl, industry: industry },
      });
    } catch (err) {
      terminalLines = [...terminalLines, `[ERROR] Wystąpił błąd: ${err}`];
    }
  }
</script>

<section
  class="max-w-7xl mx-auto px-8 py-32 w-full grid grid-cols-1 lg:grid-cols-2 gap-20 items-center"
  id="demo"
>
  <!-- Left side – Parameters -->
  <div class="fade-up">
    <div
      class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 mb-8 text-[10px] font-mono text-primary uppercase tracking-[0.2em]"
    >
      {badge}
    </div>
    <h2
      class="font-display text-5xl font-bold uppercase tracking-tighter mb-8 leading-none"
    >
      {@html headline}
    </h2>
    <div class="space-y-8">
      <div class="space-y-2">
        <label
          for="demo-url"
          class="font-mono text-[11px] uppercase text-slate-500 tracking-widest"
          >{inputLabelUrl}</label
        >
        <input
          id="demo-url"
          bind:value={targetUrl}
          class="w-full bg-black/40 border border-slate-800 rounded-xl p-5 font-mono text-primary focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all duration-300 placeholder:text-slate-700"
          placeholder="https://competitor.pl"
          type="text"
          autocomplete="off"
          maxlength="100"
          disabled={generator.loading}
        />
      </div>
      <div class="space-y-2">
        <label
          for="demo-industry"
          class="font-mono text-[11px] uppercase text-slate-500 tracking-widest"
          >{inputLabelIndustry}</label
        >
        <input
          id="demo-industry"
          bind:value={industry}
          class="w-full bg-black/40 border border-slate-800 rounded-xl p-5 font-mono text-primary focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all duration-300 placeholder:text-slate-700"
          placeholder="e.g. Fintech, Manufacturing"
          type="text"
          autocomplete="off"
          maxlength="100"
          disabled={generator.loading}
        />
      </div>
      <button
        onclick={startAttack}
        disabled={generator.loading || !targetUrl}
        class="w-full bg-primary text-bg-dark font-display font-bold text-sm uppercase px-8 py-6 rounded-xl neon-shadow-cyan transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] hover:brightness-110 flex items-center justify-center gap-4"
      >
        {#if generator.loading}
          System Pracuje... <span class="material-symbols-outlined animate-spin"
            >sync</span
          >
        {:else}
          Generuj próbkę ataku <span class="material-symbols-outlined"
            >bolt</span
          >
        {/if}
      </button>
    </div>
  </div>

  <!-- Right side – Terminal -->
  <div
    class="glass rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative bg-black/80 fade-up"
    style="transition-delay: 200ms;"
  >
    <!-- Sweeping top-bar light -->
    <div class="absolute top-0 left-0 w-full h-px overflow-hidden">
      {#if generator.loading}
        <div
          class="w-[40%] h-full bg-primary/60"
          style="animation: sweep 2s ease-in-out infinite;"
        ></div>
      {/if}
    </div>

    <div
      class="bg-slate-900/60 px-6 py-4 flex items-center justify-between border-b border-white/5"
    >
      <div class="flex gap-2">
        <div
          class="size-3 rounded-full bg-red-500/30 hover:bg-red-500 transition-colors duration-300 cursor-pointer"
        ></div>
        <div
          class="size-3 rounded-full bg-yellow-500/30 hover:bg-yellow-500 transition-colors duration-300 cursor-pointer"
        ></div>
        <div
          class="size-3 rounded-full bg-green-500/30 hover:bg-green-500 transition-colors duration-300 cursor-pointer"
        ></div>
      </div>
      <div
        class="font-mono text-[10px] text-slate-500 tracking-widest uppercase auto-glitch"
      >
        NEXUS_SYSTEM_CONSOLE V3.1
      </div>
    </div>
    <div class="p-8 font-mono text-sm min-h-[500px] overflow-y-auto space-y-3">
      {#each terminalLines as line}
        <div
          class="text-slate-500 text-xs {line.includes('nexus@')
            ? 'text-slate-100! text-sm!'
            : ''} {line.includes('[ERROR]')
            ? 'text-red-400!'
            : ''} {line.includes('[SYSTEM]') ? 'italic' : ''}"
        >
          {line}
        </div>
      {/each}

      {#if generator.completion}
        <div class="text-primary text-xs font-bold mt-4">
          [AI] Generowanie hiper-spersonalizowanego draftu...
        </div>
        <div
          class="bg-white/5 p-6 rounded-xl border-l-2 border-primary/40 mt-6 space-y-3"
        >
          <div
            class="text-[10px] text-primary/50 uppercase font-bold tracking-widest"
          >
            Wynik Draftu:
          </div>
          <div class="text-white/90 leading-relaxed italic whitespace-pre-wrap">
            {generator.completion}
          </div>
        </div>
      {/if}

      <div class="flex items-center gap-1 mt-6">
        <span class="text-primary">root@nexus:</span><span class="text-white"
          >_</span
        >
        <span class="glitch-caret blink"></span>
      </div>
    </div>
  </div>
</section>

<style>
  @keyframes sweep {
    0% {
      transform: translateX(-100%);
    }
    50% {
      transform: translateX(350%);
    }
    100% {
      transform: translateX(-100%);
    }
  }
  .blink {
    animation: blink-anim 1s step-end infinite;
    display: inline-block;
    width: 0.6em;
    height: 1.2em;
    background-color: white;
    vertical-align: middle;
  }
  @keyframes blink-anim {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }
  .glass {
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }
</style>
