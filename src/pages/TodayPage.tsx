import { useMemo } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, ArrowRight, CalendarCheck, FolderKanban, Inbox, Plus, Repeat, Star } from 'lucide-react';
import { useHabitLogs, useHabits, useNotes, useProjects, useTasks, useToday } from '../hooks/useData';
import { useEditors } from '../app/editors';
import { useFeedback } from '../app/feedback';
import { setFocus } from '../db/tasks';
import { compareTasks, isDueOn, isOverdue, MAX_DAILY_PRIORITIES } from '../domain/tasks';
import { describeFrequency, habitsDueOn } from '../domain/habits';
import { nextAction } from '../domain/projects';
import { dailyProgress } from '../domain/today';
import { formatLong } from '../domain/dates';
import { Button, Card, CardHeader, ProgressBar, Select } from '../components/ui';
import { TaskList } from '../components/tasks/TaskList';
import { HabitCheck } from '../components/habits/HabitCheck';
import { StreakFlame } from '../components/habits/Progress';
import { computeGamification, xpForToday } from '../domain/gamification';

/** Tableau de bord : ce qui compte aujourd'hui, lisible en quelques secondes. */
export function TodayPage() {
  const tasks = useTasks();
  const projects = useProjects();
  const habits = useHabits();
  const logs = useHabitLogs();
  const notes = useNotes();
  const day = useToday();
  const { newTask, capture } = useEditors();
  const { run } = useFeedback();

  const projectById = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects]);
  const gamification = useMemo(() => (habits && logs ? computeGamification(habits, logs, day) : null), [habits, logs, day]);

  if (!tasks || !projects || !habits || !logs || !notes || !gamification) return null;

  const focus = tasks.filter((t) => t.focusDate === day).sort(compareTasks);
  const focusIds = new Set(focus.map((t) => t.id));
  const open = tasks.filter((t) => t.status !== 'done').sort(compareTasks);
  const overdue = open.filter((t) => isOverdue(t, day) && !focusIds.has(t.id));
  const dueToday = open.filter((t) => isDueOn(t, day) && !focusIds.has(t.id));
  const candidates = open.filter((t) => !focusIds.has(t.id));
  const dueHabits = habitsDueOn(habits, day);
  const doneHabitIds = new Set(logs.filter((l) => l.date === day).map((l) => l.habitId));
  const activeProjects = projects.filter((p) => p.status === 'in_progress');
  const inboxCount = notes.filter((n) => n.kind === 'idea' && n.status === 'open').length;
  const progress = dailyProgress(tasks, habits, logs, day);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Aujourd’hui</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{formatLong(day)}</h1>
        </div>
        <div className="flex gap-2">
          <Button icon={<Inbox size={15} />} onClick={capture}>
            Idée
          </Button>
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => newTask({ dueDate: day })}>
            Tâche
          </Button>
        </div>
      </header>

      <Card className="mb-4 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium">Progression du jour</p>
          <p className="text-sm text-muted">{progress.total === 0 ? 'Rien de planifié' : `${progress.done} / ${progress.total} faits`}</p>
        </div>
        <ProgressBar ratio={progress.total ? progress.done / progress.total : null} className="mt-3" />
        {progress.total === 0 && <p className="mt-1 text-xs text-faint">Planifie une tâche pour aujourd’hui ou choisis tes priorités ci-dessous.</p>}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader title={`Priorités du jour (${focus.length}/${MAX_DAILY_PRIORITIES})`} icon={<Star size={14} />} />
            {focus.length > 0 && <TaskList tasks={focus} projectById={projectById} day={day} />}
            {focus.length < MAX_DAILY_PRIORITIES && (
              <div className="px-4 pt-1 pb-4">
                {candidates.length > 0 ? (
                  <Select aria-label="Ajouter une priorité" value="" onChange={(e) => e.target.value && run(() => setFocus(e.target.value, day))}>
                    <option value="">{focus.length === 0 ? 'Quelles sont les 3 choses les plus importantes aujourd’hui ?' : '+ Ajouter une priorité'}</option>
                    {candidates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <p className="text-sm text-muted">{focus.length ? 'Plus d’autre tâche ouverte à prioriser.' : 'Aucune tâche ouverte à prioriser. Crée-en une avec le bouton « Tâche ».'}</p>
                )}
              </div>
            )}
          </Card>

          {overdue.length > 0 && (
            <Card className="overflow-hidden border-danger/30">
              <CardHeader title={`En retard (${overdue.length})`} icon={<AlertTriangle size={14} className="text-danger" />} />
              <TaskList tasks={overdue} projectById={projectById} day={day} />
            </Card>
          )}

          <Card className="overflow-hidden">
            <CardHeader
              title={`Prévu aujourd’hui (${dueToday.length})`}
              icon={<CalendarCheck size={14} />}
              action={
                <Link to="/tasks" className="text-xs text-muted hover:text-fg">
                  Toutes les tâches
                </Link>
              }
            />
            {dueToday.length ? (
              <TaskList tasks={dueToday} projectById={projectById} day={day} />
            ) : (
              <p className="px-4 pb-4 text-sm text-muted">{focus.length ? 'Rien d’autre de prévu.' : 'Aucune tâche avec une échéance aujourd’hui.'}</p>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Habitudes"
              icon={<Repeat size={14} />}
              action={
                <Link to="/habits" className="text-xs text-muted transition-colors hover:text-fg">
                  Niv. {gamification.level.level} · {gamification.level.title}
                </Link>
              }
            />
            {dueHabits.length ? (
              <ul className="px-2 pb-2">
                {dueHabits.map((h) => {
                  const p = gamification.perHabit.get(h.id)!;
                  return (
                    <li key={h.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
                      <HabitCheck habit={h} day={day} done={doneHabitIds.has(h.id)} xpGain={xpForToday(h, p, day)} />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm transition-colors duration-300 ${doneHabitIds.has(h.id) ? 'text-faint line-through' : ''}`}>{h.name}</p>
                        <p className="text-xs text-faint">{describeFrequency(h)}</p>
                      </div>
                      <StreakFlame progress={p} doneToday={doneHabitIds.has(h.id)} />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-4 pb-4 text-sm text-muted">{habits.some((h) => h.status === 'active') ? 'Aucune habitude prévue aujourd’hui.' : 'Aucune habitude active.'}</p>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Projets en cours"
              icon={<FolderKanban size={14} />}
              action={
                <Link to="/projects" className="text-xs text-muted hover:text-fg">
                  Tous
                </Link>
              }
            />
            {activeProjects.length ? (
              <ul className="px-2 pb-2">
                {activeProjects.map((p) => {
                  const next = nextAction(p, tasks);
                  return (
                    <li key={p.id}>
                      <Link to={`/projects/${p.id}`} className="block rounded-lg px-2 py-2 hover:bg-surface-2/60">
                        <p className="truncate text-sm">{p.title}</p>
                        <p className="mt-0.5 flex items-center gap-1 truncate text-xs">
                          <ArrowRight size={11} className="shrink-0 text-accent" />
                          {next ? <span className="truncate text-muted">{next.title}</span> : <span className="text-warning">Définir la prochaine action</span>}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-4 pb-4 text-sm text-muted">Aucun projet en cours.</p>
            )}
          </Card>

          {inboxCount > 0 && (
            <Link to="/inbox" className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-sm hover:border-faint">
              <span className="flex items-center gap-2">
                <Inbox size={15} className="text-accent" /> {inboxCount} idée(s) à trier
              </span>
              <ArrowRight size={14} className="text-muted" />
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
