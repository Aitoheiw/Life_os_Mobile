/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Application locale chargée une seule fois : un bundle unique (~170 Ko gzip) est acceptable.
  build: { chunkSizeWarningLimit: 800 },
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    // Fuseau fixe pour des tests de dates reproductibles (voir src/domain/dates.test.ts).
    env: { TZ: 'Europe/Paris' },
  },
});
