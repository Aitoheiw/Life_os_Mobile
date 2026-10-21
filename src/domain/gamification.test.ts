import { describe, expect, it } from 'vitest';
import type { Habit, HabitLog } from '../models';
import { computeGamification, countPerfectDays, habitProgress, levelFromXp, xpForToday } from './gamification';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1',
  name: 'Lire',
  description: '',
  frequency: { type: 'daily' },
  status: 'active',
  startDate: '2026-10-01',
  pauses: [],
  archivedAt: null,
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-01T08:00:00.000Z',
  ...over,
});
const logsFor = (habitId: string, dates: string[]): HabitLog[] => dates.map((date) => ({ id: `${habitId}-${date}`, habitId, date, createdAt: `${date}T10:00:00.000Z` }));

describe('séries et XP d’une habitude', () => {
  it('compte une série et ajoute un bonus croissant', () => {
    const p = habitProgress(habit(), logsFor('h1', ['2026-10-01', '2026-10-02', '2026-10-03']), '2026-10-03');
    expect(p.currentStreak).toBe(3);
    expect(p.bestStreak).toBe(3);
    expect(p.xp).toBe(10 + 11 + 12);
    expect(p.completions).toBe(3);
  });

  it('un jour prévu manqué remet la série à zéro, le record est conservé', () => {
    const p = habitProgress(habit(), logsFor('h1', ['2026-10-01', '2026-10-02', '2026-10-04']), '2026-10-04');
    expect(p.currentStreak).toBe(1);
    expect(p.bestStreak).toBe(2);
  });

  it('aujourd’hui non fait ne casse pas la série, mais la signale en danger', () => {
    const p = habitProgress(habit(), logsFor('h1', ['2026-10-01', '2026-10-02']), '2026-10-03');
    expect(p.currentStreak).toBe(2);
    expect(p.streakAtRisk).toBe(true);
  });

  it('les jours non prévus ne cassent pas la série (habitude hebdomadaire)', () => {
    // 2026-10-05 = lundi, 2026-10-07 = mercredi
    const h = habit({ frequency: { type: 'weekly', days: [1, 3] }, startDate: '2026-10-05' });
    const p = habitProgress(h, logsFor('h1', ['2026-10-05', '2026-10-07']), '2026-10-08');
    expect(p.currentStreak).toBe(2);
    expect(p.streakAtRisk).toBe(false); // jeudi non prévu
  });

  it('une réalisation un jour non prévu rapporte 5 XP sans toucher la série', () => {
    const h = habit({ frequency: { type: 'weekly', days: [1] }, startDate: '2026-10-05' });
    const p = habitProgress(h, logsFor('h1', ['2026-10-05', '2026-10-06']), '2026-10-06');
    expect(p.xp).toBe(10 + 5);
    expect(p.currentStreak).toBe(1);
  });

  it('les jours suspendus ne cassent pas la série', () => {
    const h = habit({ pauses: [{ from: '2026-10-02', to: '2026-10-03' }] });
    const p = habitProgress(h, logsFor('h1', ['2026-10-01', '2026-10-04']), '2026-10-04');
    expect(p.currentStreak).toBe(2);
  });

  it('le bonus de série est plafonné', () => {
    const dates = Array.from({ length: 20 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
    const h = habit();
    const p = habitProgress(h, logsFor('h1', dates), '2026-10-21');
    expect(xpForToday(h, p, '2026-10-21')).toBe(20);
  });
});

describe('journées parfaites et niveaux', () => {
  it('compte les jours où toutes les habitudes prévues sont faites', () => {
    const a = habit({ id: 'a' });
    const b = habit({ id: 'b' });
    const logs = [...logsFor('a', ['2026-10-01', '2026-10-02']), ...logsFor('b', ['2026-10-01'])];
    expect(countPerfectDays([a, b], logs, '2026-10-02')).toBe(1);
  });

  it('calcule le niveau à partir de l’XP', () => {
    expect(levelFromXp(0)).toMatchObject({ level: 1, title: 'Graine', current: 0, needed: 100 });
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100)).toMatchObject({ level: 2, current: 0, needed: 200 });
    expect(levelFromXp(650)).toMatchObject({ level: 4, current: 50, needed: 400 });
  });

  it('résume XP, badges et habitudes du jour', () => {
    const s = computeGamification([habit()], logsFor('h1', ['2026-10-01', '2026-10-02', '2026-10-03']), '2026-10-03');
    expect(s.perfectDays).toBe(3);
    expect(s.totalXp).toBe(33 + 3 * 20);
    expect(s.today).toEqual({ due: 1, done: 1 });
    expect(s.badges.find((b) => b.id === 'streak-3')?.unlocked).toBe(true);
    expect(s.badges.find((b) => b.id === 'streak-7')).toMatchObject({ unlocked: false, value: 3, target: 7 });
  });
});
