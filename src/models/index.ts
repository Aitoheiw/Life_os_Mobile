import type { LocalDate } from '../domain/dates';

/**
 * Modèles de données stockés dans IndexedDB.
 *
 * Conventions :
 * - `id` : UUID généré côté client → les relations restent valides après export/import.
 * - Jours calendaires (`dueDate`, `date`…) : `LocalDate` (`YYYY-MM-DD`, heure locale).
 * - Instants (`createdAt`, `updatedAt`, `completedAt`) : chaîne ISO 8601.
 * - Les relations facultatives valent `null` (jamais `undefined`) pour rester indexables et exportables.
 */

export type ID = string;
export type Priority = 'low' | 'medium' | 'high';

interface Timestamps {
  createdAt: string;
  updatedAt: string;
}

// ---------- Tâches ----------

export type TaskStatus = 'todo' | 'in_progress' | 'done';

/**
 * Récurrence simple. Une tâche récurrente n'existe qu'en UNE occurrence ouverte :
 * quand on la termine, l'occurrence suivante est créée (une seule fois, voir domain/recurrence).
 */
export type Recurrence =
  | { type: 'daily'; interval: number }
  | { type: 'weekly'; days: number[] } // 0 = dimanche … 6 = samedi
  | { type: 'monthly'; dayOfMonth: number };

export interface Task extends Timestamps {
  id: ID;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  dueDate: LocalDate | null;
  projectId: ID | null;
  /** Jour pour lequel la tâche est l'une des 3 priorités (null = pas prioritaire). */
  focusDate: LocalDate | null;
  recurrence: Recurrence | null;
  /** Identifiant commun à toutes les occurrences d'une même tâche récurrente. */
  seriesId: ID | null;
  /** Nombre de fois où l'échéance a été repoussée (utilisé par le bilan). */
  postponedCount: number;
  completedAt: string | null;
}

// ---------- Projets & objectifs ----------

export type ProjectStatus = 'todo' | 'in_progress' | 'paused' | 'done';

export interface Project extends Timestamps {
  id: ID;
  title: string;
  description: string;
  status: ProjectStatus;
  priority: Priority;
  targetDate: LocalDate | null;
  goalId: ID | null;
  /** Prochaine action choisie explicitement. Si absente ou terminée, on la déduit (voir domain/projects). */
  nextActionTaskId: ID | null;
  completedAt: string | null;
}

export type GoalStatus = 'active' | 'achieved' | 'archived';

/**
 * Indicateur de progression d'un objectif :
 * - `projects` : projets associés terminés / projets associés (tous statuts confondus).
 * - `metric`   : valeur mesurable (ex. 7 / 12 livres lus).
 */
export type GoalProgress =
  | { type: 'projects' }
  | { type: 'metric'; current: number; target: number; unit: string };

export interface Goal extends Timestamps {
  id: ID;
  title: string;
  description: string;
  targetDate: LocalDate | null;
  status: GoalStatus;
  progress: GoalProgress;
}

// ---------- Habitudes ----------

export type HabitFrequency = { type: 'daily' } | { type: 'weekly'; days: number[] };
export type HabitStatus = 'active' | 'paused' | 'archived';

/** Période de suspension. `to` = null si la suspension est en cours. Bornes incluses. */
export interface PausePeriod {
  from: LocalDate;
  to: LocalDate | null;
}

export interface Habit extends Timestamps {
  id: ID;
  name: string;
  description: string;
  frequency: HabitFrequency;
  status: HabitStatus;
  /** Premier jour où l'habitude compte dans les statistiques. */
  startDate: LocalDate;
  pauses: PausePeriod[];
  archivedAt: string | null;
}

/** Une réalisation = une ligne. Unicité garantie par l'index `[habitId+date]`. */
export interface HabitLog {
  id: ID;
  habitId: ID;
  date: LocalDate;
  createdAt: string;
}

// ---------- Notes & boîte de réception ----------

/** `idea` = capture rapide non classée (boîte de réception) ; `note` = note rédigée. */
export type NoteKind = 'idea' | 'note';
/** `open` = à traiter / active ; `processed` = idée traitée ; `archived` = archivée. */
export type NoteStatus = 'open' | 'processed' | 'archived';

export interface Note extends Timestamps {
  id: ID;
  kind: NoteKind;
  title: string;
  /** Texte avec formatage simple façon Markdown (titres, listes, gras, italique). */
  content: string;
  status: NoteStatus;
  projectId: ID | null;
  goalId: ID | null;
  /** Tâche créée à partir de cette idée, le cas échéant. */
  taskId: ID | null;
}

// ---------- Bilan hebdomadaire ----------

export interface WeeklyReview extends Timestamps {
  id: ID;
  /** Lundi de la semaine évaluée. Unique. */
  weekStart: LocalDate;
  wins: string;
  difficulties: string;
  /** Trois priorités pour la semaine suivante. */
  nextPriorities: [string, string, string];
}

// ---------- Sessions de focus (Pomodoro) ----------

/** Session de focus terminée. Les sessions abandonnées ne sont pas enregistrées. */
export interface FocusSession {
  /** Dérivé de l'instant de début : enregistrer deux fois la même session est sans effet. */
  id: ID;
  taskId: ID | null;
  /** Jour local de fin de session. */
  date: LocalDate;
  startedAt: string;
  endedAt: string;
  minutes: number;
}
