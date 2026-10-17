/**
 * Dates "calendaires" locales.
 *
 * Règle centrale de l'application : un jour (échéance, validation d'habitude,
 * semaine de bilan) est stocké sous forme de texte `YYYY-MM-DD` calculé avec
 * l'heure LOCALE du navigateur. On n'utilise jamais `toISOString()` pour un
 * jour, car elle convertit en UTC : à 23h30 à Paris, elle donnerait le
 * lendemain (ou la veille selon le fuseau).
 */

/** Jour calendaire local au format `YYYY-MM-DD`. */
export type LocalDate = string;

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number) => String(n).padStart(2, '0');

/** Convertit un instant en jour local. */
export function toLocalDate(date: Date): LocalDate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Jour local actuel. `now` est injectable pour les tests. */
export function today(now: Date = new Date()): LocalDate {
  return toLocalDate(now);
}

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string') return false;
  const m = LOCAL_DATE_RE.exec(value);
  if (!m) return false;
  const d = parseLocalDate(value);
  return toLocalDate(d) === value;
}

/** Convertit `YYYY-MM-DD` en Date à midi local (midi évite les pièges des changements d'heure). */
export function parseLocalDate(value: LocalDate): Date {
  const m = LOCAL_DATE_RE.exec(value);
  if (!m) throw new Error(`Date invalide : ${value}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
}

export function addDays(value: LocalDate, days: number): LocalDate {
  const d = parseLocalDate(value);
  d.setDate(d.getDate() + days);
  return toLocalDate(d);
}

/** Ajoute des mois en restant sur le dernier jour du mois si besoin (31 janv. + 1 mois = 28/29 févr.). */
export function addMonths(value: LocalDate, months: number, preferredDay?: number): LocalDate {
  const d = parseLocalDate(value);
  const day = preferredDay ?? d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1, 12);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0, 12).getDate();
  target.setDate(Math.min(day, lastDay));
  return toLocalDate(target);
}

/** Nombre de jours entre deux dates (b - a). */
export function diffDays(a: LocalDate, b: LocalDate): number {
  const ms = parseLocalDate(b).getTime() - parseLocalDate(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Jour de la semaine : 0 = dimanche … 6 = samedi (convention JavaScript). */
export function weekday(value: LocalDate): number {
  return parseLocalDate(value).getDay();
}

/** Lundi de la semaine contenant ce jour (semaines ISO, du lundi au dimanche). */
export function startOfWeek(value: LocalDate): LocalDate {
  const offset = (weekday(value) + 6) % 7; // lundi → 0, dimanche → 6
  return addDays(value, -offset);
}

/** Liste des jours de `from` à `to` inclus. */
export function dateRange(from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Instant actuel en ISO (pour createdAt / updatedAt, pas pour les jours). */
export function nowIso(now: Date = new Date()): string {
  return now.toISOString();
}

export const WEEKDAY_SHORT = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'] as const;
/** Ordre d'affichage : lundi en premier. */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const longFormatter = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

/** Libellé lisible : "Aujourd'hui", "Demain", "Hier" ou "ven. 17 oct.". */
export function formatRelative(value: LocalDate, ref: LocalDate = today()): string {
  const diff = diffDays(ref, value);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  if (diff === -1) return 'Hier';
  return dateFormatter.format(parseLocalDate(value));
}

export function formatLong(value: LocalDate): string {
  const s = longFormatter.format(parseLocalDate(value));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatShort(value: LocalDate): string {
  return dateFormatter.format(parseLocalDate(value));
}
