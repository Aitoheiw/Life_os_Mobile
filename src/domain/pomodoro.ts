/**
 * Minuteur Pomodoro — logique pure (aucun accès au navigateur ni à la base).
 *
 * Fiabilité : on ne compte pas les secondes une à une (un onglet en arrière-plan
 * ralentit les minuteurs du navigateur). On mémorise l'INSTANT DE FIN (`endsAt`)
 * et on calcule le temps restant à partir de l'heure actuelle.
 */

export type Phase = 'focus' | 'short' | 'long';
export type TimerStatus = 'idle' | 'running' | 'paused';

export interface PomodoroSettings {
  focusMinutes: number;
  shortMinutes: number;
  longMinutes: number;
  /** Pause longue toutes les N sessions de focus. */
  longEvery: number;
}

export const DEFAULT_SETTINGS: PomodoroSettings = { focusMinutes: 25, shortMinutes: 5, longMinutes: 15, longEvery: 4 };

export interface TimerState {
  phase: Phase;
  status: TimerStatus;
  /** Instant de fin (ms) quand le minuteur tourne. */
  endsAt: number | null;
  /** Temps restant (ms) quand il est en pause ou à l'arrêt. */
  remainingMs: number;
  /** Début de la phase en cours (premier démarrage), sert d'identifiant de session. */
  startedAt: number | null;
  /** Sessions de focus terminées dans le cycle courant (remis à 0 après une pause longue). */
  completedInCycle: number;
  taskId: string | null;
}

export const PHASE_LABELS: Record<Phase, string> = { focus: 'Focus', short: 'Pause courte', long: 'Pause longue' };

export function phaseDurationMs(phase: Phase, s: PomodoroSettings): number {
  const minutes = phase === 'focus' ? s.focusMinutes : phase === 'short' ? s.shortMinutes : s.longMinutes;
  return minutes * 60_000;
}

export function initialState(s: PomodoroSettings = DEFAULT_SETTINGS): TimerState {
  return { phase: 'focus', status: 'idle', endsAt: null, remainingMs: phaseDurationMs('focus', s), startedAt: null, completedInCycle: 0, taskId: null };
}

export function remainingMs(state: TimerState, now: number): number {
  if (state.status === 'running' && state.endsAt !== null) return Math.max(0, state.endsAt - now);
  return state.remainingMs;
}

export function start(state: TimerState, now: number): TimerState {
  if (state.status === 'running') return state;
  return { ...state, status: 'running', endsAt: now + state.remainingMs, startedAt: state.startedAt ?? now };
}

export function pause(state: TimerState, now: number): TimerState {
  if (state.status !== 'running') return state;
  return { ...state, status: 'paused', remainingMs: remainingMs(state, now), endsAt: null };
}

/** Change de phase manuellement (minuteur remis à zéro, session en cours abandonnée). */
export function switchPhase(state: TimerState, phase: Phase, s: PomodoroSettings): TimerState {
  return { ...state, phase, status: 'idle', endsAt: null, startedAt: null, remainingMs: phaseDurationMs(phase, s) };
}

export function reset(state: TimerState, s: PomodoroSettings): TimerState {
  return switchPhase(state, state.phase, s);
}

/** Phase qui suit une phase terminée. */
export function nextPhase(finished: Phase, completedInCycle: number, s: PomodoroSettings): Phase {
  if (finished !== 'focus') return 'focus';
  return completedInCycle > 0 && completedInCycle % s.longEvery === 0 ? 'long' : 'short';
}

export interface FinishedPhase {
  phase: Phase;
  startedAt: number;
  endedAt: number;
  minutes: number;
}

/**
 * Si la phase en cours est arrivée à son terme, renvoie l'état suivant (à l'arrêt,
 * prêt à démarrer) et la phase terminée. Sinon renvoie null.
 * L'enchaînement n'est pas automatique : c'est l'utilisateur qui relance.
 */
export function complete(state: TimerState, now: number, s: PomodoroSettings): { next: TimerState; finished: FinishedPhase } | null {
  if (state.status !== 'running' || state.endsAt === null || now < state.endsAt) return null;
  const doneInCycle = state.phase === 'focus' ? state.completedInCycle + 1 : state.phase === 'long' ? 0 : state.completedInCycle;
  const phase = nextPhase(state.phase, doneInCycle, s);
  const finished: FinishedPhase = {
    phase: state.phase,
    startedAt: state.startedAt ?? state.endsAt,
    endedAt: state.endsAt,
    minutes: Math.round(phaseDurationMs(state.phase, s) / 60_000),
  };
  return {
    next: { ...state, phase, status: 'idle', endsAt: null, startedAt: null, remainingMs: phaseDurationMs(phase, s), completedInCycle: doneInCycle },
    finished,
  };
}

/** Format mm:ss (arrondi à la seconde supérieure : 0:00 n'apparaît qu'à la fin). */
export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

/** Total des sessions de focus entre deux jours inclus. */
export function focusTotals(sessions: { date: string; minutes: number }[], from: string, to: string): { count: number; minutes: number } {
  const inRange = sessions.filter((s) => s.date >= from && s.date <= to);
  return { count: inRange.length, minutes: inRange.reduce((sum, s) => sum + s.minutes, 0) };
}

/** Valide des réglages venant du stockage local (valeurs absurdes → défaut). */
export function sanitizeSettings(raw: unknown): PomodoroSettings {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const pick = (key: keyof PomodoroSettings, min: number, max: number) => {
    const v = Number(r[key]);
    return Number.isInteger(v) && v >= min && v <= max ? v : DEFAULT_SETTINGS[key];
  };
  return { focusMinutes: pick('focusMinutes', 1, 180), shortMinutes: pick('shortMinutes', 1, 60), longMinutes: pick('longMinutes', 1, 120), longEvery: pick('longEvery', 2, 12) };
}
