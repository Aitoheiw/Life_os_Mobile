import type { Habit, HabitLog, ID } from '../models';
import { dateRange, type LocalDate } from './dates';
import { habitsDueOn, isScheduledOn } from './habits';

/*
 * Gamification des habitudes. Tout est CALCULÉ à partir des réalisations (habitLogs) :
 * rien n'est stocké en base, donc pas de migration et les sauvegardes restent compatibles.
 * Décocher une habitude retire simplement l'XP correspondante.
 *
 * Règles d'XP :
 * - réalisation un jour prévu : 10 XP + 1 XP par jour de série déjà acquis (bonus plafonné à 10) ;
 * - réalisation un jour non prévu (bonus) : 5 XP, la série n'est ni prolongée ni cassée ;
 * - journée parfaite (toutes les habitudes prévues du jour faites) : +20 XP.
 * Séries : seuls les jours prévus comptent. Aujourd'hui non fait ne casse pas la série
 * (la journée n'est pas finie) ; un jour prévu passé non fait la remet à zéro.
 */
export const XP_BASE = 10;
export const XP_STREAK_BONUS_MAX = 10;
export const XP_EXTRA_DAY = 5;
export const XP_PERFECT_DAY = 20;

export interface HabitProgress {
  completions: number;
  currentStreak: number;
  bestStreak: number;
  xp: number;
  /** Série en cours > 0, habitude prévue aujourd'hui et pas encore faite : à ne pas perdre ! */
  streakAtRisk: boolean;
}

/** Progression d'une habitude jusqu'au jour `ref` inclus. */
export function habitProgress(habit: Habit, logs: HabitLog[], ref: LocalDate): HabitProgress {
  const done = new Set(logs.filter((l) => l.habitId === habit.id && l.date <= ref).map((l) => l.date));
  // On démarre au plus tôt entre la date de début et la première réalisation.
  let from = habit.startDate;
  for (const d of done) if (d < from) from = d;

  let streak = 0;
  let best = 0;
  let xp = 0;
  let completions = 0;
  for (const day of from <= ref ? dateRange(from, ref) : []) {
    const isDone = done.has(day);
    if (isScheduledOn(habit, day)) {
      if (isDone) {
        streak++;
        best = Math.max(best, streak);
        xp += XP_BASE + Math.min(streak - 1, XP_STREAK_BONUS_MAX);
        completions++;
      } else if (day !== ref) {
        streak = 0;
      }
    } else if (isDone) {
      xp += XP_EXTRA_DAY;
      completions++;
    }
  }
  const dueToday = habit.status === 'active' && isScheduledOn(habit, ref);
  return { completions, currentStreak: streak, bestStreak: best, xp, streakAtRisk: dueToday && streak > 0 && !done.has(ref) };
}

/** XP gagnée si l'on valide l'habitude aujourd'hui (hors bonus de journée parfaite). */
export function xpForToday(habit: Habit, progress: HabitProgress, ref: LocalDate): number {
  if (!isScheduledOn(habit, ref)) return XP_EXTRA_DAY;
  return XP_BASE + Math.min(progress.currentStreak, XP_STREAK_BONUS_MAX);
}

/** Nombre de journées parfaites : au moins une habitude prévue, et toutes faites. */
export function countPerfectDays(habits: Habit[], logs: HabitLog[], ref: LocalDate): number {
  if (habits.length === 0) return 0;
  const done = new Set(logs.map((l) => `${l.habitId}|${l.date}`));
  const from = habits.reduce((min, h) => (h.startDate < min ? h.startDate : min), habits[0]!.startDate);
  let count = 0;
  for (const day of from <= ref ? dateRange(from, ref) : []) {
    const due = habits.filter((h) => isScheduledOn(h, day));
    if (due.length > 0 && due.every((h) => done.has(`${h.id}|${day}`))) count++;
  }
  return count;
}

// ---------- Niveaux ----------

/** Titres des niveaux : une plante qui grandit, comme une habitude. */
const LEVEL_TITLES = ['Graine', 'Pousse', 'Bourgeon', 'Feuillage', 'Arbuste', 'Jeune arbre', 'Arbre', 'Chêne', 'Bosquet', 'Forêt'];

export interface LevelInfo {
  level: number;
  title: string;
  /** XP acquise dans le niveau courant. */
  current: number;
  /** XP nécessaire pour passer au niveau suivant (100 × niveau). */
  needed: number;
  ratio: number;
}

/** Le niveau N commence à 50 × N × (N−1) XP : 0, 100, 300, 600, 1000… */
export const xpForLevel = (level: number) => 50 * level * (level - 1);

export function levelFromXp(xp: number): LevelInfo {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const current = xp - xpForLevel(level);
  const needed = xpForLevel(level + 1) - xpForLevel(level);
  const title = LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length) - 1]!;
  return { level, title: level > LEVEL_TITLES.length ? `${title} ancienne` : title, current, needed, ratio: current / needed };
}

// ---------- Badges ----------

export interface Badge {
  id: string;
  name: string;
  description: string;
  /** Valeur actuelle (plafonnée à la cible) et cible : permet d'afficher la progression. */
  value: number;
  target: number;
  unlocked: boolean;
}

interface BadgeInput {
  completions: number;
  bestStreak: number;
  perfectDays: number;
  level: number;
}

const BADGES: { id: string; name: string; description: string; target: number; metric: keyof BadgeInput }[] = [
  { id: 'first', name: 'Premier pas', description: 'Valider une habitude pour la première fois', target: 1, metric: 'completions' },
  { id: 'streak-3', name: 'Lancé', description: 'Une série de 3 jours prévus', target: 3, metric: 'bestStreak' },
  { id: 'streak-7', name: 'Semaine tenue', description: 'Une série de 7 jours prévus', target: 7, metric: 'bestStreak' },
  { id: 'streak-21', name: 'Ancrée', description: 'Une série de 21 jours prévus', target: 21, metric: 'bestStreak' },
  { id: 'streak-66', name: 'Seconde nature', description: 'Une série de 66 jours prévus', target: 66, metric: 'bestStreak' },
  { id: 'perfect-1', name: 'Journée parfaite', description: 'Toutes les habitudes du jour faites', target: 1, metric: 'perfectDays' },
  { id: 'perfect-10', name: 'Sans faute', description: '10 journées parfaites', target: 10, metric: 'perfectDays' },
  { id: 'total-100', name: 'Centurion', description: '100 réalisations au total', target: 100, metric: 'completions' },
  { id: 'level-5', name: 'Bien enraciné', description: 'Atteindre le niveau 5', target: 5, metric: 'level' },
];

export function computeBadges(input: BadgeInput): Badge[] {
  return BADGES.map(({ metric, target, ...b }) => {
    const value = Math.min(input[metric], target);
    return { ...b, value, target, unlocked: value >= target };
  });
}

// ---------- Résumé global ----------

export interface GamificationSummary {
  perHabit: Map<ID, HabitProgress>;
  totalXp: number;
  completions: number;
  bestStreak: number;
  perfectDays: number;
  level: LevelInfo;
  badges: Badge[];
  /** Habitudes prévues aujourd'hui et combien sont faites. */
  today: { due: number; done: number };
}

export function computeGamification(habits: Habit[], logs: HabitLog[], ref: LocalDate): GamificationSummary {
  const perHabit = new Map<ID, HabitProgress>();
  let habitXp = 0;
  let completions = 0;
  let bestStreak = 0;
  for (const h of habits) {
    const p = habitProgress(h, logs, ref);
    perHabit.set(h.id, p);
    habitXp += p.xp;
    completions += p.completions;
    bestStreak = Math.max(bestStreak, p.bestStreak);
  }
  const perfectDays = countPerfectDays(habits, logs, ref);
  const totalXp = habitXp + perfectDays * XP_PERFECT_DAY;
  const level = levelFromXp(totalXp);

  const due = habitsDueOn(habits, ref);
  const doneToday = new Set(logs.filter((l) => l.date === ref).map((l) => l.habitId));

  return {
    perHabit,
    totalXp,
    completions,
    bestStreak,
    perfectDays,
    level,
    badges: computeBadges({ completions, bestStreak, perfectDays, level: level.level }),
    today: { due: due.length, done: due.filter((h) => doneToday.has(h.id)).length },
  };
}
