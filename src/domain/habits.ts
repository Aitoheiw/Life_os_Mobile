import type { Habit, HabitLog, ID } from '../models';
import { addDays, dateRange, toLocalDate, weekday, type LocalDate } from './dates';

/**
 * Ordre d'affichage : la position choisie par l'utilisateur, puis la date de création.
 * Les habitudes jamais réordonnées (sortOrder null, ou champ absent des anciennes données) vont à la fin.
 */
export function sortHabits(habits: Habit[]): Habit[] {
  const pos = (h: Habit) => h.sortOrder ?? Number.POSITIVE_INFINITY;
  return [...habits].sort((a, b) => pos(a) - pos(b) || a.createdAt.localeCompare(b.createdAt));
}

/**
 * Monte (-1) ou descend (+1) une habitude parmi celles du même statut (actives, suspendues…).
 * Retourne le nouvel ordre COMPLET des id, ou null si elle est déjà en haut / en bas.
 */
export function moveHabit(habits: Habit[], id: ID, direction: -1 | 1): ID[] | null {
  const sorted = sortHabits(habits);
  const target = sorted.find((h) => h.id === id);
  if (!target) return null;
  const group = sorted.filter((h) => h.status === target.status).map((h) => h.id);
  const i = group.indexOf(id);
  const j = i + direction;
  if (j < 0 || j >= group.length) return null;
  [group[i], group[j]] = [group[j]!, group[i]!];
  // Les autres groupes gardent leurs places ; seul l'ordre à l'intérieur du groupe change.
  let next = 0;
  return sorted.map((h) => (h.status === target.status ? group[next++]! : h.id));
}

/** L'habitude est-elle suspendue ce jour-là ? (bornes de pause incluses) */
export function isPausedOn(habit: Pick<Habit, 'pauses'>, day: LocalDate): boolean {
  return habit.pauses.some((p) => p.from <= day && (p.to === null || day <= p.to));
}

/** Dernier jour pris en compte : la veille de l'archivage, sinon aucune limite. */
function lastActiveDay(habit: Pick<Habit, 'archivedAt'>): LocalDate | null {
  if (!habit.archivedAt) return null;
  return addDays(toLocalDate(new Date(habit.archivedAt)), -1);
}

/**
 * Le jour est-il "prévu" pour cette habitude ?
 * Non prévu si : avant le début, après l'archivage, pendant une suspension,
 * ou jour de semaine non sélectionné. Un jour non prévu ne pénalise jamais.
 */
export function isScheduledOn(habit: Habit, day: LocalDate): boolean {
  if (day < habit.startDate) return false;
  const last = lastActiveDay(habit);
  if (last !== null && day > last) return false;
  if (isPausedOn(habit, day)) return false;
  if (habit.frequency.type === 'weekly') return habit.frequency.days.includes(weekday(day));
  return true;
}

export interface HabitStats {
  /** Jours prévus dans la fenêtre (aujourd'hui compte seulement s'il est déjà validé). */
  scheduled: number;
  completed: number;
  /** completed / scheduled, ou null s'il n'y avait aucun jour prévu. */
  rate: number | null;
}

/**
 * Régularité sur les `days` derniers jours (aujourd'hui inclus).
 * Aujourd'hui n'est compté que s'il est validé : la journée n'est pas finie,
 * l'utilisateur n'est donc pas pénalisé le matin.
 * Seules les validations faites un jour prévu comptent (un bonus un jour non prévu
 * n'augmente pas artificiellement le taux au-delà de 100 %).
 */
export function habitStats(habit: Habit, logs: HabitLog[], ref: LocalDate, days: number): HabitStats {
  const done = new Set(logs.filter((l) => l.habitId === habit.id).map((l) => l.date));
  let scheduled = 0;
  let completed = 0;
  for (const day of dateRange(addDays(ref, -(days - 1)), ref)) {
    if (!isScheduledOn(habit, day)) continue;
    const isDone = done.has(day);
    if (day === ref && !isDone) continue;
    scheduled++;
    if (isDone) completed++;
  }
  return { scheduled, completed, rate: scheduled === 0 ? null : completed / scheduled };
}

/** Habitudes à afficher aujourd'hui : actives et prévues ce jour. */
export function habitsDueOn(habits: Habit[], day: LocalDate): Habit[] {
  return habits.filter((h) => h.status === 'active' && isScheduledOn(h, day));
}

export function describeFrequency(habit: Pick<Habit, 'frequency'>): string {
  if (habit.frequency.type === 'daily') return 'Tous les jours';
  const names = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  const ordered = [1, 2, 3, 4, 5, 6, 0].filter((d) => habit.frequency.type === 'weekly' && habit.frequency.days.includes(d));
  return ordered.map((d) => names[d]).join(', ');
}
