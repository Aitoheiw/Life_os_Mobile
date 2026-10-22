import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Archive, ArrowUpDown, Check, ChevronDown, ChevronUp, Pause, Pencil, Play, Plus, Repeat, RotateCcw, Trash2 } from 'lucide-react';
import type { Habit, HabitFrequency, HabitLog } from '../models';
import { useHabitLogs, useHabits, useToday } from '../hooks/useData';
import { archiveHabit, createHabit, deleteHabit, pauseHabit, reorderHabits, resumeHabit, toggleHabitLog, unarchiveHabit, updateHabit } from '../db/habits';
import { describeFrequency, habitStats, isScheduledOn, moveHabit } from '../domain/habits';
import { addDays, dateRange, formatShort } from '../domain/dates';
import { errorMessage, useFeedback } from '../app/feedback';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorMessage, Field, IconButton, Input, Modal, PageHeader, Select, Textarea, cx } from '../components/ui';
import { WeekdayPicker } from '../components/WeekdayPicker';
import { HabitCheck } from '../components/habits/HabitCheck';
import { BadgeGrid, ProgressPanel, StreakFlame } from '../components/habits/Progress';
import { computeGamification, xpForToday, type GamificationSummary, type HabitProgress } from '../domain/gamification';

export function HabitsPage() {
  const habits = useHabits();
  const logs = useHabitLogs();
  const day = useToday();
  const [editing, setEditing] = useState<Habit | 'new' | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const summary = useMemo(() => (habits && logs ? computeGamification(habits, logs, day) : null), [habits, logs, day]);
  const celebrate = useCelebrations(summary);

  if (!habits || !logs || !summary) return null;
  const active = habits.filter((h) => h.status === 'active');
  const paused = habits.filter((h) => h.status === 'paused');
  const archived = habits.filter((h) => h.status === 'archived');

  return (
    <>
      <PageHeader
        title="Habitudes"
        subtitle="La régularité ne compte que les jours prévus. Une habitude suspendue ne te pénalise pas."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>
            Nouvelle habitude
          </Button>
        }
      />

      {habits.length === 0 ? (
        <Card>
          <EmptyState icon={<Repeat size={28} />} title="Aucune habitude">
            Commence petit : une habitude facile à tenir vaut mieux que cinq abandonnées.
          </EmptyState>
        </Card>
      ) : (
        <>
          <ProgressPanel summary={summary} celebrate={celebrate} />
          <div className="space-y-6">
            <HabitSection title="Actives" habits={active} all={habits} logs={logs} day={day} summary={summary} onEdit={setEditing} empty="Aucune habitude active." />
            {paused.length > 0 && <HabitSection title="Suspendues" habits={paused} all={habits} logs={logs} day={day} summary={summary} onEdit={setEditing} />}
            {archived.length > 0 && (
              <section>
                <button type="button" onClick={() => setShowArchived((v) => !v)} className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase hover:text-fg">
                  Archivées ({archived.length}) · {showArchived ? 'masquer' : 'afficher'}
                </button>
                {showArchived && <HabitSection habits={archived} all={habits} logs={logs} day={day} summary={summary} onEdit={setEditing} />}
              </section>
            )}
          </div>
          <BadgeGrid summary={summary} />
        </>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Nouvelle habitude' : 'Modifier l’habitude'}>
        {editing !== null && <HabitForm habit={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </>
  );
}

interface HabitSectionProps {
  title?: string;
  habits: Habit[];
  /** Toutes les habitudes (triées) : nécessaire pour calculer le nouvel ordre global. */
  all: Habit[];
  logs: HabitLog[];
  day: string;
  summary: GamificationSummary;
  onEdit: (h: Habit) => void;
  empty?: string;
}

function HabitSection({ title, habits, all, logs, day, summary, onEdit, empty }: HabitSectionProps) {
  const [reordering, setReordering] = useState(false);
  return (
    <section>
      {(title || habits.length > 1) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title ? <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2> : <span />}
          {habits.length > 1 && (
            <Button size="sm" variant={reordering ? 'primary' : 'ghost'} icon={reordering ? <Check size={14} /> : <ArrowUpDown size={14} />} onClick={() => setReordering((r) => !r)}>
              {reordering ? 'Terminé' : 'Réorganiser'}
            </Button>
          )}
        </div>
      )}
      {habits.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : reordering ? (
        <ReorderList habits={habits} all={all} />
      ) : (
        <Card className="divide-y divide-line">
          {habits.map((h) => (
            <HabitRow key={h.id} habit={h} logs={logs} day={day} progress={summary.perHabit.get(h.id)!} onEdit={() => onEdit(h)} />
          ))}
        </Card>
      )}
    </section>
  );
}

/** Mode « Réorganiser » : liste compacte avec des flèches pour monter / descendre chaque habitude. */
function ReorderList({ habits, all }: { habits: Habit[]; all: Habit[] }) {
  const { run } = useFeedback();
  // Dernière habitude déplacée : surlignée un court instant pour suivre son déplacement.
  const [moved, setMoved] = useState<string | null>(null);
  useEffect(() => {
    if (!moved) return;
    const t = window.setTimeout(() => setMoved(null), 700);
    return () => window.clearTimeout(t);
  }, [moved]);

  const move = (id: string, direction: -1 | 1) => {
    const order = moveHabit(all, id, direction);
    if (!order) return;
    setMoved(id);
    void run(() => reorderHabits(order));
  };

  return (
    <Card className="divide-y divide-line">
      {habits.map((h, i) => (
        <div key={h.id} className={cx('flex items-center gap-3 py-2 pr-2 pl-4 transition-colors duration-500 ease-smooth', moved === h.id && 'bg-accent-soft')}>
          <span className="w-5 text-right font-mono text-xs text-faint tabular-nums">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{h.name}</p>
            <p className="text-xs text-muted">{describeFrequency(h)}</p>
          </div>
          {/* Boutons de 40 px : faciles à toucher sur téléphone. */}
          <IconButton label={`Monter « ${h.name} »`} icon={<ChevronUp size={18} />} className="h-10 w-10 disabled:opacity-30" disabled={i === 0} onClick={() => move(h.id, -1)} />
          <IconButton label={`Descendre « ${h.name} »`} icon={<ChevronDown size={18} />} className="h-10 w-10 disabled:opacity-30" disabled={i === habits.length - 1} onClick={() => move(h.id, 1)} />
        </div>
      ))}
    </Card>
  );
}

/**
 * Repère les progrès faits pendant la visite (pas au chargement de la page) :
 * niveau gagné et badge débloqué → message ; journée parfaite → confettis.
 * Retourne un compteur qui change à chaque journée parfaite (clé des confettis).
 */
function useCelebrations(summary: GamificationSummary | null): number {
  const { notify } = useFeedback();
  const previous = useRef<GamificationSummary | null>(null);
  const [celebrate, setCelebrate] = useState(0);
  useEffect(() => {
    const before = previous.current;
    previous.current = summary;
    if (!before || !summary) return;
    if (summary.level.level > before.level.level) notify(`Niveau ${summary.level.level} atteint · ${summary.level.title}`);
    for (const b of summary.badges) {
      if (b.unlocked && !before.badges.find((x) => x.id === b.id)?.unlocked) notify(`Badge débloqué : ${b.name}`);
    }
    const perfect = (s: GamificationSummary) => s.today.due > 0 && s.today.done === s.today.due;
    if (perfect(summary) && !perfect(before)) setCelebrate((c) => c + 1);
  }, [summary, notify]);
  return celebrate;
}

const pct = (rate: number | null) => (rate === null ? '—' : `${Math.round(rate * 100)} %`);

function HabitRow({ habit, logs, day, progress, onEdit }: { habit: Habit; logs: HabitLog[]; day: string; progress: HabitProgress; onEdit: () => void }) {
  const { run } = useFeedback();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const own = useMemo(() => logs.filter((l) => l.habitId === habit.id), [logs, habit.id]);
  const doneDays = useMemo(() => new Set(own.map((l) => l.date)), [own]);
  const s7 = habitStats(habit, own, day, 7);
  const s30 = habitStats(habit, own, day, 30);
  const dueToday = habit.status === 'active' && isScheduledOn(habit, day);
  const doneToday = doneDays.has(day);

  return (
    <div className="flex flex-col gap-3 px-4 py-3.5 transition-colors duration-200 hover:bg-surface-2/30 lg:flex-row lg:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <HabitCheck habit={habit} day={day} done={doneToday} disabled={habit.status !== 'active'} xpGain={xpForToday(habit, progress, day)} />
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="truncate">{habit.name}</span>
            <StreakFlame progress={progress} doneToday={doneToday} />
          </p>
          <p className="text-xs text-muted">
            {describeFrequency(habit)}
            {habit.status === 'active' && !dueToday && ' · pas prévue aujourd’hui'}
            {progress.streakAtRisk && <span className="text-warning"> · série de {progress.currentStreak} j en jeu</span>}
            {progress.bestStreak > 0 && <span className="text-faint"> · record {progress.bestStreak} j</span>}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <History habit={habit} doneDays={doneDays} day={day} />
        <div className="flex gap-3 text-xs text-muted" title="Réalisations sur les jours prévus">
          <span>
            7 j <strong className="font-semibold text-fg">{pct(s7.rate)}</strong>
          </span>
          <span>
            30 j <strong className="font-semibold text-fg">{pct(s30.rate)}</strong>
          </span>
        </div>
        <div className="flex">
          {habit.status !== 'archived' && <IconButton label="Modifier" icon={<Pencil size={14} />} onClick={onEdit} />}
          {habit.status === 'active' && <IconButton label="Suspendre" icon={<Pause size={14} />} onClick={() => run(() => pauseHabit(habit.id), 'Habitude suspendue')} />}
          {habit.status === 'paused' && <IconButton label="Reprendre" icon={<Play size={14} />} onClick={() => run(() => resumeHabit(habit.id), 'Habitude reprise')} />}
          {habit.status !== 'archived' ? (
            <IconButton label="Archiver" icon={<Archive size={14} />} onClick={() => run(() => archiveHabit(habit.id), 'Habitude archivée (historique conservé)')} />
          ) : (
            <>
              <IconButton label="Réactiver" icon={<RotateCcw size={14} />} onClick={() => run(() => unarchiveHabit(habit.id))} />
              <IconButton label="Supprimer définitivement" icon={<Trash2 size={14} />} onClick={() => setConfirmDelete(true)} />
            </>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer l’habitude ?"
        message={<>« {habit.name} » et ses {own.length} réalisation(s) seront supprimées définitivement. L’archivage suffit pour la masquer.</>}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => run(() => deleteHabit(habit.id), 'Habitude supprimée').then(() => setConfirmDelete(false))}
      />
    </div>
  );
}

/** 30 derniers jours. Un clic sur un jour passé prévu permet de corriger un oubli. */
function History({ habit, doneDays, day }: { habit: Habit; doneDays: Set<string>; day: string }) {
  const { run } = useFeedback();
  const days = dateRange(addDays(day, -29), day);
  return (
    <div className="flex h-4 items-center gap-[3px]" aria-label="Historique des 30 derniers jours (vert : fait, gris : manqué, trait : non prévu)">
      {days.map((d) => {
        const done = doneDays.has(d);
        const scheduled = isScheduledOn(habit, d);
        const label = `${formatShort(d)} : ${done ? 'fait' : scheduled ? 'pas fait' : 'non prévu'}`;
        return (
          <button
            key={d}
            type="button"
            title={label}
            aria-label={label}
            disabled={habit.status === 'archived' || (!scheduled && !done)}
            onClick={() => run(() => toggleHabitLog(habit.id, d))}
            className={cx(
              'w-[7px] rounded-[2px] transition-all duration-300 ease-smooth sm:w-2',
              done ? 'h-4 bg-success' : scheduled ? 'h-4 bg-faint/40 hover:bg-faint' : 'h-1 bg-line',
              d === day && 'ring-1 ring-faint ring-offset-1 ring-offset-surface',
            )}
          />
        );
      })}
    </div>
  );
}

function HabitForm({ habit, onDone }: { habit?: Habit; onDone: () => void }) {
  const { notify } = useFeedback();
  const [name, setName] = useState(habit?.name ?? '');
  const [description, setDescription] = useState(habit?.description ?? '');
  const [type, setType] = useState<HabitFrequency['type']>(habit?.frequency.type ?? 'daily');
  const [days, setDays] = useState<number[]>(habit?.frequency.type === 'weekly' ? habit.frequency.days : [1, 3, 5]);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const frequency: HabitFrequency = type === 'daily' ? { type } : { type, days };
    try {
      if (habit) await updateHabit(habit.id, { name, description, frequency });
      else await createHabit({ name, description, frequency });
      notify(habit ? 'Habitude modifiée' : 'Habitude créée');
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Nom">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Lire 10 pages" autoFocus required />}</Field>
      <Field label="Description (facultative)">{(id) => <Textarea id={id} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />}</Field>
      <Field label="Fréquence">
        {(id) => (
          <div className="space-y-2">
            <Select id={id} value={type} onChange={(e) => setType(e.target.value as HabitFrequency['type'])}>
              <option value="daily">Tous les jours</option>
              <option value="weekly">Certains jours de la semaine</option>
            </Select>
            {type === 'weekly' && <WeekdayPicker value={days} onChange={setDays} />}
          </div>
        )}
      </Field>
      {habit && <Badge>Changer la fréquence s’applique aussi au calcul de l’historique.</Badge>}
      <ErrorMessage>{error}</ErrorMessage>
      <div className="flex justify-end gap-2">
        <Button onClick={onDone}>Annuler</Button>
        <Button type="submit" variant="primary">
          {habit ? 'Enregistrer' : 'Créer l’habitude'}
        </Button>
      </div>
    </form>
  );
}
