import type { Habit, HabitFrequency, ID } from '../models';
import { db } from './database';
import { newId } from './ids';
import { addDays, nowIso, today, type LocalDate } from '../domain/dates';
import { habitSchema, habitLogSchema, validate, ValidationError } from '../validation/schemas';

export interface HabitInput {
  name: string;
  description?: string;
  frequency?: HabitFrequency;
  startDate?: LocalDate;
}

export async function createHabit(input: HabitInput, now = new Date()): Promise<Habit> {
  const ts = nowIso(now);
  const habit = validate(habitSchema, {
    id: newId(),
    name: input.name,
    description: input.description ?? '',
    frequency: input.frequency ?? { type: 'daily' },
    status: 'active',
    startDate: input.startDate ?? today(now),
    pauses: [],
    archivedAt: null,
    createdAt: ts,
    updatedAt: ts,
  });
  await db.habits.add(habit);
  return habit;
}

export type HabitPatch = Partial<Pick<Habit, 'name' | 'description' | 'frequency' | 'startDate'>>;

async function save(id: ID, change: (h: Habit) => Habit, now: Date): Promise<Habit> {
  return db.transaction('rw', db.habits, async () => {
    const current = await db.habits.get(id);
    if (!current) throw new ValidationError('Cette habitude n’existe plus.');
    const valid = validate(habitSchema, { ...change(current), updatedAt: nowIso(now) });
    await db.habits.put(valid);
    return valid;
  });
}

export function updateHabit(id: ID, patch: HabitPatch, now = new Date()) {
  return save(id, (h) => ({ ...h, ...patch }), now);
}

/** Suspend l'habitude à partir d'aujourd'hui : les jours suspendus ne comptent pas dans la régularité. */
export function pauseHabit(id: ID, now = new Date()) {
  return save(
    id,
    (h) => {
      if (h.status !== 'active') throw new ValidationError('Seule une habitude active peut être suspendue.');
      return { ...h, status: 'paused', pauses: [...h.pauses, { from: today(now), to: null }] };
    },
    now,
  );
}

/** Reprend l'habitude : la suspension se termine hier, aujourd'hui compte à nouveau. */
export function resumeHabit(id: ID, now = new Date()) {
  return save(
    id,
    (h) => {
      if (h.status !== 'paused') throw new ValidationError('Cette habitude n’est pas suspendue.');
      const day = today(now);
      const pauses = h.pauses
        .map((p) => (p.to === null ? { ...p, to: addDays(day, -1) } : p))
        // Suspension commencée et terminée le même jour → elle ne couvre aucun jour.
        .filter((p) => p.to === null || p.to >= p.from);
      return { ...h, status: 'active', pauses };
    },
    now,
  );
}

/** Archive l'habitude : elle disparaît des listes du jour, son historique est conservé. */
export function archiveHabit(id: ID, now = new Date()) {
  return save(
    id,
    (h) => {
      const day = today(now);
      const pauses = h.pauses.map((p) => (p.to === null ? { ...p, to: day } : p));
      return { ...h, status: 'archived', archivedAt: nowIso(now), pauses };
    },
    now,
  );
}

export function unarchiveHabit(id: ID, now = new Date()) {
  return save(id, (h) => ({ ...h, status: 'active', archivedAt: null }), now);
}

/** Suppression définitive d'une habitude ET de son historique. */
export async function deleteHabit(id: ID): Promise<void> {
  await db.transaction('rw', db.habits, db.habitLogs, async () => {
    await db.habitLogs.where('habitId').equals(id).delete();
    await db.habits.delete(id);
  });
}

/**
 * Valide / dévalide une habitude pour un jour donné (par défaut aujourd'hui, en heure locale).
 * Idempotent grâce à l'index unique [habitId+date] : deux clics rapides ne créent jamais deux lignes.
 * Retourne true si l'habitude est validée après l'opération.
 */
export async function toggleHabitLog(habitId: ID, day: LocalDate = today(), now = new Date()): Promise<boolean> {
  return db.transaction('rw', db.habits, db.habitLogs, async () => {
    const habit = await db.habits.get(habitId);
    if (!habit) throw new ValidationError('Cette habitude n’existe plus.');
    if (day > today(now)) throw new ValidationError('Impossible de valider un jour futur.');
    const existing = await db.habitLogs.where('[habitId+date]').equals([habitId, day]).first();
    if (existing) {
      await db.habitLogs.delete(existing.id);
      return false;
    }
    await db.habitLogs.add(validate(habitLogSchema, { id: newId(), habitId, date: day, createdAt: nowIso(now) }));
    return true;
  });
}

