import type { ID, Recurrence, Priority, Task, TaskStatus } from '../models';
import { db } from './database';
import { newId } from './ids';
import { nowIso, today, type LocalDate } from '../domain/dates';
import { nextOccurrence } from '../domain/recurrence';
import { MAX_DAILY_PRIORITIES } from '../domain/tasks';
import { taskSchema, validate, ValidationError } from '../validation/schemas';

export interface TaskInput {
  title: string;
  description?: string;
  priority?: Priority;
  status?: TaskStatus;
  dueDate?: LocalDate | null;
  projectId?: ID | null;
  recurrence?: Recurrence | null;
}

export async function createTask(input: TaskInput, now = new Date()): Promise<Task> {
  const ts = nowIso(now);
  const recurrence = input.recurrence ?? null;
  const status = input.status ?? 'todo';
  const task = validate(taskSchema, {
    id: newId(),
    title: input.title,
    description: input.description ?? '',
    priority: input.priority ?? 'medium',
    status,
    // Une tâche récurrente a besoin d'une échéance de départ.
    dueDate: input.dueDate ?? (recurrence ? today(now) : null),
    projectId: input.projectId ?? null,
    focusDate: null,
    recurrence,
    seriesId: recurrence ? newId() : null,
    postponedCount: 0,
    completedAt: status === 'done' ? ts : null,
    createdAt: ts,
    updatedAt: ts,
  });
  await db.tasks.add(task);
  return task;
}

export type TaskPatch = Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'completedAt' | 'seriesId'>>;

/**
 * Modifie une tâche. Gère automatiquement :
 * - le compteur de report (échéance repoussée à plus tard) ;
 * - la date de fin (passage à / sortie du statut "terminé") ;
 * - la création de l'occurrence suivante si une tâche récurrente est terminée.
 */
export async function updateTask(id: ID, patch: TaskPatch, now = new Date()): Promise<Task> {
  return db.transaction('rw', db.tasks, async () => {
    const current = await db.tasks.get(id);
    if (!current) throw new ValidationError('Cette tâche n’existe plus.');

    const next: Task = { ...current, ...patch, updatedAt: nowIso(now) };

    if (current.dueDate && next.dueDate && next.dueDate > current.dueDate && current.status !== 'done') {
      next.postponedCount = current.postponedCount + 1;
    }
    if (next.recurrence && !next.seriesId) next.seriesId = newId();
    if (next.recurrence && !next.dueDate) next.dueDate = today(now);

    const becameDone = current.status !== 'done' && next.status === 'done';
    if (becameDone) next.completedAt = nowIso(now);
    if (next.status !== 'done') next.completedAt = null;

    const valid = validate(taskSchema, next);
    await db.tasks.put(valid);
    if (becameDone) await spawnNextOccurrence(valid, now);
    return valid;
  });
}

/**
 * Crée l'occurrence suivante d'une tâche récurrente terminée.
 * Anti-doublon : on ne crée rien si une occurrence de la même série existe
 * déjà à cette date, ou si une occurrence de la série est encore ouverte.
 */
async function spawnNextOccurrence(done: Task, now: Date): Promise<void> {
  if (!done.recurrence || !done.seriesId || !done.dueDate) return;
  const series = await db.tasks.where('seriesId').equals(done.seriesId).toArray();
  if (series.some((t) => t.id !== done.id && t.status !== 'done')) return;

  const dueDate = nextOccurrence(done.recurrence, done.dueDate, today(now));
  if (series.some((t) => t.dueDate === dueDate)) return;

  const ts = nowIso(now);
  await db.tasks.add({
    ...done,
    id: newId(),
    status: 'todo',
    dueDate,
    focusDate: null,
    postponedCount: 0,
    completedAt: null,
    createdAt: ts,
    updatedAt: ts,
  });
}

export function completeTask(id: ID, now = new Date()) {
  return updateTask(id, { status: 'done' }, now);
}

export function reopenTask(id: ID, now = new Date()) {
  return updateTask(id, { status: 'todo' }, now);
}

/**
 * Marque (ou retire) une tâche comme priorité du jour. 3 maximum par jour.
 */
export async function setFocus(id: ID, day: LocalDate | null, now = new Date()): Promise<void> {
  await db.transaction('rw', db.tasks, async () => {
    if (day !== null) {
      const count = await db.tasks
        .where('focusDate')
        .equals(day)
        .filter((t) => t.id !== id)
        .count();
      if (count >= MAX_DAILY_PRIORITIES) {
        throw new ValidationError(`Tu as déjà ${MAX_DAILY_PRIORITIES} priorités pour ce jour. Retires-en une d’abord.`);
      }
    }
    const updated = await db.tasks.update(id, { focusDate: day, updatedAt: nowIso(now) });
    if (!updated) throw new ValidationError('Cette tâche n’existe plus.');
  });
}

/** Supprime une tâche et nettoie les références vers elle (projet, note, sessions de focus). */
export async function deleteTask(id: ID): Promise<void> {
  await db.transaction('rw', [db.tasks, db.projects, db.notes, db.focusSessions], async () => {
    await db.focusSessions.where('taskId').equals(id).modify({ taskId: null });
    await db.projects.filter((p) => p.nextActionTaskId === id).modify({ nextActionTaskId: null });
    await db.notes.filter((n) => n.taskId === id).modify({ taskId: null });
    await db.tasks.delete(id);
  });
}

/** Arrête la récurrence de toute une série (l'historique est conservé). */
export async function stopRecurrence(seriesId: ID, now = new Date()): Promise<void> {
  await db.tasks
    .where('seriesId')
    .equals(seriesId)
    .filter((t) => t.status !== 'done')
    .modify({ recurrence: null, updatedAt: nowIso(now) });
}
