import type { Goal, GoalProgress, ID, Priority, Project, ProjectStatus } from '../models';
import { db } from './database';
import { newId } from './ids';
import { nowIso, type LocalDate } from '../domain/dates';
import { goalSchema, projectSchema, validate, ValidationError } from '../validation/schemas';

// ---------- Projets ----------

export interface ProjectInput {
  title: string;
  description?: string;
  status?: ProjectStatus;
  priority?: Priority;
  targetDate?: LocalDate | null;
  goalId?: ID | null;
}

export async function createProject(input: ProjectInput, now = new Date()): Promise<Project> {
  const ts = nowIso(now);
  const status = input.status ?? 'todo';
  const project = validate(projectSchema, {
    id: newId(),
    title: input.title,
    description: input.description ?? '',
    status,
    priority: input.priority ?? 'medium',
    targetDate: input.targetDate ?? null,
    goalId: input.goalId ?? null,
    nextActionTaskId: null,
    completedAt: status === 'done' ? ts : null,
    createdAt: ts,
    updatedAt: ts,
  });
  await db.projects.add(project);
  return project;
}

export type ProjectPatch = Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'completedAt'>>;

export async function updateProject(id: ID, patch: ProjectPatch, now = new Date()): Promise<Project> {
  return db.transaction('rw', db.projects, async () => {
    const current = await db.projects.get(id);
    if (!current) throw new ValidationError('Ce projet n’existe plus.');
    const next: Project = { ...current, ...patch, updatedAt: nowIso(now) };
    if (current.status !== 'done' && next.status === 'done') next.completedAt = nowIso(now);
    if (next.status !== 'done') next.completedAt = null;
    const valid = validate(projectSchema, next);
    await db.projects.put(valid);
    return valid;
  });
}

/**
 * Supprime un projet. Les tâches et notes associées sont CONSERVÉES et
 * simplement détachées (projectId = null) : rien n'est perdu.
 */
export async function deleteProject(id: ID, now = new Date()): Promise<void> {
  const ts = nowIso(now);
  await db.transaction('rw', db.projects, db.tasks, db.notes, async () => {
    await db.tasks.where('projectId').equals(id).modify({ projectId: null, updatedAt: ts });
    await db.notes.where('projectId').equals(id).modify({ projectId: null, updatedAt: ts });
    await db.projects.delete(id);
  });
}

// ---------- Objectifs ----------

export interface GoalInput {
  title: string;
  description?: string;
  targetDate?: LocalDate | null;
  progress?: GoalProgress;
}

export async function createGoal(input: GoalInput, now = new Date()): Promise<Goal> {
  const ts = nowIso(now);
  const goal = validate(goalSchema, {
    id: newId(),
    title: input.title,
    description: input.description ?? '',
    targetDate: input.targetDate ?? null,
    status: 'active',
    progress: input.progress ?? { type: 'projects' },
    createdAt: ts,
    updatedAt: ts,
  });
  await db.goals.add(goal);
  return goal;
}

export type GoalPatch = Partial<Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>>;

export async function updateGoal(id: ID, patch: GoalPatch, now = new Date()): Promise<Goal> {
  return db.transaction('rw', db.goals, async () => {
    const current = await db.goals.get(id);
    if (!current) throw new ValidationError('Cet objectif n’existe plus.');
    const valid = validate(goalSchema, { ...current, ...patch, updatedAt: nowIso(now) });
    await db.goals.put(valid);
    return valid;
  });
}

/** Supprime un objectif ; ses projets et notes sont conservés et détachés. */
export async function deleteGoal(id: ID, now = new Date()): Promise<void> {
  const ts = nowIso(now);
  await db.transaction('rw', db.goals, db.projects, db.notes, async () => {
    await db.projects.where('goalId').equals(id).modify({ goalId: null, updatedAt: ts });
    await db.notes.where('goalId').equals(id).modify({ goalId: null, updatedAt: ts });
    await db.goals.delete(id);
  });
}
