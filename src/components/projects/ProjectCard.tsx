import { Link } from 'react-router';
import { ArrowRight, CalendarDays } from 'lucide-react';
import type { Goal, Project, Task } from '../../models';
import { nextAction, projectProgress } from '../../domain/projects';
import { formatShort } from '../../domain/dates';
import { Badge, ProgressBar } from '../ui';
import { PROJECT_STATUS_LABELS } from '../tasks/labels';

const STATUS_TONE = { todo: 'neutral', in_progress: 'accent', paused: 'warning', done: 'success' } as const;

export function ProjectCard({ project, tasks, goal, day }: { project: Project; tasks: Task[]; goal?: Goal; day: string }) {
  const progress = projectProgress(project, tasks);
  const next = nextAction(project, tasks);
  const late = project.targetDate && project.status !== 'done' && project.targetDate < day;

  return (
    <Link to={`/projects/${project.id}`} className="block rounded-xl border border-line bg-surface p-4 transition-colors hover:border-faint">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-snug">{project.title}</h3>
        <Badge tone={STATUS_TONE[project.status]}>{PROJECT_STATUS_LABELS[project.status]}</Badge>
      </div>
      {goal && <p className="mt-1 text-xs text-muted">Objectif : {goal.title}</p>}

      <div className="mt-3 space-y-1.5">
        <div className="flex justify-between text-xs text-muted">
          <span>{progress.total === 0 ? 'Aucune tâche' : `${progress.done} / ${progress.total} tâches terminées`}</span>
          {project.targetDate && (
            <span className={`flex items-center gap-1 ${late ? 'text-danger' : ''}`}>
              <CalendarDays size={12} /> {formatShort(project.targetDate)}
            </span>
          )}
        </div>
        <ProgressBar ratio={progress.ratio} />
      </div>

      {project.status !== 'done' && (
        <p className="mt-3 flex items-center gap-1.5 text-xs">
          <ArrowRight size={12} className="shrink-0 text-accent" />
          {next ? <span className="truncate text-fg">{next.title}</span> : <span className="text-warning">Aucune prochaine action définie</span>}
        </p>
      )}
    </Link>
  );
}
