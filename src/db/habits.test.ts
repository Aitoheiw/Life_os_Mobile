import { describe, expect, it } from 'vitest';
import { db } from './database';
import { archiveHabit, createHabit, pauseHabit, reorderHabits, resumeHabit, toggleHabitLog } from './habits';
import { habitStats, habitsDueOn, isScheduledOn, moveHabit, sortHabits } from '../domain/habits';
import { today } from '../domain/dates';
import type { Habit } from '../models';

const at = (y: number, m: number, d: number, h = 10, min = 0) => new Date(y, m - 1, d, h, min);

describe('suivi quotidien des habitudes', () => {
  it('valide en un clic, et un second clic annule', async () => {
    const h = await createHabit({ name: 'Lire', startDate: '2026-10-01' }, at(2026, 10, 1));
    expect(await toggleHabitLog(h.id, '2026-10-17', at(2026, 10, 17))).toBe(true);
    expect(await db.habitLogs.count()).toBe(1);
    expect(await toggleHabitLog(h.id, '2026-10-17', at(2026, 10, 17))).toBe(false);
    expect(await db.habitLogs.count()).toBe(0);
  });

  it('empêche les doubles validations au niveau de la base', async () => {
    const h = await createHabit({ name: 'Lire' });
    const row = { habitId: h.id, date: '2026-10-17', createdAt: new Date().toISOString() };
    await db.habitLogs.add({ id: 'a', ...row });
    await expect(db.habitLogs.add({ id: 'b', ...row })).rejects.toThrow();
    expect(await db.habitLogs.count()).toBe(1);
  });

  it('une validation à 23h50 est enregistrée sur le jour local', async () => {
    const h = await createHabit({ name: 'Méditer', startDate: '2026-10-01' }, at(2026, 10, 1));
    const lateNight = at(2026, 10, 17, 23, 50); // 21h50 UTC
    await toggleHabitLog(h.id, today(lateNight), lateNight);
    const logs = await db.habitLogs.toArray();
    expect(logs[0]?.date).toBe('2026-10-17');
  });

  it('refuse de valider un jour futur', async () => {
    const h = await createHabit({ name: 'Lire' }, at(2026, 10, 17));
    await expect(toggleHabitLog(h.id, '2026-10-18', at(2026, 10, 17))).rejects.toThrow(/futur/);
  });
});

describe('régularité et jours prévus', () => {
  const base: Habit = {
    id: 'h',
    name: 'Sport',
    description: '',
    frequency: { type: 'weekly', days: [1, 3, 5] }, // lun, mer, ven
    status: 'active',
    startDate: '2026-10-01',
    pauses: [],
    archivedAt: null,
    sortOrder: null,
    createdAt: '',
    updatedAt: '',
  };
  const log = (date: string) => ({ id: date, habitId: 'h', date, createdAt: '' });

  it('ne compte que les jours prévus', () => {
    expect(isScheduledOn(base, '2026-10-12')).toBe(true); // lundi
    expect(isScheduledOn(base, '2026-10-13')).toBe(false); // mardi
    // Semaine du 11 au 17 oct. : lun 12, mer 14, ven 16 prévus ; 2 réalisés.
    const stats = habitStats(base, [log('2026-10-12'), log('2026-10-16'), log('2026-10-13')], '2026-10-17', 7);
    expect(stats).toEqual({ scheduled: 3, completed: 2, rate: 2 / 3 });
  });

  it('aujourd’hui non validé ne pénalise pas encore', () => {
    const daily: Habit = { ...base, frequency: { type: 'daily' } };
    const s = habitStats(daily, [log('2026-10-16')], '2026-10-17', 2);
    expect(s).toEqual({ scheduled: 1, completed: 1, rate: 1 });
  });

  it('les jours de suspension ne comptent pas', () => {
    const daily: Habit = { ...base, frequency: { type: 'daily' }, pauses: [{ from: '2026-10-13', to: '2026-10-16' }] };
    const s = habitStats(daily, [log('2026-10-11'), log('2026-10-12')], '2026-10-17', 7);
    // 11, 12 prévus et faits ; 13–16 suspendus ; 17 (aujourd'hui) non fait → ignoré.
    expect(s).toEqual({ scheduled: 2, completed: 2, rate: 1 });
  });

  it('les jours avant la création ne comptent pas', () => {
    const recent: Habit = { ...base, frequency: { type: 'daily' }, startDate: '2026-10-16' };
    expect(habitStats(recent, [log('2026-10-16')], '2026-10-17', 30).scheduled).toBe(1);
  });

  it('pas de taux si aucun jour prévu', () => {
    expect(habitStats(base, [], '2026-10-14', 1).rate).toBeNull();
  });

  it('suspendre puis reprendre crée une période de pause correcte', async () => {
    const h = await createHabit({ name: 'Courir', startDate: '2026-10-01' }, at(2026, 10, 1));
    await pauseHabit(h.id, at(2026, 10, 10));
    const resumed = await resumeHabit(h.id, at(2026, 10, 15));
    expect(resumed.status).toBe('active');
    expect(resumed.pauses).toEqual([{ from: '2026-10-10', to: '2026-10-14' }]);
    expect(habitsDueOn([resumed], '2026-10-12')).toHaveLength(0);
    expect(habitsDueOn([resumed], '2026-10-15')).toHaveLength(1);
  });

  it('une habitude archivée garde son historique mais n’est plus due', async () => {
    const h = await createHabit({ name: 'Courir' }, at(2026, 10, 1));
    await toggleHabitLog(h.id, '2026-10-01', at(2026, 10, 1));
    const archived = await archiveHabit(h.id, at(2026, 10, 5));
    expect(habitsDueOn([archived], '2026-10-06')).toHaveLength(0);
    expect(await db.habitLogs.count()).toBe(1);
  });
});

describe('ordre des habitudes', () => {
  it('nouvelles habitudes à la fin, puis ordre choisi conservé', async () => {
    await createHabit({ name: 'Lire' }, at(2026, 10, 1));
    await createHabit({ name: 'Code' }, at(2026, 10, 2));
    const sport = await createHabit({ name: 'Sport' }, at(2026, 10, 3));
    const names = async () => sortHabits(await db.habits.toArray()).map((h) => h.name);
    expect(await names()).toEqual(['Lire', 'Code', 'Sport']);

    // Sport monte d'un cran, puis encore d'un cran → tout en haut.
    await reorderHabits(moveHabit(await db.habits.toArray(), sport.id, -1)!);
    await reorderHabits(moveHabit(await db.habits.toArray(), sport.id, -1)!);
    expect(await names()).toEqual(['Sport', 'Lire', 'Code']);
    // Déjà en haut : impossible de monter plus.
    expect(moveHabit(await db.habits.toArray(), sport.id, -1)).toBeNull();

    // Une nouvelle habitude (jamais classée) arrive en bas.
    await createHabit({ name: 'Anglais' }, at(2026, 10, 4));
    expect(await names()).toEqual(['Sport', 'Lire', 'Code', 'Anglais']);
  });

  it('ne déplace qu’à l’intérieur du même statut', async () => {
    const a = await createHabit({ name: 'A' }, at(2026, 10, 1));
    const b = await createHabit({ name: 'B' }, at(2026, 10, 2));
    const c = await createHabit({ name: 'C' }, at(2026, 10, 3));
    await archiveHabit(b.id, at(2026, 10, 5));
    // C monte : il passe devant A (B, archivée, est ignorée et garde sa place).
    await reorderHabits(moveHabit(await db.habits.toArray(), c.id, -1)!);
    const sorted = sortHabits(await db.habits.toArray());
    expect(sorted.filter((h) => h.status === 'active').map((h) => h.name)).toEqual(['C', 'A']);
    expect(sorted.map((h) => h.id)).toContain(a.id);
  });

  it('une ancienne habitude sans champ sortOrder reste lisible', () => {
    const old = { id: 'x', name: 'Vieux', createdAt: '2026-01-01T00:00:00.000Z' } as unknown as Habit;
    expect(sortHabits([old]).map((h) => h.id)).toEqual(['x']);
  });
});
