import { describe, expect, it } from 'vitest';
import { db } from './database';
import { completeTask, createTask, deleteTask, reopenTask, setFocus, updateTask } from './tasks';
import { createProject, deleteProject, updateProject } from './projects';
import { isOverdue } from '../domain/tasks';
import { nextAction, projectProgress } from '../domain/projects';
import { nextOccurrence } from '../domain/recurrence';

const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h);

describe('tâches : création et modification', () => {
  it('crée une tâche avec des valeurs par défaut', async () => {
    const t = await createTask({ title: '  Appeler le dentiste  ' });
    expect(t.title).toBe('Appeler le dentiste');
    expect(t.status).toBe('todo');
    expect(t.priority).toBe('medium');
    expect(await db.tasks.get(t.id)).toEqual(t);
  });

  it('refuse un titre vide', async () => {
    await expect(createTask({ title: '   ' })).rejects.toThrow('Le titre est obligatoire.');
    expect(await db.tasks.count()).toBe(0);
  });

  it('refuse une échéance invalide', async () => {
    await expect(createTask({ title: 'x', dueDate: '2026-13-01' })).rejects.toThrow(/Date invalide/);
  });

  it('modifie une tâche et met à jour updatedAt', async () => {
    const t = await createTask({ title: 'A' }, at(2026, 10, 1));
    const u = await updateTask(t.id, { title: 'B', priority: 'high' }, at(2026, 10, 2));
    expect(u.title).toBe('B');
    expect(u.priority).toBe('high');
    expect(u.updatedAt > t.updatedAt).toBe(true);
  });

  it('terminer conserve la tâche dans l’historique avec sa date de fin', async () => {
    const t = await createTask({ title: 'A' });
    const done = await completeTask(t.id, at(2026, 10, 17, 23));
    expect(done.status).toBe('done');
    expect(done.completedAt).not.toBeNull();
    expect(await db.tasks.count()).toBe(1);
    const reopened = await reopenTask(t.id);
    expect(reopened.completedAt).toBeNull();
  });

  it('compte les reports d’échéance', async () => {
    const t = await createTask({ title: 'A', dueDate: '2026-10-10' });
    await updateTask(t.id, { dueDate: '2026-10-12' });
    const u = await updateTask(t.id, { dueDate: '2026-10-11' }); // avancer ne compte pas
    expect(u.postponedCount).toBe(1);
  });

  it('limite les priorités du jour à 3', async () => {
    const tasks = await Promise.all(['a', 'b', 'c', 'd'].map((title) => createTask({ title })));
    for (const t of tasks.slice(0, 3)) await setFocus(t.id, '2026-10-17');
    await expect(setFocus(tasks[3]!.id, '2026-10-17')).rejects.toThrow(/déjà 3 priorités/);
    // Re-marquer une tâche déjà prioritaire ne compte pas double.
    await setFocus(tasks[0]!.id, '2026-10-17');
    await setFocus(tasks[3]!.id, '2026-10-18');
    expect(await db.tasks.where('focusDate').equals('2026-10-17').count()).toBe(3);
  });
});

describe('tâches en retard', () => {
  it('en retard seulement si non terminée et échéance strictement passée', () => {
    expect(isOverdue({ status: 'todo', dueDate: '2026-10-16' }, '2026-10-17')).toBe(true);
    expect(isOverdue({ status: 'todo', dueDate: '2026-10-17' }, '2026-10-17')).toBe(false);
    expect(isOverdue({ status: 'done', dueDate: '2026-10-01' }, '2026-10-17')).toBe(false);
    expect(isOverdue({ status: 'in_progress', dueDate: null }, '2026-10-17')).toBe(false);
  });
});

describe('tâches récurrentes', () => {
  it('calcule la prochaine occurrence', () => {
    expect(nextOccurrence({ type: 'daily', interval: 1 }, '2026-10-17', '2026-10-17')).toBe('2026-10-18');
    // Terminée en retard : pas d'occurrence dans le passé.
    expect(nextOccurrence({ type: 'daily', interval: 2 }, '2026-10-10', '2026-10-17')).toBe('2026-10-18');
    // Lundi et jeudi ; terminée le samedi 17 → lundi 19.
    expect(nextOccurrence({ type: 'weekly', days: [1, 4] }, '2026-10-15', '2026-10-17')).toBe('2026-10-19');
    expect(nextOccurrence({ type: 'monthly', dayOfMonth: 31 }, '2026-01-31', '2026-01-31')).toBe('2026-02-28');
  });

  it('crée une seule occurrence suivante, sans doublon', async () => {
    const t = await createTask({ title: 'Arroser', dueDate: '2026-10-17', recurrence: { type: 'daily', interval: 1 } });
    await completeTask(t.id, at(2026, 10, 17));
    let series = await db.tasks.where('seriesId').equals(t.seriesId!).toArray();
    expect(series).toHaveLength(2);
    const next = series.find((s) => s.status !== 'done')!;
    expect(next.dueDate).toBe('2026-10-18');

    // Rouvrir puis re-terminer l'ancienne occurrence ne doit pas en créer une 3e.
    await reopenTask(t.id);
    await completeTask(t.id, at(2026, 10, 17));
    series = await db.tasks.where('seriesId').equals(t.seriesId!).toArray();
    expect(series).toHaveLength(2);
  });
});

describe('relation tâches / projets', () => {
  it('calcule progression et prochaine action à partir des vraies tâches', async () => {
    const p = await createProject({ title: 'Déménager' });
    const a = await createTask({ title: 'Cartons', projectId: p.id, priority: 'low' });
    const b = await createTask({ title: 'Résilier box', projectId: p.id, priority: 'high' });
    await createTask({ title: 'Hors projet' });
    await completeTask(a.id);

    const tasks = await db.tasks.toArray();
    expect(projectProgress(p, tasks)).toEqual({ done: 1, total: 2, ratio: 0.5 });
    expect(nextAction(p, tasks)?.id).toBe(b.id);

    // Un projet sans tâche n'a pas de pourcentage inventé.
    const empty = await createProject({ title: 'Vide' });
    expect(projectProgress(empty, tasks).ratio).toBeNull();
  });

  it('la prochaine action explicite prime tant qu’elle est ouverte', async () => {
    const p = await createProject({ title: 'P' });
    const a = await createTask({ title: 'A', projectId: p.id, priority: 'low' });
    await createTask({ title: 'B', projectId: p.id, priority: 'high' });
    const updated = await updateProject(p.id, { nextActionTaskId: a.id });
    expect(nextAction(updated, await db.tasks.toArray())?.id).toBe(a.id);
  });

  it('supprimer un projet conserve et détache ses tâches', async () => {
    const p = await createProject({ title: 'P' });
    const t = await createTask({ title: 'A', projectId: p.id });
    await deleteProject(p.id);
    expect(await db.projects.count()).toBe(0);
    expect((await db.tasks.get(t.id))?.projectId).toBeNull();
  });

  it('supprimer une tâche nettoie la prochaine action du projet', async () => {
    const p = await createProject({ title: 'P' });
    const t = await createTask({ title: 'A', projectId: p.id });
    await updateProject(p.id, { nextActionTaskId: t.id });
    await deleteTask(t.id);
    expect((await db.projects.get(p.id))?.nextActionTaskId).toBeNull();
  });
});
