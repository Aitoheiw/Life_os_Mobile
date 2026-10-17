import { useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import type { Priority, Project, ProjectStatus } from '../../models';
import { createProject, deleteProject, updateProject } from '../../db/projects';
import { useGoals } from '../../hooks/useData';
import { errorMessage, useFeedback } from '../../app/feedback';
import { Button, ConfirmDialog, ErrorMessage, Field, Input, Select, Textarea } from '../ui';
import { PRIORITY_LABELS, PROJECT_STATUS_LABELS } from '../tasks/labels';

export function ProjectForm({ project, defaultGoalId, onDone, onDeleted }: { project?: Project; defaultGoalId?: string; onDone: (p?: Project) => void; onDeleted?: () => void }) {
  const goals = useGoals();
  const { notify } = useFeedback();
  const [title, setTitle] = useState(project?.title ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? 'in_progress');
  const [priority, setPriority] = useState<Priority>(project?.priority ?? 'medium');
  const [targetDate, setTargetDate] = useState(project?.targetDate ?? '');
  const [goalId, setGoalId] = useState(project?.goalId ?? defaultGoalId ?? '');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const values = { title, description, status, priority, targetDate: targetDate || null, goalId: goalId || null };
    try {
      const saved = project ? await updateProject(project.id, values) : await createProject(values);
      notify(project ? 'Projet modifié' : 'Projet créé');
      onDone(saved);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async () => {
    if (!project) return;
    try {
      await deleteProject(project.id);
      notify('Projet supprimé — ses tâches ont été conservées');
      onDeleted?.();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Titre">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Refaire mon CV" autoFocus required />}</Field>
      <Field label="Description" hint="Quel résultat concret marque la fin du projet ?">
        {(id) => <Textarea id={id} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />}
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Statut">
          {(id) => (
            <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
              {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABELS[s]}
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
        <Field label="Date cible (facultative)">{(id) => <Input id={id} type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />}</Field>
        <Field label="Objectif associé">
          {(id) => (
            <Select id={id} value={goalId} onChange={(e) => setGoalId(e.target.value)}>
              <option value="">Aucun objectif</option>
              {(goals ?? [])
                .filter((g) => g.status === 'active' || g.id === goalId)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
            </Select>
          )}
        </Field>
      </div>
      <ErrorMessage>{error}</ErrorMessage>
      <div className="flex items-center justify-between gap-2 pt-1">
        {project ? (
          <Button variant="ghost" icon={<Trash2 size={15} />} onClick={() => setConfirmDelete(true)}>
            Supprimer
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button onClick={() => onDone()}>Annuler</Button>
          <Button type="submit" variant="primary">
            {project ? 'Enregistrer' : 'Créer le projet'}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer le projet ?"
        message={<>« {project?.title} » sera supprimé. Ses tâches et notes sont conservées et deviennent « sans projet ».</>}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={remove}
      />
    </form>
  );
}
