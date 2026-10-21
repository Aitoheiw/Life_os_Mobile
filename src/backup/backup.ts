import { z } from 'zod';
import type { FocusSession, Goal, Habit, HabitLog, Note, Project, Task, WeeklyReview } from '../models';
import { ALL_TABLES, db, SCHEMA_VERSION, type TableName } from '../db/database';
import { nowIso } from '../domain/dates';
import {
  focusSessionSchema,
  goalSchema,
  habitLogSchema,
  habitSchema,
  noteSchema,
  projectSchema,
  taskSchema,
  ValidationError,
  weeklyReviewSchema,
} from '../validation/schemas';

/**
 * Format d'un fichier de sauvegarde Life OS.
 * `schemaVersion` permet de refuser un fichier plus récent que l'application
 * et, plus tard, de migrer un fichier plus ancien.
 */
export const BACKUP_FORMAT = 'life-os-backup';

export interface BackupData {
  tasks: Task[];
  projects: Project[];
  goals: Goal[];
  habits: Habit[];
  habitLogs: HabitLog[];
  notes: Note[];
  weeklyReviews: WeeklyReview[];
  focusSessions: FocusSession[];
}

export interface Backup {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  data: BackupData;
}

export type BackupCounts = Record<TableName, number>;

export const TABLE_LABELS: Record<TableName, string> = {
  tasks: 'Tâches',
  projects: 'Projets',
  goals: 'Objectifs',
  habits: 'Habitudes',
  habitLogs: 'Réalisations d’habitudes',
  notes: 'Notes et idées',
  weeklyReviews: 'Bilans hebdomadaires',
  focusSessions: 'Sessions de focus',
};

export const ENTITY_SCHEMAS: { [K in TableName]: z.ZodType<BackupData[K][number]> } = {
  tasks: taskSchema,
  projects: projectSchema,
  goals: goalSchema,
  habits: habitSchema,
  habitLogs: habitLogSchema,
  notes: noteSchema,
  weeklyReviews: weeklyReviewSchema,
  focusSessions: focusSessionSchema,
};

// ---------- Export ----------

/** Lit toute la base dans une transaction (instantané cohérent). */
export async function exportBackup(now = new Date()): Promise<Backup> {
  return db.transaction('r', ALL_TABLES.map((t) => db.table(t)), async () => {
    const [tasks, projects, goals, habits, habitLogs, notes, weeklyReviews, focusSessions] = await Promise.all([
      db.tasks.toArray(),
      db.projects.toArray(),
      db.goals.toArray(),
      db.habits.toArray(),
      db.habitLogs.toArray(),
      db.notes.toArray(),
      db.weeklyReviews.toArray(),
      db.focusSessions.toArray(),
    ]);
    return {
      format: BACKUP_FORMAT,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: nowIso(now),
      data: { tasks, projects, goals, habits, habitLogs, notes, weeklyReviews, focusSessions },
    };
  });
}

export function backupFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `life-os-sauvegarde-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}h${pad(now.getMinutes())}.json`;
}

export function countBackup(data: BackupData): BackupCounts {
  return Object.fromEntries(ALL_TABLES.map((t) => [t, data[t].length])) as BackupCounts;
}

export async function countDatabase(): Promise<BackupCounts> {
  const counts = await Promise.all(ALL_TABLES.map((t) => db.table(t).count()));
  return Object.fromEntries(ALL_TABLES.map((t, i) => [t, counts[i] ?? 0])) as BackupCounts;
}

// ---------- Import : analyse ----------

export interface ParsedBackup {
  backup: Backup;
  counts: BackupCounts;
  /** Problèmes non bloquants corrigés automatiquement (ex. lien vers un projet absent). */
  warnings: string[];
}

/**
 * Analyse et valide le contenu d'un fichier de sauvegarde SANS rien écrire.
 * Lève une ValidationError claire si le fichier est invalide ou incompatible.
 */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ValidationError('Le fichier n’est pas un JSON valide.');
  }
  if (typeof raw !== 'object' || raw === null || (raw as { format?: unknown }).format !== BACKUP_FORMAT) {
    throw new ValidationError('Ce fichier n’est pas une sauvegarde Life OS.');
  }
  const { schemaVersion, exportedAt, data } = raw as Record<string, unknown>;
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) || schemaVersion < 1) {
    throw new ValidationError('Version de sauvegarde absente ou invalide.');
  }
  if (schemaVersion > SCHEMA_VERSION) {
    throw new ValidationError(
      `Cette sauvegarde provient d’une version plus récente de Life OS (format ${schemaVersion}, application : ${SCHEMA_VERSION}). Mets l’application à jour avant de l’importer.`,
    );
  }
  if (typeof data !== 'object' || data === null) throw new ValidationError('La sauvegarde ne contient pas de données.');

  // Migrations de fichiers anciens : une sauvegarde v1 n'a pas de section `focusSessions`,
  // elle est alors considérée comme vide (voir `?? []` ci-dessous).

  const out = {} as BackupData;
  for (const table of ALL_TABLES) {
    const rows = (data as Record<string, unknown>)[table] ?? [];
    if (!Array.isArray(rows)) throw new ValidationError(`Section « ${TABLE_LABELS[table]} » invalide.`);
    const ids = new Set<string>();
    const valid = rows.map((row, i) => {
      const result = ENTITY_SCHEMAS[table].safeParse(row);
      if (!result.success) {
        const issue = result.error.issues[0];
        throw new ValidationError(
          `${TABLE_LABELS[table]}, élément n°${i + 1} invalide : ${issue?.message ?? 'données incorrectes'}${issue?.path.length ? ` (champ ${issue.path.join('.')})` : ''}.`,
        );
      }
      if (ids.has(result.data.id)) throw new ValidationError(`${TABLE_LABELS[table]} : identifiant en double (${result.data.id}).`);
      ids.add(result.data.id);
      return result.data;
    });
    (out as unknown as Record<TableName, unknown[]>)[table] = valid;
  }

  const warnings = repairRelations(out);
  return {
    backup: { format: BACKUP_FORMAT, schemaVersion: SCHEMA_VERSION, exportedAt: String(exportedAt ?? ''), data: out },
    counts: countBackup(out),
    warnings,
  };
}

/**
 * Vérifie les relations entre entités. Un lien vers un élément absent est
 * retiré (mis à null) plutôt que de bloquer tout l'import ; chaque correction
 * est signalée. Modifie `data` en place.
 */
export function repairRelations(data: BackupData): string[] {
  const warnings: string[] = [];
  const projectIds = new Set(data.projects.map((p) => p.id));
  const goalIds = new Set(data.goals.map((g) => g.id));
  const taskIds = new Set(data.tasks.map((t) => t.id));
  const habitIds = new Set(data.habits.map((h) => h.id));

  let n = 0;
  for (const t of data.tasks) {
    if (t.projectId && !projectIds.has(t.projectId)) {
      t.projectId = null;
      n++;
    }
  }
  if (n) warnings.push(`${n} tâche(s) liée(s) à un projet absent ont été détachées.`);

  n = 0;
  for (const p of data.projects) {
    if (p.goalId && !goalIds.has(p.goalId)) {
      p.goalId = null;
      n++;
    }
    if (p.nextActionTaskId && !taskIds.has(p.nextActionTaskId)) p.nextActionTaskId = null;
  }
  if (n) warnings.push(`${n} projet(s) lié(s) à un objectif absent ont été détachés.`);

  n = 0;
  for (const note of data.notes) {
    if (note.projectId && !projectIds.has(note.projectId)) {
      note.projectId = null;
      n++;
    }
    if (note.goalId && !goalIds.has(note.goalId)) {
      note.goalId = null;
      n++;
    }
    if (note.taskId && !taskIds.has(note.taskId)) note.taskId = null;
  }
  if (n) warnings.push(`${n} lien(s) de note vers un projet ou objectif absent ont été retirés.`);

  for (const f of data.focusSessions) if (f.taskId && !taskIds.has(f.taskId)) f.taskId = null;

  const seen = new Set<string>();
  const before = data.habitLogs.length;
  data.habitLogs = data.habitLogs.filter((l) => {
    const key = `${l.habitId}|${l.date}`;
    if (!habitIds.has(l.habitId) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (data.habitLogs.length < before) {
    warnings.push(`${before - data.habitLogs.length} réalisation(s) d’habitude orpheline(s) ou en double ignorée(s).`);
  }

  const weeks = new Set<string>();
  const reviewsBefore = data.weeklyReviews.length;
  data.weeklyReviews = data.weeklyReviews.filter((r) => !weeks.has(r.weekStart) && weeks.add(r.weekStart));
  if (data.weeklyReviews.length < reviewsBefore) warnings.push('Des bilans en double pour une même semaine ont été ignorés.');

  return warnings;
}

// ---------- Import : écriture ----------

/**
 * Remplace TOUTES les données par celles de la sauvegarde.
 * Opération atomique : en cas d'erreur, la transaction est annulée et
 * les données actuelles restent intactes.
 * L'interface doit obtenir une confirmation explicite avant d'appeler cette fonction.
 */
export async function restoreBackup(backup: Backup): Promise<void> {
  await db.transaction('rw', ALL_TABLES.map((t) => db.table(t)), async () => {
    for (const table of ALL_TABLES) {
      await db.table(table).clear();
      await db.table(table).bulkAdd(backup.data[table]);
    }
  });
}
