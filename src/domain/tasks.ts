import type { Priority, Task } from '../models';
import type { LocalDate } from './dates';

/** Une tâche est en retard si elle n'est pas terminée et que son échéance est strictement passée. */
export function isOverdue(task: Pick<Task, 'status' | 'dueDate'>, ref: LocalDate): boolean {
  return task.status !== 'done' && task.dueDate !== null && task.dueDate < ref;
}

export function isDueOn(task: Pick<Task, 'status' | 'dueDate'>, day: LocalDate): boolean {
  return task.status !== 'done' && task.dueDate === day;
}

/** À venir : échéance future (strictement après `ref`). */
export function isUpcoming(task: Pick<Task, 'status' | 'dueDate'>, ref: LocalDate): boolean {
  return task.status !== 'done' && task.dueDate !== null && task.dueDate > ref;
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/**
 * Tri "quoi faire en premier" : priorité, puis échéance la plus proche
 * (les tâches sans échéance passent après), puis date de création.
 */
export function compareTasks(a: Task, b: Task): number {
  const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (p !== 0) return p;
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  return a.createdAt.localeCompare(b.createdAt);
}

export const MAX_DAILY_PRIORITIES = 3;

export interface TaskFilter {
  search?: string;
  status?: Task['status'] | 'open' | 'all';
  priority?: Priority | 'all';
  projectId?: string | 'all' | 'none';
}

/** Filtrage en mémoire (les volumes d'une app personnelle restent faibles). */
export function filterTasks(tasks: Task[], f: TaskFilter): Task[] {
  const q = f.search?.trim().toLowerCase() ?? '';
  return tasks.filter((t) => {
    if (q && !t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
    if (f.status === 'open' && t.status === 'done') return false;
    if (f.status && f.status !== 'all' && f.status !== 'open' && t.status !== f.status) return false;
    if (f.priority && f.priority !== 'all' && t.priority !== f.priority) return false;
    if (f.projectId === 'none' && t.projectId !== null) return false;
    if (f.projectId && f.projectId !== 'all' && f.projectId !== 'none' && t.projectId !== f.projectId) return false;
    return true;
  });
}
