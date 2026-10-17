import type { ID, Note, Task } from '../models';
import { db } from './database';
import { newId } from './ids';
import { createTask } from './tasks';
import { nowIso } from '../domain/dates';
import { noteSchema, validate, ValidationError } from '../validation/schemas';

/**
 * Capture rapide d'une idée dans la boîte de réception.
 * Une seule information requise : le texte. La première ligne sert de titre.
 */
export async function captureIdea(text: string, now = new Date()): Promise<Note> {
  const trimmed = text.trim();
  if (!trimmed) throw new ValidationError('L’idée est vide.');
  const [firstLine = '', ...rest] = trimmed.split('\n');
  const ts = nowIso(now);
  const note = validate(noteSchema, {
    id: newId(),
    kind: 'idea',
    title: firstLine.slice(0, 300),
    content: rest.join('\n').trim(),
    status: 'open',
    projectId: null,
    goalId: null,
    taskId: null,
    createdAt: ts,
    updatedAt: ts,
  });
  await db.notes.add(note);
  return note;
}

export interface NoteInput {
  title: string;
  content?: string;
  projectId?: ID | null;
  goalId?: ID | null;
}

export async function createNote(input: NoteInput, now = new Date()): Promise<Note> {
  if (!input.title.trim() && !input.content?.trim()) throw new ValidationError('La note est vide.');
  const ts = nowIso(now);
  const note = validate(noteSchema, {
    id: newId(),
    kind: 'note',
    title: input.title,
    content: input.content ?? '',
    status: 'open',
    projectId: input.projectId ?? null,
    goalId: input.goalId ?? null,
    taskId: null,
    createdAt: ts,
    updatedAt: ts,
  });
  await db.notes.add(note);
  return note;
}

export type NotePatch = Partial<Omit<Note, 'id' | 'createdAt' | 'updatedAt'>>;

export async function updateNote(id: ID, patch: NotePatch, now = new Date()): Promise<Note> {
  return db.transaction('rw', db.notes, async () => {
    const current = await db.notes.get(id);
    if (!current) throw new ValidationError('Cette note n’existe plus.');
    const valid = validate(noteSchema, { ...current, ...patch, updatedAt: nowIso(now) });
    await db.notes.put(valid);
    return valid;
  });
}

export const archiveNote = (id: ID, now = new Date()) => updateNote(id, { status: 'archived' }, now);
export const markProcessed = (id: ID, now = new Date()) => updateNote(id, { status: 'processed' }, now);
export const reopenNote = (id: ID, now = new Date()) => updateNote(id, { status: 'open' }, now);

/** Transforme une idée en tâche. L'idée est marquée traitée et garde le lien vers la tâche. */
export async function convertIdeaToTask(id: ID, now = new Date()): Promise<Task> {
  return db.transaction('rw', db.notes, db.tasks, async () => {
    const note = await db.notes.get(id);
    if (!note) throw new ValidationError('Cette idée n’existe plus.');
    if (note.taskId && (await db.tasks.get(note.taskId))) {
      throw new ValidationError('Cette idée a déjà été transformée en tâche.');
    }
    const task = await createTask(
      { title: note.title || note.content.slice(0, 120), description: note.content, projectId: note.projectId },
      now,
    );
    await db.notes.update(id, { status: 'processed', taskId: task.id, updatedAt: nowIso(now) });
    return task;
  });
}

export async function deleteNote(id: ID): Promise<void> {
  await db.notes.delete(id);
}
