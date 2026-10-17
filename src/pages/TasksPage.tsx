import { useMemo, useState, type ReactNode } from 'react';
import { CheckSquare, Plus, Search } from 'lucide-react';
import type { Priority, Task } from '../models';
import { useProjects, useTasks, useToday } from '../hooks/useData';
import { useEditors } from '../app/editors';
import { compareTasks, filterTasks, isDueOn, isOverdue, isUpcoming } from '../domain/tasks';
import { Button, Card, EmptyState, Input, PageHeader, Select, Tabs } from '../components/ui';
import { TaskList } from '../components/tasks/TaskList';
import { PRIORITY_LABELS } from '../components/tasks/labels';

type View = 'today' | 'upcoming' | 'nodate' | 'open' | 'done';

export function TasksPage() {
  const tasks = useTasks();
  const projects = useProjects();
  const day = useToday();
  const { newTask } = useEditors();
  const [view, setView] = useState<View>('today');
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState<Priority | 'all'>('all');
  const [projectId, setProjectId] = useState<string>('all');

  const projectById = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects]);

  const filtered = useMemo(() => filterTasks(tasks ?? [], { search, priority, projectId }), [tasks, search, priority, projectId]);

  const groups = useMemo(() => {
    const open = filtered.filter((t) => t.status !== 'done').sort(compareTasks);
    return {
      overdue: open.filter((t) => isOverdue(t, day)),
      today: open.filter((t) => isDueOn(t, day)),
      upcoming: open.filter((t) => isUpcoming(t, day)).sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : a.dueDate! > b.dueDate! ? 1 : compareTasks(a, b))),
      nodate: open.filter((t) => t.dueDate === null),
      open,
      // Historique : les plus récemment terminées d'abord.
      done: filtered.filter((t) => t.status === 'done').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')),
    };
  }, [filtered, day]);

  if (!tasks || !projects) return null;

  const hasFilters = search !== '' || priority !== 'all' || projectId !== 'all';

  const list = (items: Task[]) => <TaskList tasks={items} projectById={projectById} day={day} />;

  return (
    <>
      <PageHeader
        title="Tâches"
        subtitle={`${groups.open.length} ouverte(s) · ${groups.done.length} terminée(s)`}
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => newTask()}>
            Nouvelle tâche
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <Tabs
          value={view}
          onChange={setView}
          items={[
            { value: 'today', label: 'Aujourd’hui', count: groups.today.length + groups.overdue.length },
            { value: 'upcoming', label: 'À venir', count: groups.upcoming.length },
            { value: 'nodate', label: 'Sans échéance', count: groups.nodate.length },
            { value: 'open', label: 'Toutes', count: groups.open.length },
            { value: 'done', label: 'Terminées', count: groups.done.length },
          ]}
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une tâche…" className="pl-9" aria-label="Rechercher" />
          </div>
          <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority | 'all')} aria-label="Filtrer par priorité">
            <option value="all">Toutes priorités</option>
            {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
              <option key={p} value={p}>
                Priorité {PRIORITY_LABELS[p].toLowerCase()}
              </option>
            ))}
          </Select>
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Filtrer par projet">
            <option value="all">Tous les projets</option>
            <option value="none">Sans projet</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {view === 'today' && (
        <div className="space-y-4">
          {groups.overdue.length > 0 && (
            <Section title="En retard" tone="danger">
              {list(groups.overdue)}
            </Section>
          )}
          <Section title="Aujourd’hui">
            {groups.today.length ? list(groups.today) : <Empty filtered={hasFilters} message="Rien de prévu aujourd’hui." onCreate={() => newTask({ dueDate: day })} />}
          </Section>
        </div>
      )}
      {view === 'upcoming' && <Section>{groups.upcoming.length ? list(groups.upcoming) : <Empty filtered={hasFilters} message="Aucune tâche planifiée pour les prochains jours." />}</Section>}
      {view === 'nodate' && <Section>{groups.nodate.length ? list(groups.nodate) : <Empty filtered={hasFilters} message="Toutes tes tâches ouvertes ont une échéance." />}</Section>}
      {view === 'open' && <Section>{groups.open.length ? list(groups.open) : <Empty filtered={hasFilters} message="Aucune tâche ouverte." onCreate={() => newTask()} />}</Section>}
      {view === 'done' && <Section>{groups.done.length ? list(groups.done) : <Empty filtered={hasFilters} message="Les tâches terminées apparaîtront ici, elles restent dans l’historique." />}</Section>}
    </>
  );
}

function Section({ title, tone, children }: { title?: string; tone?: 'danger'; children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      {title && <h2 className={`px-4 pt-3 pb-1 text-xs font-semibold tracking-wide uppercase ${tone === 'danger' ? 'text-danger' : 'text-muted'}`}>{title}</h2>}
      {children}
    </Card>
  );
}

function Empty({ filtered, message, onCreate }: { filtered: boolean; message: string; onCreate?: () => void }) {
  return (
    <EmptyState
      icon={<CheckSquare size={28} />}
      title={filtered ? 'Aucun résultat' : message}
      action={!filtered && onCreate ? <Button size="sm" icon={<Plus size={14} />} onClick={onCreate}>Ajouter une tâche</Button> : undefined}
    >
      {filtered ? 'Aucune tâche ne correspond à ces filtres.' : undefined}
    </EmptyState>
  );
}
