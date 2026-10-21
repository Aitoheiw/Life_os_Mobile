import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { db, LifeOsDatabase, SCHEMA_VERSION } from './database';
import { recordFocusSession } from './focus';
import { createTask, deleteTask } from './tasks';
import { exportBackup, parseBackup } from '../backup/backup';
import { focusTotals } from '../domain/pomodoro';

const MIN = 60_000;
const at = (h: number, m = 0) => new Date(2026, 9, 17, h, m).getTime();

describe('sessions de focus', () => {
  it('enregistre une session sur le jour local de fin', async () => {
    const task = await createTask({ title: 'Rédiger' });
    // Session commencée à 23h40, finie à 00h05 le lendemain : comptée le 18.
    const s = await recordFocusSession({ phase: 'focus', startedAt: at(23, 40), endedAt: at(23, 40) + 25 * MIN, minutes: 25 }, task.id);
    expect(s?.date).toBe('2026-10-18');
    expect(s?.taskId).toBe(task.id);
  });

  it('enregistrer deux fois la même session ne crée pas de doublon', async () => {
    const finished = { phase: 'focus' as const, startedAt: at(10), endedAt: at(10, 25), minutes: 25 };
    await recordFocusSession(finished, null);
    await recordFocusSession(finished, null);
    expect(await db.focusSessions.count()).toBe(1);
  });

  it('n’enregistre pas les pauses', async () => {
    expect(await recordFocusSession({ phase: 'short', startedAt: at(10), endedAt: at(10, 5), minutes: 5 }, null)).toBeNull();
    expect(await db.focusSessions.count()).toBe(0);
  });

  it('supprimer la tâche conserve la session sans lien', async () => {
    const task = await createTask({ title: 'Rédiger' });
    await recordFocusSession({ phase: 'focus', startedAt: at(9), endedAt: at(9, 25), minutes: 25 }, task.id);
    await deleteTask(task.id);
    const [s] = await db.focusSessions.toArray();
    expect(s?.taskId).toBeNull();
  });

  it('calcule les totaux sur une période', () => {
    const sessions = [
      { date: '2026-10-16', minutes: 25 },
      { date: '2026-10-17', minutes: 25 },
      { date: '2026-10-17', minutes: 50 },
    ];
    expect(focusTotals(sessions, '2026-10-17', '2026-10-17')).toEqual({ count: 2, minutes: 75 });
  });
});

describe('migration du schéma v1 → version actuelle', () => {
  it('une base v1 existante est mise à niveau sans perte', async () => {
    const name = 'migration-test';
    const v1 = new Dexie(name);
    v1.version(1).stores({
      tasks: 'id, status, dueDate, projectId, focusDate, seriesId, completedAt, [seriesId+dueDate]',
      projects: 'id, status, goalId',
      goals: 'id, status',
      habits: 'id, status',
      habitLogs: 'id, habitId, date, &[habitId+date]',
      notes: 'id, kind, status, projectId, goalId, updatedAt',
      weeklyReviews: 'id, &weekStart',
    });
    await v1.table('tasks').add({ id: 't1', title: 'Ancienne tâche' });
    v1.close();

    const upgraded = new LifeOsDatabase(name);
    await upgraded.open();
    expect(upgraded.verno).toBe(SCHEMA_VERSION);
    expect((await upgraded.tasks.get('t1'))?.title).toBe('Ancienne tâche');
    expect(await upgraded.focusSessions.count()).toBe(0);
    expect(await upgraded.syncQueue.count()).toBe(0);
    upgraded.close();
    await Dexie.delete(name);
  });

  it('une sauvegarde v1 (sans sessions de focus) s’importe', async () => {
    await createTask({ title: 'A' });
    const backup = await exportBackup();
    const v1 = { ...backup, schemaVersion: 1, data: { ...backup.data } as Record<string, unknown> };
    delete v1.data.focusSessions;
    const parsed = parseBackup(JSON.stringify(v1));
    expect(parsed.backup.data.focusSessions).toEqual([]);
    expect(parsed.counts.tasks).toBe(1);
  });
});
