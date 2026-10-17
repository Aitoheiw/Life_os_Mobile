import { useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, FolderKanban, History } from 'lucide-react';
import type { WeeklyReview } from '../models';
import { useProjects, useReviews, useTasks, useToday } from '../hooks/useData';
import { saveWeeklyReview } from '../db/reviews';
import { summarizeWeek } from '../domain/review';
import { addDays, formatShort, startOfWeek } from '../domain/dates';
import { errorMessage, useFeedback } from '../app/feedback';
import { Badge, Button, Card, CardHeader, ErrorMessage, Field, IconButton, Input, PageHeader, Textarea, cx } from '../components/ui';

export function ReviewPage() {
  const tasks = useTasks();
  const projects = useProjects();
  const reviews = useReviews();
  const day = useToday();
  const currentWeek = startOfWeek(day);
  const [week, setWeek] = useState(currentWeek);

  const summary = useMemo(() => summarizeWeek(week, day, tasks ?? [], projects ?? []), [week, day, tasks, projects]);
  if (!tasks || !projects || !reviews) return null;

  const review = reviews.find((r) => r.weekStart === week);
  const isCurrent = week === currentWeek;

  return (
    <>
      <PageHeader title="Bilan de la semaine" subtitle="Regarder ce qui a avancé, comprendre ce qui a bloqué, choisir la suite." />

      <div className="mb-6 flex items-center gap-2">
        <IconButton label="Semaine précédente" icon={<ChevronLeft size={16} />} onClick={() => setWeek(addDays(week, -7))} />
        <p className="text-sm font-medium">
          Semaine du {formatShort(summary.weekStart)} au {formatShort(summary.weekEnd)}
        </p>
        <IconButton label="Semaine suivante" icon={<ChevronRight size={16} />} disabled={isCurrent} className="disabled:opacity-30" onClick={() => setWeek(addDays(week, 7))} />
        {!isCurrent && (
          <Button size="sm" variant="ghost" onClick={() => setWeek(currentWeek)}>
            Cette semaine
          </Button>
        )}
        {review && <Badge tone="success">Bilan rédigé</Badge>}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title={`Tâches terminées (${summary.completed.length})`} icon={<CheckCircle2 size={14} className="text-success" />} />
          <SummaryList items={summary.completed.map((t) => t.title)} empty="Aucune tâche terminée cette semaine." />
        </Card>
        <Card>
          <CardHeader title={`Projets ayant avancé (${summary.progressedProjects.length})`} icon={<FolderKanban size={14} />} />
          <SummaryList
            items={summary.progressedProjects.map(({ project, completedCount }) =>
              project.status === 'done' && completedCount === 0 ? `${project.title} — terminé` : `${project.title} — ${completedCount} tâche(s)`,
            )}
            empty="Aucun projet n’a avancé."
          />
        </Card>
        <Card>
          <CardHeader title={`Tâches reportées (${summary.postponed.length})`} icon={<Clock size={14} className="text-warning" />} />
          <SummaryList
            items={summary.postponed.map((t) => `${t.title}${t.postponedCount ? ` (reportée ${t.postponedCount}×)` : ' (échéance dépassée)'}`)}
            empty="Rien de reporté."
          />
        </Card>
      </div>

      <ReviewForm key={week} week={week} review={review} />

      {reviews.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted uppercase">
            <History size={13} /> Bilans précédents
          </h2>
          <Card className="divide-y divide-line">
            {reviews.map((r) => (
              <button key={r.id} type="button" onClick={() => setWeek(r.weekStart)} className={cx('block w-full px-4 py-3 text-left hover:bg-surface-2/50', r.weekStart === week && 'bg-surface-2')}>
                <p className="text-sm font-medium">Semaine du {formatShort(r.weekStart)}</p>
                <p className="mt-0.5 truncate text-xs text-muted">{r.nextPriorities.filter(Boolean).join(' · ') || r.wins || 'Bilan sans priorités'}</p>
              </button>
            ))}
          </Card>
        </section>
      )}
    </>
  );
}

function SummaryList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="px-4 pb-4 text-sm text-muted">{empty}</p>;
  return (
    <ul className="max-h-60 space-y-1 overflow-y-auto px-4 pb-4 text-sm">
      {items.map((it, i) => (
        <li key={i} className="truncate" title={it}>
          {it}
        </li>
      ))}
    </ul>
  );
}

function ReviewForm({ week, review }: { week: string; review?: WeeklyReview }) {
  const { notify } = useFeedback();
  const [wins, setWins] = useState(review?.wins ?? '');
  const [difficulties, setDifficulties] = useState(review?.difficulties ?? '');
  const [priorities, setPriorities] = useState<[string, string, string]>(review?.nextPriorities ?? ['', '', '']);
  const [error, setError] = useState('');

  const setPriority = (i: number, v: string) => setPriorities((p) => p.map((x, j) => (j === i ? v : x)) as [string, string, string]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await saveWeeklyReview(week, { wins, difficulties, nextPriorities: priorities });
      notify('Bilan enregistré');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Card className="p-5">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Réussites de la semaine">{(id) => <Textarea id={id} value={wins} onChange={(e) => setWins(e.target.value)} rows={5} placeholder="Ce qui a bien marché, ce dont tu es fier…" />}</Field>
          <Field label="Difficultés">{(id) => <Textarea id={id} value={difficulties} onChange={(e) => setDifficulties(e.target.value)} rows={5} placeholder="Ce qui a bloqué, pourquoi, ce que tu changerais…" />}</Field>
        </div>
        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-xs font-medium text-muted">Trois priorités pour la semaine suivante</legend>
          {priorities.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-4 text-sm text-faint">{i + 1}.</span>
              <div className="min-w-0 flex-1">
                <Input value={p} onChange={(e) => setPriority(i, e.target.value)} aria-label={`Priorité ${i + 1}`} />
              </div>
            </div>
          ))}
        </fieldset>
        <ErrorMessage>{error}</ErrorMessage>
        <div className="flex justify-end">
          <Button type="submit" variant="primary">
            {review ? 'Mettre à jour le bilan' : 'Enregistrer le bilan'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
