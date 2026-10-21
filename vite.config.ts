/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // PWA : manifeste (installation sur l'écran d'accueil) + service worker (fonctionne hors ligne).
    // Toute l'app est mise en cache ; une nouvelle version s'installe automatiquement au prochain lancement.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Life OS',
        short_name: 'Life OS',
        description: 'Tâches, projets, objectifs, habitudes, notes et focus.',
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f4efe6',
        theme_color: '#f4efe6',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Aujourd’hui', url: '/' },
          { name: 'Habitudes', url: '/habits' },
          { name: 'Focus', url: '/focus' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Toutes les routes (BrowserRouter) servent index.html, même hors ligne.
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  // Application locale chargée une seule fois : un bundle unique (~170 Ko gzip) est acceptable.
  build: { chunkSizeWarningLimit: 800 },
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    // Fuseau fixe pour des tests de dates reproductibles (voir src/domain/dates.test.ts).
    env: { TZ: 'Europe/Paris' },
  },
});
