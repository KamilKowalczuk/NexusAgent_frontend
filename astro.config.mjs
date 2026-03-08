// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
  adapter: netlify(),
  integrations: [svelte()],
  build: {
    // Wbuduj CSS inline w HTML zamiast osobnych plików blokujących render
    // Eliminuje render-blocking /_astro/*.css (główna przyczyna FCP 5s)
    inlineStylesheets: 'always',
  },
  vite: {
    plugins: [tailwindcss()]
  }
});