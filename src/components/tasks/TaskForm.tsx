import { useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import type { ID, Priority, Recurrence, Task, TaskStatus } from '../../models';
import { createTask, deleteTask, updateTask } from '../../db/tasks';
import { useProjects } from '../../hooks/useData';
import { useFeedback, errorMessage } from '../../app/feedback';
import { Button, ConfirmDialog, ErrorMessage, Field, Input, Select, Textarea } from '../ui';
import { WeekdayPicker } from '../WeekdayPicker';
import { PRIORITY_LABELS, STATUS_LABELS } from './labels';
import { weekday as weekdayOf, today } from '../../domain/dates';

export interface TaskDefaults {
  projectId?: ID | null;
  dueDate?: string | null;
  title?: string;
}

type RecurrenceKind = 'none' | Recurrence['type'];

/** Formulaire de création / modification d'une tâche. */
export function TaskForm({ task, defaults, onDone }: { task?: Task; defaults?: TaskDefaults; onDone: () => void }) {
  const projects = useProjects();
  const { notify } = useFeedback();
  const [title, setTitle] = useState(task?.title ?? defaults?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'todo');
  const [dueDate, setDueDate] = useState(task?.dueDate ?? defaults?.dueDate ?? '');
  const [projectId, setProjectId] = useState(task?.projectId ?? defaults?.projectId ?? '');
  const [recKind, setRecKind] = useState<RecurrenceKind>(task?.recurrence?.type ?? 'none');
  const [interval, setRecInterval] = useState(task?.recurrence?.type === 'daily' ? task.recurrence.interval : 1);
  const [days, setDays] = useState<number[]>(task?.recurrence?.type === 'weekly' ? task.recurrence.days : [weekdayOf(dueDate || today())]);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const buildRecurrence = (): Recurrence | null => {
    const start = dueDate || today();
    switch (recKind) {
      case 'none':
        return null;
      case 'daily':
        return { type: 'daily', interval };
      case 'weekly':
        return { type: 'weekly', days };
      case 'monthly':
        return { type: 'monthly', dayOfMonth: Number(start.slice(8, 10)) };
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const values = {
      title,
      description,
      priority,
      status,
      dueDate: dueDate || null,
      projectId: projectId || null,
      recurrence: buildRecurrence(),
    };
    try {
      if (task) await updateTask(task.id, values);
      else await createTask(values);
      notify(task ? 'Tâche modifiée' : 'Tâche créée');
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async () => {
    if (!task) return;
    try {
      await deleteTask(task.id);
      notify('Tâche supprimée');
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const activeProjects = (projects ?? []).filter((p) => p.status !== 'done' || p.id === projectId);

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Titre">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Que faut-il faire ?" autoFocus required />}</Field>

      <Field label="Description">{(id) => <Textarea id={id} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Détails, liens, contexte… (facultatif)" rows={3} />}</Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Échéance">{(id) => <Input id={id} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />}</Field>
        <Field label="Projet">
          {(id) => (
            <Select id={id} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Aucun projet</option>
              {activeProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Priorité">
          {(id) => (
            <Select id={id} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Statut">
          {(id) => (
            <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <Field label="Répétition" hint={recKind !== 'none' ? 'Quand tu termines la tâche, la suivante est créée automatiquement (une seule à la fois).' : undefined}>
        {(id) => (
          <div className="space-y-2">
            <Select id={id} value={recKind} onChange={(e) => setRecKind(e.target.value as RecurrenceKind)}>
              <option value="none">Ne se répète pas</option>
              <option value="daily">Tous les X jours</option>
              <option value="weekly">Certains jours de la semaine</option>
              <option value="monthly">Chaque mois (même jour que l’échéance)</option>
            </Select>
            {recKind === 'daily' && (
              <div className="flex items-center gap-2 text-sm text-muted">
                Tous les
                <Input type="number" min={1} max={365} value={interval} onChange={(e) => setRecInterval(Math.max(1, Number(e.target.value) || 1))} className="w-20" aria-label="Intervalle en jours" />
                jour(s)
              </div>
            )}
            {recKind === 'weekly' && <WeekdayPicker value={days} onChange={setDays} />}
          </div>
        )}
      </Field>

      <ErrorMessage>{error}</ErrorMessage>

      <div className="flex items-center justify-between gap-2 pt-1">
        {task ? (
          <Button variant="ghost" icon={<Trash2 size={15} />} onClick={() => setConfirmDelete(true)}>
            Supprimer
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button onClick={onDone}>Annuler</Button>
          <Button type="submit" variant="primary">
            {task ? 'Enregistrer' : 'Créer la tâche'}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer la tâche ?"
        message={
          <>
            « {task?.title} » sera supprimée définitivement.
            {task?.status !== 'done' && ' Pour garder une trace, tu peux plutôt la marquer comme terminée.'}
          </>
        }
        onCancel={() => setConfirmDelete(false)}
        onConfirm={remove}
      />
    </form>
  );
}
