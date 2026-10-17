import type { WeeklyReview } from '../models';
import { db } from './database';
import { newId } from './ids';
import { nowIso, startOfWeek, type LocalDate } from '../domain/dates';
import { validate, weeklyReviewSchema } from '../validation/schemas';

export interface ReviewInput {
  wins: string;
  difficulties: string;
  nextPriorities: [string, string, string];
}

/** Enregistre le bilan d'une semaine (un seul bilan par semaine : création ou mise à jour). */
export async function saveWeeklyReview(day: LocalDate, input: ReviewInput, now = new Date()): Promise<WeeklyReview> {
  const weekStart = startOfWeek(day);
  return db.transaction('rw', db.weeklyReviews, async () => {
    const existing = await db.weeklyReviews.where('weekStart').equals(weekStart).first();
    const ts = nowIso(now);
    const review = validate(weeklyReviewSchema, {
      id: existing?.id ?? newId(),
      weekStart,
      wins: input.wins,
      difficulties: input.difficulties,
      nextPriorities: input.nextPriorities.map((p) => p.trim()),
      createdAt: existing?.createdAt ?? ts,
      updatedAt: ts,
    });
    await db.weeklyReviews.put(review);
    return review;
  });
}

export async function deleteWeeklyReview(id: string): Promise<void> {
  await db.weeklyReviews.delete(id);
}
