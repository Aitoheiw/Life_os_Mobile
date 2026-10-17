import type { FocusSession, ID } from '../models';
import { db } from './database';
import { toLocalDate } from '../domain/dates';
import type { FinishedPhase } from '../domain/pomodoro';
import { focusSessionSchema, validate } from '../validation/schemas';

/**
 * Enregistre une session de focus terminée.
 * L'identifiant est dérivé de l'instant de début : si deux onglets (ou un double
 * rendu React) signalent la même fin de session, `put` écrase au lieu de dupliquer.
 */
export async function recordFocusSession(finished: FinishedPhase, taskId: ID | null): Promise<FocusSession | null> {
  if (finished.phase !== 'focus') return null;
  const end = new Date(finished.endedAt);
  const session = validate(focusSessionSchema, {
    id: `focus-${finished.startedAt}`,
    taskId,
    date: toLocalDate(end),
    startedAt: new Date(finished.startedAt).toISOString(),
    endedAt: end.toISOString(),
    minutes: finished.minutes,
  });
  // La tâche a pu être supprimée pendant la session : on garde la session sans lien.
  if (taskId && !(await db.tasks.get(taskId))) session.taskId = null;
  await db.focusSessions.put(session);
  return session;
}

export async function deleteFocusSession(id: ID): Promise<void> {
  await db.focusSessions.delete(id);
}
