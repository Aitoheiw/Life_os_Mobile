import { describe, expect, it } from 'vitest';
import { db, LifeOsDatabase } from '../db/database';
import { createTask, completeTask } from '../db/tasks';
import { createGoal, createProject, updateProject } from '../db/projects';
import { createHabit, toggleHabitLog } from '../db/habits';
import { captureIdea, convertIdeaToTask, createNote } from '../db/notes';
import { saveWeeklyReview } from '../db/reviews';
import { exportBackup, parseBackup, restoreBackup } from './backup';

async function seed() {
  const goal = await createGoal({ title: 'Être en forme' });
  const project = await createProject({ title: 'Courir 10 km', goalId: goal.id });
  const task = await createTask({ title: 'Acheter chaussures', projectId: project.id });
  await updateProject(project.id, { nextActionTaskId: task.id });
  await completeTask((await createTask({ title: 'Recurrente', recurrence: { type: 'daily', interval: 1 } })).id);
  const habit = await createHabit({ name: 'Étirements', startDate: '2026-10-01' }, new Date(2026, 9, 1));
  await toggleHabitLog(habit.id, '2026-10-16', new Date(2026, 9, 17));
  await createNote({ title: 'Plan d’entraînement', content: '- lundi', projectId: project.id, goalId: goal.id });
  const idea = await captureIdea('Trouver un club');
  await convertIdeaToTask(idea.id);
  await saveWeeklyReview('2026-10-17', { wins: 'ok', difficulties: '', nextPriorities: ['a', 'b', 'c'] });
  return { goal, project, task, habit };
}

describe('export / import', () => {
  it('aller-retour complet sans perte de données ni de relations', async () => {
    const { goal, project, task, habit } = await seed();
    const before = await exportBackup();
    const json = JSON.stringify(before);

    // Base vidée puis restaurée depuis le fichier.
    await Promise.all(db.tables.map((t) => t.clear()));
    const parsed = parseBackup(json);
    expect(parsed.warnings).toEqual([]);
    await restoreBackup(parsed.backup);

    const after = await exportBackup();
    expect(after.data).toEqual(before.data);

    // Relations intactes.
    expect((await db.projects.get(project.id))?.goalId).toBe(goal.id);
    expect((await db.projects.get(project.id))?.nextActionTaskId).toBe(task.id);
    expect((await db.tasks.get(task.id))?.projectId).toBe(project.id);
    expect(await db.habitLogs.where('habitId').equals(habit.id).count()).toBe(1);
    const note = await db.notes.where('kind').equals('note').first();
    expect(note?.projectId).toBe(project.id);
    expect(note?.goalId).toBe(goal.id);
    const idea = await db.notes.where('kind').equals('idea').first();
    expect(await db.tasks.get(idea!.taskId!)).toBeDefined();
  });

  it('refuse un fichier qui n’est pas du JSON', () => {
    expect(() => parseBackup('pas du json')).toThrow('Le fichier n’est pas un JSON valide.');
  });

  it('refuse un JSON qui n’est pas une sauvegarde Life OS', () => {
    expect(() => parseBackup('{"hello": 1}')).toThrow('Ce fichier n’est pas une sauvegarde Life OS.');
  });

  it('refuse une sauvegarde d’une version future', () => {
    const file = JSON.stringify({ format: 'life-os-backup', schemaVersion: 99, data: {} });
    expect(() => parseBackup(file)).toThrow(/version plus récente/);
  });

  it('refuse un élément invalide en indiquant lequel', async () => {
    await createTask({ title: 'ok' });
    const b = await exportBackup();
    (b.data.tasks[0] as unknown as Record<string, unknown>).status = 'bizarre';
    expect(() => parseBackup(JSON.stringify(b))).toThrow(/Tâches, élément n°1 invalide/);
  });

  it('refuse les identifiants en double', async () => {
    const t = await createTask({ title: 'ok' });
    const b = await exportBackup();
    b.data.tasks.push({ ...t });
    expect(() => parseBackup(JSON.stringify(b))).toThrow(/identifiant en double/);
  });

  it('répare les liens cassés en les signalant', async () => {
    const p = await createProject({ title: 'P' });
    await createTask({ title: 'T', projectId: p.id });
    const b = await exportBackup();
    b.data.projects = [];
    const parsed = parseBackup(JSON.stringify(b));
    expect(parsed.backup.data.tasks[0]?.projectId).toBeNull();
    expect(parsed.warnings[0]).toMatch(/1 tâche/);
  });

  it('un import invalide ne modifie pas les données actuelles', async () => {
    await createTask({ title: 'Précieux' });
    const bad = await exportBackup();
    // Deux réalisations identiques forcées → violation de l'index unique pendant l'écriture.
    bad.data.habitLogs = [
      { id: 'x', habitId: 'h', date: '2026-10-17', createdAt: new Date().toISOString() },
      { id: 'y', habitId: 'h', date: '2026-10-17', createdAt: new Date().toISOString() },
    ];
    await expect(restoreBackup(bad)).rejects.toThrow();
    expect((await db.tasks.toArray()).map((t) => t.title)).toEqual(['Précieux']);
  });
});

describe('persistance après rechargement', () => {
  it('les données survivent à la fermeture et réouverture de la base', async () => {
    const t = await createTask({ title: 'Persistante' });
    db.close();
    // Simule un rechargement du navigateur : nouvelle connexion à la même base.
    const reopened = new LifeOsDatabase();
    await reopened.open();
    expect((await reopened.tasks.get(t.id))?.title).toBe('Persistante');
    reopened.close();
    await db.open();
  });
});
