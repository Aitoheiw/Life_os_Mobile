import { useSyncExternalStore } from 'react';

/** Thème clair (crème) / sombre. Clair par défaut ; le choix est mémorisé dans le navigateur. */
export type Theme = 'dark' | 'light';
const KEY = 'life-os-theme';
const EVENT = 'life-os-theme-change';

export function getStoredTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function apply(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#181612' : '#f4efe6');
}

export function setTheme(theme: Theme): void {
  // Fondu enchaîné entre les deux thèmes si le navigateur le permet.
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (doc.startViewTransition && !reduced) doc.startViewTransition(() => apply(theme));
  else apply(theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Stockage indisponible (navigation privée) : le thème s'applique quand même pour la session.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function applyStoredTheme(): void {
  apply(getStoredTheme());
}

/** Thème courant, partagé par tous les composants (bouton de la sidebar, page Réglages…). */
export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(
    (onChange) => {
      // Changement depuis un autre onglet : on réapplique la classe puis on prévient React.
      const onStorage = () => {
        applyStoredTheme();
        onChange();
      };
      window.addEventListener(EVENT, onChange);
      window.addEventListener('storage', onStorage);
      return () => {
        window.removeEventListener(EVENT, onChange);
        window.removeEventListener('storage', onStorage);
      };
    },
    getStoredTheme,
  );
  return [theme, setTheme];
}
