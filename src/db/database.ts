import Dexie, { type EntityTable } from 'dexie';
import { SYNC_QUEUE, syncQueueMiddleware, type SyncQueueEntry } from './syncQueue';
import type { FocusSession, Goal, Habit, HabitLog, Note, Project, Task, WeeklyReview } from '../models';

export const ALL_TABLES = [
  'tasks',
  'projects',
  'goals',
  'habits',
  'habitLogs',
  'notes',
  'weeklyReviews',
  'focusSessions',
] as const;
export type TableName = (typeof ALL_TABLES)[number];

/**
 * Base IndexedDB de l'application.
 *
 * Schéma versionné : pour toute évolution, NE PAS modifier une version existante.
 * Ajouter `this.version(N + 1).stores({...}).upgrade(tx => ...)` en dessous.
 * Seuls les champs listés ici sont indexés (utilisables dans `where`) ;
 * les autres champs sont stockés normalement.
 */
export class LifeOsDatabase extends Dexie {
  tasks!: EntityTable<Task, 'id'>;
  projects!: EntityTable<Project, 'id'>;
  goals!: EntityTable<Goal, 'id'>;
  habits!: EntityTable<Habit, 'id'>;
  habitLogs!: EntityTable<HabitLog, 'id'>;
  notes!: EntityTable<Note, 'id'>;
  weeklyReviews!: EntityTable<WeeklyReview, 'id'>;
  focusSessions!: EntityTable<FocusSession, 'id'>;
  /** Modifications locales pas encore envoyées à Supabase (voir syncQueue.ts). */
  syncQueue!: EntityTable<SyncQueueEntry, 'key'>;

  constructor(name = 'life-os') {
    super(name);
    this.version(1).stores({
      tasks: 'id, status, dueDate, projectId, focusDate, seriesId, completedAt, [seriesId+dueDate]',
      projects: 'id, status, goalId',
      goals: 'id, status',
      habits: 'id, status',
      // `&` = index unique : impossible d'avoir deux validations le même jour pour une habitude.
      habitLogs: 'id, habitId, date, &[habitId+date]',
      notes: 'id, kind, status, projectId, goalId, updatedAt',
      weeklyReviews: 'id, &weekStart',
    });
    // v2 : ajout des sessions Pomodoro (les tables existantes sont inchangées).
    this.version(2).stores({
      focusSessions: 'id, date, taskId',
    });
    // v3 : file d'attente de synchronisation Supabase (données inchangées).
    this.version(3).stores({
      [SYNC_QUEUE]: 'key',
    });
    // Chaque écriture dans une table de données est notée dans la file d'attente.
    this.use(syncQueueMiddleware(ALL_TABLES));
  }
}

/** Version actuelle du schéma, reprise dans les fichiers de sauvegarde. */
export const SCHEMA_VERSION = 3;

export const db = new LifeOsDatabase();
