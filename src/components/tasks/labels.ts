import type { Priority, ProjectStatus, TaskStatus } from '../../models';

export const PRIORITY_LABELS: Record<Priority, string> = { high: 'Haute', medium: 'Moyenne', low: 'Basse' };
export const STATUS_LABELS: Record<TaskStatus, string> = { todo: 'À faire', in_progress: 'En cours', done: 'Terminée' };
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  paused: 'En pause',
  done: 'Terminé',
};
