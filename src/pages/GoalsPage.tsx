import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Archive, CheckCircle2, FolderKanban, Pencil, Plus, RotateCcw, Target, Trash2 } from 'lucide-react';
import type { Goal, GoalProgress, Project } from '../models';
import { useGoals, useProjects, useToday } from '../hooks/useData';
import { createGoal, deleteGoal, updateGoal } from '../db/projects';
import { goalProgress } from '../domain/projects';
import { formatShort } from '../domain/dates';
import { errorMessage, useFeedback } from '../app/feedback';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorMessage, Field, IconButton, Input, Modal, PageHeader, ProgressBar, Select, Tabs, Textarea } from '../components/ui';
import { ProjectForm } from '../components/projects/ProjectForm';
import { PROJECT_STATUS_LABELS } from '../components/tasks/labels';

type View = 'active' | 'achieved' | 'archived';

export function GoalsPage() {
  const goals = useGoals();
  const projects = useProjects();
  const day = useToday();
  const [view, setView] = useState<View>('active');
  const [editing, setEditing] = useState<Goal | 'new' | null>(null);

  if (!goals || !projects) return null;
  const items = goals.filter((g) => g.status === view).sort((a, b) => (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999'));

  return (
    <>
      <PageHeader
        title="Objectifs"
        subtitle="Un objectif est un résultat à atteindre. Les projets sont les moyens d’y arriver."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>
            Nouvel objectif
          </Button>
        }
      />
      <div className="mb-4">
        <Tabs
          value={view}
          onChange={setView}
          items={[
            { value: 'active', label: 'En cours', count: goals.filter((g) => g.status === 'active').length },
            { value: 'achieved', label: 'Atteints', count: goals.filter((g) => g.status === 'achieved').length },
            { value: 'archived', label: 'Archivés', count: goals.filter((g) => g.status === 'archived').length },
          ]}
        />
      </div>

      {items.length === 0 ? (
        <Card>
          <EmptyState icon={<Target size={28} />} title={view === 'active' ? 'Aucun objectif en cours' : 'Rien ici pour l’instant'}>
            {view === 'active' && 'Formule un résultat mesurable, par exemple « Courir un 10 km » ou « Lire 12 livres cette année ».'}
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((g) => (
            <GoalCard key={g.id} goal={g} projects={projects} day={day} onEdit={() => setEditing(g)} />
          ))}
        </div>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Nouvel objectif' : 'Modifier l’objectif'}>
        {editing !== null && <GoalForm goal={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </>
  );
}

function GoalCard({ goal, projects, day, onEdit }: { goal: Goal; projects: Project[]; day: string; onEdit: () => void }) {
  const { run } = useFeedback();
  const [addingProject, setAddingProject] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [metricValue, setMetricValue] = useState('');
  const progress = goalProgress(goal, projects);
  const linked = projects.filter((p) => p.goalId === goal.id);
  const late = goal.status === 'active' && goal.targetDate !== null && goal.targetDate < day;

  const saveMetric = (e: FormEvent) => {
    e.preventDefault();
    if (goal.progress.type !== 'metric' || metricValue === '') return;
    const current = Number(metricValue);
    void run(() => updateGoal(goal.id, { progress: { ...goal.progress, current } as GoalProgress }), 'Progression mise à jour').then((ok) => ok && setMetricValue(''));
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{goal.title}</h3>
          {goal.description && <p className="mt-1 text-sm whitespace-pre-wrap text-muted">{goal.description}</p>}
        </div>
        <div className="flex items-center gap-1">
          {goal.targetDate && <Badge tone={late ? 'danger' : 'neutral'}>Cible : {formatShort(goal.targetDate)}</Badge>}
          <IconButton label="Modifier" icon={<Pencil size={14} />} onClick={onEdit} />
          {goal.status === 'active' ? (
            <>
              <IconButton label="Marquer comme atteint" icon={<CheckCircle2 size={15} />} onClick={() => run(() => updateGoal(goal.id, { status: 'achieved' }), 'Objectif atteint, bravo')} />
              <IconButton label="Archiver" icon={<Archive size={14} />} onClick={() => run(() => updateGoal(goal.id, { status: 'archived' }), 'Objectif archivé')} />
            </>
          ) : (
            <>
              <IconButton label="Remettre en cours" icon={<RotateCcw size={14} />} onClick={() => run(() => updateGoal(goal.id, { status: 'active' }))} />
              <IconButton label="Supprimer" icon={<Trash2 size={14} />} onClick={() => setConfirmDelete(true)} />
            </>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <p className="text-xs text-muted">{progress.label}</p>
        <ProgressBar ratio={progress.ratio} />
      </div>

      {goal.progress.type === 'metric' && goal.status === 'active' && (
        <form onSubmit={saveMetric} className="mt-3 flex items-center gap-2">
          <Input type="number" step="any" min={0} value={metricValue} onChange={(e) => setMetricValue(e.target.value)} placeholder={`Nouvelle valeur (${goal.progress.current})`} className="max-w-48" aria-label="Nouvelle valeur" />
          <Button size="sm" type="submit" disabled={metricValue === ''}>
            Mettre à jour
          </Button>
        </form>
      )}

      <div className="mt-4 border-t border-line pt-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-muted">Projets associés ({linked.length})</p>
          {goal.status === 'active' && (
            <Button size="sm" variant="ghost" icon={<Plus size={13} />} onClick={() => setAddingProject(true)}>
              Projet
            </Button>
          )}
        </div>
        {linked.length ? (
          <ul className="space-y-1">
            {linked.map((p) => (
              <li key={p.id}>
                <Link to={`/projects/${p.id}`} className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-surface-2">
                  <FolderKanban size={13} className="text-faint" />
                  <span className={p.status === 'done' ? 'text-faint line-through' : ''}>{p.title}</span>
                  <span className="ml-auto text-xs text-faint">{PROJECT_STATUS_LABELS[p.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-faint">Aucun projet. Quelle action concrète te rapprocherait de cet objectif ?</p>
        )}
      </div>

      <Modal open={addingProject} onClose={() => setAddingProject(false)} title="Nouveau projet">
        {addingProject && <ProjectForm defaultGoalId={goal.id} onDone={() => setAddingProject(false)} />}
      </Modal>
      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer l’objectif ?"
        message={<>« {goal.title} » sera supprimé définitivement. Ses projets et notes sont conservés.</>}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => run(() => deleteGoal(goal.id), 'Objectif supprimé').then(() => setConfirmDelete(false))}
      />
    </Card>
  );
}

function GoalForm({ goal, onDone }: { goal?: Goal; onDone: () => void }) {
  const { notify } = useFeedback();
  const [title, setTitle] = useState(goal?.title ?? '');
  const [description, setDescription] = useState(goal?.description ?? '');
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? '');
  const [type, setType] = useState<GoalProgress['type']>(goal?.progress.type ?? 'projects');
  const metric = goal?.progress.type === 'metric' ? goal.progress : { current: 0, target: 10, unit: '' };
  const [current, setCurrent] = useState(String(metric.current));
  const [target, setTarget] = useState(String(metric.target));
  const [unit, setUnit] = useState(metric.unit);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const progress: GoalProgress = type === 'projects' ? { type } : { type, current: Number(current), target: Number(target), unit: unit.trim() };
    const values = { title, description, targetDate: targetDate || null, progress };
    try {
      if (goal) await updateGoal(goal.id, values);
      else await createGoal(values);
      notify(goal ? 'Objectif modifié' : 'Objectif créé');
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Résultat à atteindre">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Lire 12 livres en 2027" autoFocus required />}</Field>
      <Field label="Pourquoi c’est important (facultatif)">{(id) => <Textarea id={id} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />}</Field>
      <Field label="Date cible (facultative)">{(id) => <Input id={id} type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />}</Field>
      <Field
        label="Comment mesurer la progression ?"
        hint={type === 'projects' ? 'Progression = projets associés terminés / projets associés.' : 'Progression = valeur actuelle / valeur cible. Tu mets la valeur à jour toi-même.'}
      >
        {(id) => (
          <Select id={id} value={type} onChange={(e) => setType(e.target.value as GoalProgress['type'])}>
            <option value="projects">Par les projets associés</option>
            <option value="metric">Par une valeur chiffrée</option>
          </Select>
        )}
      </Field>
      {type === 'metric' && (
        <div className="grid grid-cols-3 gap-3">
          <Field label="Actuel">{(id) => <Input id={id} type="number" step="any" min={0} value={current} onChange={(e) => setCurrent(e.target.value)} />}</Field>
          <Field label="Cible">{(id) => <Input id={id} type="number" step="any" min={0} value={target} onChange={(e) => setTarget(e.target.value)} />}</Field>
          <Field label="Unité">{(id) => <Input id={id} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="livres, km…" />}</Field>
        </div>
      )}
      <ErrorMessage>{error}</ErrorMessage>
      <div className="flex justify-end gap-2">
        <Button onClick={onDone}>Annuler</Button>
        <Button type="submit" variant="primary">
          {goal ? 'Enregistrer' : 'Créer l’objectif'}
        </Button>
      </div>
    </form>
  );
}
