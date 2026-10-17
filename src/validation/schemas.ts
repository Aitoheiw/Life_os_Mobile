import { z } from 'zod';
import fr from 'zod/v4/locales/fr.js';
import { isLocalDate } from '../domain/dates';

// Messages d'erreur génériques de zod en français.
z.config(fr());

/**
 * Schémas de validation (zod) de toutes les entités.
 * Utilisés à deux endroits : avant chaque écriture en base (repositories)
 * et lors de l'import d'une sauvegarde (backup).
 */

const id = z.string().min(1);
const localDate = z.string().refine(isLocalDate, { message: 'Date invalide (format attendu AAAA-MM-JJ).' });
const isoInstant = z.string().refine((s) => !Number.isNaN(Date.parse(s)), { message: 'Horodatage invalide.' });
const title = z.string().trim().min(1, 'Le titre est obligatoire.').max(300, 'Le titre est trop long (300 caractères max).');
const text = z.string().max(100_000, 'Texte trop long.');
const priority = z.enum(['low', 'medium', 'high']);
const weekdays = z.array(z.number().int().min(0).max(6)).min(1, 'Choisis au moins un jour.');

const timestamps = { createdAt: isoInstant, updatedAt: isoInstant };

export const recurrenceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('daily'), interval: z.number().int().min(1).max(365) }),
  z.object({ type: z.literal('weekly'), days: weekdays }),
  z.object({ type: z.literal('monthly'), dayOfMonth: z.number().int().min(1).max(31) }),
]);

export const taskSchema = z.object({
  id,
  title,
  description: text,
  priority,
  status: z.enum(['todo', 'in_progress', 'done']),
  dueDate: localDate.nullable(),
  projectId: id.nullable(),
  focusDate: localDate.nullable(),
  recurrence: recurrenceSchema.nullable(),
  seriesId: id.nullable(),
  postponedCount: z.number().int().min(0),
  completedAt: isoInstant.nullable(),
  ...timestamps,
});

export const projectSchema = z.object({
  id,
  title,
  description: text,
  status: z.enum(['todo', 'in_progress', 'paused', 'done']),
  priority,
  targetDate: localDate.nullable(),
  goalId: id.nullable(),
  nextActionTaskId: id.nullable(),
  completedAt: isoInstant.nullable(),
  ...timestamps,
});

export const goalSchema = z.object({
  id,
  title,
  description: text,
  targetDate: localDate.nullable(),
  status: z.enum(['active', 'achieved', 'archived']),
  progress: z.discriminatedUnion('type', [
    z.object({ type: z.literal('projects') }),
    z.object({
      type: z.literal('metric'),
      current: z.number().min(0, 'La valeur actuelle ne peut pas être négative.'),
      target: z.number().positive('La cible doit être supérieure à 0.'),
      unit: z.string().max(40),
    }),
  ]),
  ...timestamps,
});

export const habitSchema = z.object({
  id,
  name: title,
  description: text,
  frequency: z.discriminatedUnion('type', [
    z.object({ type: z.literal('daily') }),
    z.object({ type: z.literal('weekly'), days: weekdays }),
  ]),
  status: z.enum(['active', 'paused', 'archived']),
  startDate: localDate,
  pauses: z.array(z.object({ from: localDate, to: localDate.nullable() })),
  archivedAt: isoInstant.nullable(),
  ...timestamps,
});

export const habitLogSchema = z.object({
  id,
  habitId: id,
  date: localDate,
  createdAt: isoInstant,
});

export const noteSchema = z.object({
  id,
  kind: z.enum(['idea', 'note']),
  // Une idée peut n'avoir qu'un contenu ; le titre est alors dérivé du contenu.
  title: z.string().trim().max(300),
  content: text,
  status: z.enum(['open', 'processed', 'archived']),
  projectId: id.nullable(),
  goalId: id.nullable(),
  taskId: id.nullable(),
  ...timestamps,
});

export const weeklyReviewSchema = z.object({
  id,
  weekStart: localDate,
  wins: text,
  difficulties: text,
  nextPriorities: z.tuple([z.string().max(300), z.string().max(300), z.string().max(300)]),
  ...timestamps,
});

export const focusSessionSchema = z.object({
  id,
  taskId: id.nullable(),
  date: localDate,
  startedAt: isoInstant,
  endedAt: isoInstant,
  minutes: z.number().int().min(1).max(600),
});

/** Erreur de validation avec un message lisible par l'utilisateur. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** Valide `value` ou lève une ValidationError avec le premier message pertinent. */
export function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const field = issue?.path.join('.') ?? '';
  throw new ValidationError(issue ? `${issue.message}${field ? ` (${field})` : ''}` : 'Données invalides.');
}
