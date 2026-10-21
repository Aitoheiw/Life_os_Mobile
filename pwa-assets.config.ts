import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Génère les icônes PNG de la PWA à partir du logo (commande : npm run icons).
// Logo « collines » : une scène pleine page avec son propre fond → aucune marge ajoutée.
// (Le soleil reste dans la zone centrale, donc rien n'est coupé par les masques ronds d'Android.)
// Fond de secours crème : iOS n'accepte pas la transparence pour l'écran d'accueil.
const background = '#f7efe3';

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background } },
  },
  images: ['public/icon-app.svg'],
});
