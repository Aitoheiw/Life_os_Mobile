import type { Project, Task } from '../models';
import { addDays, startOfWeek, toLocalDate, type LocalDate } from './dates';

export interface WeekSummary {
  weekStart: LocalDate;
  weekEnd: LocalDate;
  completed: Task[];
  /** Projets ayant au moins une tâche terminée dans la semaine, ou terminés dans la semaine. */
  progressedProjects: { project: Project; completedCount: number }[];
  /**
   * Tâches reportées : encore ouvertes et
   * - dont l'échéance tombait dans la semaine et est maintenant dépassée, ou
   * - dont l'échéance a été repoussée au moins une fois (modifiées cette semaine).
   */
  postponed: Task[];
}

const inWeek = (day: LocalDate | null, start: LocalDate, end: LocalDate) => day !== null && day >= start && day <= end;

/** Jour local d'un instant ISO (ex. date de fin d'une tâche). */
export const isoToLocalDate = (iso: string) => toLocalDate(new Date(iso));

export function summarizeWeek(anyDayOfWeek: LocalDate, ref: LocalDate, tasks: Task[], projects: Project[]): WeekSummary {
  const weekStart = startOfWeek(anyDayOfWeek);
  const weekEnd = addDays(weekStart, 6);

  const completed = tasks
    .filter((t) => t.status === 'done' && t.completedAt && inWeek(isoToLocalDate(t.completedAt), weekStart, weekEnd))
    .sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? ''));

  const progressedProjects = projects
    .map((project) => ({ project, completedCount: completed.filter((t) => t.projectId === project.id).length }))
    .filter(
      ({ project, completedCount }) =>
        completedCount > 0 || (project.completedAt !== null && inWeek(isoToLocalDate(project.completedAt), weekStart, weekEnd)),
    );

  const lastPastDay = addDays(ref, -1) < weekEnd ? addDays(ref, -1) : weekEnd;
  const postponed = tasks.filter(
    (t) =>
      t.status !== 'done' &&
      (inWeek(t.dueDate, weekStart, lastPastDay) ||
        (t.postponedCount > 0 && inWeek(isoToLocalDate(t.updatedAt), weekStart, weekEnd))),
  );

  return { weekStart, weekEnd, completed, progressedProjects, postponed };
}
