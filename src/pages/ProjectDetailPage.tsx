import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, NotebookPen, Pencil, Plus } from 'lucide-react';
import { useGoals, useNotes, useProjects, useTasks, useToday } from '../hooks/useData';
import { useEditors } from '../app/editors';
import { useFeedback } from '../app/feedback';
import { updateProject } from '../db/projects';
import { compareTasks } from '../domain/tasks';
import { nextAction, projectProgress } from '../domain/projects';
import { formatLong } from '../domain/dates';
import { Badge, Button, Card, CardHeader, EmptyState, Modal, PageHeader, ProgressBar, Select } from '../components/ui';
import { ProjectForm } from '../components/projects/ProjectForm';
import { TaskList } from '../components/tasks/TaskList';
import { PROJECT_STATUS_LABELS } from '../components/tasks/labels';

export function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const projects = useProjects();
  const tasks = useTasks();
  const goals = useGoals();
  const notes = useNotes();
  const day = useToday();
  const { newTask } = useEditors();
  const { run } = useFeedback();
  const [editing, setEditing] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const project = projects?.find((p) => p.id === id);
  const projectById = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects]);

  if (!projects || !tasks || !goals || !notes) return null;
  if (!project) {
    return (
      <Card>
        <EmptyState title="Projet introuvable" action={<Link to="/projects" className="text-sm text-accent hover:underline">Retour aux projets</Link>}>
          Il a peut-être été supprimé.
        </EmptyState>
      </Card>
    );
  }

  const own = tasks.filter((t) => t.projectId === project.id);
  const open = own.filter((t) => t.status !== 'done').sort(compareTasks);
  const done = own.filter((t) => t.status === 'done').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  const progress = projectProgress(project, tasks);
  const next = nextAction(project, tasks);
  const goal = goals.find((g) => g.id === project.goalId);
  const linkedNotes = notes.filter((n) => n.projectId === project.id && n.status !== 'archived');

  return (
    <>
      <Link to="/projects" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft size={14} /> Projets
      </Link>
      <PageHeader
        title={project.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={project.status === 'done' ? 'success' : project.status === 'paused' ? 'warning' : 'accent'}>{PROJECT_STATUS_LABELS[project.status]}</Badge>
            {goal && <span>Objectif : {goal.title}</span>}
            {project.targetDate && <span>· Date cible : {formatLong(project.targetDate)}</span>}
          </span>
        }
        actions={
          <Button icon={<Pencil size={14} />} onClick={() => setEditing(true)}>
            Modifier
          </Button>
        }
      />

      {project.description && <p className="mb-6 max-w-2xl text-sm whitespace-pre-wrap text-muted">{project.description}</p>}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs font-medium text-muted">Progression</p>
          <p className="mt-1 text-sm">{progress.total === 0 ? 'Ajoute des tâches pour suivre la progression.' : `${progress.done} tâche(s) terminée(s) sur ${progress.total}`}</p>
          <ProgressBar ratio={progress.ratio} className="mt-3" />
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <ArrowRight size={12} className="text-accent" /> Prochaine action
          </p>
          {open.length === 0 ? (
            <p className="mt-1 text-sm text-muted">{project.status === 'done' ? 'Projet terminé.' : 'Aucune tâche ouverte. Quelle est la prochaine étape concrète ?'}</p>
          ) : (
            <Select
              className="mt-2"
              aria-label="Choisir la prochaine action"
              value={next?.id ?? ''}
              onChange={(e) => run(() => updateProject(project.id, { nextActionTaskId: e.target.value || null }))}
            >
              {open.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
          )}
        </Card>
      </div>

      <Card className="mb-6 overflow-hidden">
        <CardHeader
          title={`Tâches ouvertes (${open.length})`}
          action={
            <Button size="sm" icon={<Plus size={14} />} onClick={() => newTask({ projectId: project.id })}>
              Ajouter
            </Button>
          }
        />
        {open.length ? <TaskList tasks={open} projectById={projectById} day={day} showProject={false} /> : <p className="px-4 pb-4 text-sm text-muted">Aucune tâche ouverte.</p>}
        {done.length > 0 && (
          <div className="border-t border-line">
            <button type="button" className="w-full px-4 py-2.5 text-left text-xs text-muted hover:text-fg" onClick={() => setShowDone((v) => !v)}>
              {showDone ? 'Masquer' : 'Afficher'} les {done.length} tâche(s) terminée(s)
            </button>
            {showDone && <TaskList tasks={done} projectById={projectById} day={day} showProject={false} />}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Notes liées" icon={<NotebookPen size={14} />} />
        {linkedNotes.length ? (
          <ul className="divide-y divide-line">
            {linkedNotes.map((n) => (
              <li key={n.id}>
                <Link to={`/notes?id=${n.id}`} className="block px-4 py-2.5 text-sm hover:bg-surface-2/50">
                  {n.title || 'Sans titre'}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 pb-4 text-sm text-muted">Aucune note. Tu peux lier une note à ce projet depuis la page Notes.</p>
        )}
      </Card>

      <Modal open={editing} onClose={() => setEditing(false)} title="Modifier le projet">
        {editing && <ProjectForm project={project} onDone={() => setEditing(false)} onDeleted={() => navigate('/projects')} />}
      </Modal>
    </>
  );
}
