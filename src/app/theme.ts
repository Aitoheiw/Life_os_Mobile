/** Thème clair / sombre. Sombre par défaut ; le choix est mémorisé dans le navigateur. */
export type Theme = 'dark' | 'light';
const KEY = 'life-os-theme';

export function getStoredTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function setTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Stockage indisponible (navigation privée) : le thème s'applique quand même pour la session.
  }
}

export function applyStoredTheme(): void {
  document.documentElement.classList.toggle('dark', getStoredTheme() === 'dark');
}
