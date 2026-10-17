import type { Goal, Project, Task } from '../models';
import { compareTasks } from './tasks';

/**
 * Progression d'un projet = tâches terminées / tâches associées.
 * Règle explicite : un projet sans tâche n'a pas de progression (null), on
 * n'invente pas de pourcentage. Un projet au statut "terminé" vaut 100 %.
 */
export function projectProgress(project: Project, tasks: Task[]): { done: number; total: number; ratio: number | null } {
  const own = tasks.filter((t) => t.projectId === project.id);
  const done = own.filter((t) => t.status === 'done').length;
  if (project.status === 'done') return { done, total: own.length, ratio: 1 };
  return { done, total: own.length, ratio: own.length === 0 ? null : done / own.length };
}

/**
 * Prochaine action d'un projet : la tâche choisie explicitement si elle est
 * encore ouverte, sinon la tâche ouverte la plus prioritaire.
 */
export function nextAction(project: Project, tasks: Task[]): Task | null {
  const open = tasks.filter((t) => t.projectId === project.id && t.status !== 'done');
  const chosen = open.find((t) => t.id === project.nextActionTaskId);
  if (chosen) return chosen;
  return [...open].sort(compareTasks)[0] ?? null;
}

/**
 * Progression d'un objectif selon son indicateur :
 * - `projects` : projets associés terminés / projets associés (null si aucun projet) ;
 * - `metric`   : valeur actuelle / cible, bornée entre 0 et 1.
 */
export function goalProgress(goal: Goal, projects: Project[]): { label: string; ratio: number | null } {
  if (goal.progress.type === 'metric') {
    const { current, target, unit } = goal.progress;
    const ratio = target > 0 ? Math.min(1, Math.max(0, current / target)) : null;
    return { label: `${current} / ${target}${unit ? ` ${unit}` : ''}`, ratio };
  }
  const linked = projects.filter((p) => p.goalId === goal.id);
  const done = linked.filter((p) => p.status === 'done').length;
  if (linked.length === 0) return { label: 'Aucun projet associé', ratio: null };
  return { label: `${done} / ${linked.length} projets terminés`, ratio: done / linked.length };
}
