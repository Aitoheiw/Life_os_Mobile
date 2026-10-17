import { Check, Repeat, Star, FolderKanban } from 'lucide-react';
import type { Project, Task } from '../../models';
import { completeTask, reopenTask, setFocus } from '../../db/tasks';
import { isOverdue } from '../../domain/tasks';
import { formatRelative } from '../../domain/dates';
import { describeRecurrence } from '../../domain/recurrence';
import { useFeedback } from '../../app/feedback';
import { useEditors } from '../../app/editors';
import { Badge, IconButton, cx } from '../ui';

/** Case à cocher ronde pour terminer / rouvrir une tâche. */
export function TaskCheckbox({ task }: { task: Task }) {
  const { run } = useFeedback();
  const done = task.status === 'done';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? `Rouvrir « ${task.title} »` : `Terminer « ${task.title} »`}
      onClick={() => run(() => (done ? reopenTask(task.id) : completeTask(task.id)))}
      className={cx(
        'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors',
        done ? 'border-success bg-success text-bg' : task.priority === 'high' ? 'border-danger/70 hover:bg-danger/10' : 'border-faint hover:border-accent',
      )}
    >
      {done && <Check size={12} strokeWidth={3} />}
    </button>
  );
}

/**
 * Ligne de tâche réutilisée partout (dashboard, liste, projet).
 * Cliquer sur le titre ouvre le formulaire de modification.
 */
export function TaskItem({ task, project, day, showProject = true }: { task: Task; project?: Project; day: string; showProject?: boolean }) {
  const { run } = useFeedback();
  const { editTask } = useEditors();
  const done = task.status === 'done';
  const overdue = isOverdue(task, day);
  const focused = task.focusDate === day;

  return (
    <li className="group flex items-start gap-3 px-4 py-2.5 hover:bg-surface-2/50">
      <div className="pt-0.5">
        <TaskCheckbox task={task} />
      </div>
      <button type="button" onClick={() => editTask(task)} className="min-w-0 flex-1 text-left">
        <span className={cx('block text-sm leading-snug', done ? 'text-faint line-through' : 'text-fg')}>{task.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          {task.dueDate && !done && <Badge tone={overdue ? 'danger' : task.dueDate === day ? 'accent' : 'neutral'}>{formatRelative(task.dueDate, day)}</Badge>}
          {task.status === 'in_progress' && <Badge tone="warning">En cours</Badge>}
          {task.priority === 'high' && !done && <Badge tone="danger">Priorité haute</Badge>}
          {task.recurrence && !done && (
            <Badge>
              <Repeat size={11} /> {describeRecurrence(task.recurrence)}
            </Badge>
          )}
          {showProject && project && (
            <Badge>
              <FolderKanban size={11} /> {project.title}
            </Badge>
          )}
        </span>
      </button>
      {!done && (
        <IconButton
          label={focused ? 'Retirer des priorités du jour' : 'Ajouter aux 3 priorités du jour'}
          icon={<Star size={15} fill={focused ? 'currentColor' : 'none'} />}
          className={cx(focused ? 'text-warning' : 'opacity-60 group-hover:opacity-100 sm:opacity-0 sm:focus:opacity-100')}
          onClick={() => run(() => setFocus(task.id, focused ? null : day))}
        />
      )}
    </li>
  );
}
