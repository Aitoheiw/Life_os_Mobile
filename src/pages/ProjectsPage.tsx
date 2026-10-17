import { useMemo, useState } from 'react';
import { FolderKanban, Plus } from 'lucide-react';
import type { ProjectStatus } from '../models';
import { useGoals, useProjects, useTasks, useToday } from '../hooks/useData';
import { Button, EmptyState, Modal, PageHeader, Card } from '../components/ui';
import { ProjectForm } from '../components/projects/ProjectForm';
import { ProjectCard } from '../components/projects/ProjectCard';

const SECTIONS: { status: ProjectStatus; title: string }[] = [
  { status: 'in_progress', title: 'En cours' },
  { status: 'todo', title: 'À faire' },
  { status: 'paused', title: 'En pause' },
  { status: 'done', title: 'Terminés' },
];

export function ProjectsPage() {
  const projects = useProjects();
  const tasks = useTasks();
  const goals = useGoals();
  const day = useToday();
  const [creating, setCreating] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const goalById = useMemo(() => new Map((goals ?? []).map((g) => [g.id, g])), [goals]);

  if (!projects || !tasks || !goals) return null;

  return (
    <>
      <PageHeader
        title="Projets"
        subtitle="Un projet regroupe les actions qui mènent à un résultat."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
            Nouveau projet
          </Button>
        }
      />

      {projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderKanban size={28} />}
            title="Aucun projet pour l’instant"
            action={
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setCreating(true)}>
                Créer un projet
              </Button>
            }
          >
            Crée un projet dès qu’un résultat demande plus d’une action (ex. « Préparer le déménagement »).
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-8">
          {SECTIONS.map(({ status, title }) => {
            const items = projects.filter((p) => p.status === status).sort((a, b) => a.title.localeCompare(b.title));
            if (items.length === 0) return null;
            const collapsed = status === 'done' && !showDone;
            return (
              <section key={status}>
                <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted uppercase">
                  {title} <span className="text-faint">{items.length}</span>
                  {status === 'done' && (
                    <button type="button" className="ml-2 text-xs font-normal normal-case text-accent hover:underline" onClick={() => setShowDone((v) => !v)}>
                      {showDone ? 'Masquer' : 'Afficher'}
                    </button>
                  )}
                </h2>
                {!collapsed && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((p) => (
                      <ProjectCard key={p.id} project={p} tasks={tasks} goal={p.goalId ? goalById.get(p.goalId) : undefined} day={day} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouveau projet">
        {creating && <ProjectForm onDone={() => setCreating(false)} />}
      </Modal>
    </>
  );
}
