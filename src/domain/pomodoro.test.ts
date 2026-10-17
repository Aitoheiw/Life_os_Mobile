import { describe, expect, it } from 'vitest';
import { complete, DEFAULT_SETTINGS as S, formatClock, formatMinutes, initialState, pause, remainingMs, reset, sanitizeSettings, start, type TimerState } from './pomodoro';

const MIN = 60_000;

/** Fait tourner une phase jusqu'au bout et renvoie l'état suivant. */
function finish(state: TimerState, at: number) {
  const running = start(state, at);
  const result = complete(running, running.endsAt!, S);
  if (!result) throw new Error('phase non terminée');
  return result;
}

describe('minuteur pomodoro', () => {
  it('calcule le temps restant à partir de l’heure de fin (fiable en arrière-plan)', () => {
    const s = start(initialState(), 0);
    expect(remainingMs(s, 0)).toBe(25 * MIN);
    // L'onglet "dort" 10 minutes : le temps restant reste juste.
    expect(remainingMs(s, 10 * MIN)).toBe(15 * MIN);
    expect(remainingMs(s, 99 * MIN)).toBe(0);
  });

  it('pause puis reprise conserve le temps restant', () => {
    let s = start(initialState(), 0);
    s = pause(s, 5 * MIN);
    expect(remainingMs(s, 60 * MIN)).toBe(20 * MIN); // en pause, le temps ne s'écoule pas
    s = start(s, 60 * MIN);
    expect(s.endsAt).toBe(80 * MIN);
    expect(s.startedAt).toBe(0); // la session garde son instant de début
  });

  it('ne termine pas une phase avant son heure de fin', () => {
    const s = start(initialState(), 0);
    expect(complete(s, 25 * MIN - 1, S)).toBeNull();
    expect(complete(pause(s, 1), 99 * MIN, S)).toBeNull();
  });

  it('enchaîne focus → pause courte, et pause longue après 4 sessions', () => {
    let state = initialState();
    const phases: string[] = [];
    let t = 0;
    for (let i = 0; i < 9; i++) {
      const { next, finished } = finish(state, t);
      phases.push(finished.phase);
      t = finished.endedAt;
      state = next;
    }
    expect(phases).toEqual(['focus', 'short', 'focus', 'short', 'focus', 'short', 'focus', 'long', 'focus']);
    expect(state.completedInCycle).toBe(1); // nouveau cycle après la pause longue
  });

  it('décrit la session de focus terminée', () => {
    const { finished, next } = finish(initialState(), 1000);
    expect(finished).toEqual({ phase: 'focus', startedAt: 1000, endedAt: 1000 + 25 * MIN, minutes: 25 });
    expect(next.status).toBe('idle'); // pas d'enchaînement automatique
  });

  it('réinitialiser abandonne la session en cours', () => {
    const s = reset(start(initialState(), 0), S);
    expect(s.status).toBe('idle');
    expect(s.startedAt).toBeNull();
    expect(remainingMs(s, 0)).toBe(25 * MIN);
  });

  it('formate l’affichage', () => {
    expect(formatClock(25 * MIN)).toBe('25:00');
    expect(formatClock(61_500)).toBe('01:02');
    expect(formatClock(0)).toBe('00:00');
    expect(formatMinutes(50)).toBe('50 min');
    expect(formatMinutes(125)).toBe('2 h 05');
  });

  it('rejette des réglages invalides', () => {
    expect(sanitizeSettings({ focusMinutes: 50, shortMinutes: -3, longMinutes: 'x', longEvery: 4 })).toEqual({ focusMinutes: 50, shortMinutes: 5, longMinutes: 15, longEvery: 4 });
    expect(sanitizeSettings(null)).toEqual(S);
  });
});
