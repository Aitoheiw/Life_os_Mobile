import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Génère les icônes PNG de la PWA à partir du logo (commande : npm run icons).
// Fond crème partout : iOS n'accepte pas la transparence pour l'écran d'accueil.
const background = '#f4efe6';

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0.15, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, padding: 0.15, resizeOptions: { background } },
  },
  images: ['public/icon-app.svg'],
});
