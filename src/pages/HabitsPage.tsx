import { useMemo, useState, type FormEvent } from 'react';
import { Archive, Pause, Pencil, Play, Plus, Repeat, RotateCcw, Trash2 } from 'lucide-react';
import type { Habit, HabitFrequency, HabitLog } from '../models';
import { useHabitLogs, useHabits, useToday } from '../hooks/useData';
import { archiveHabit, createHabit, deleteHabit, pauseHabit, resumeHabit, toggleHabitLog, unarchiveHabit, updateHabit } from '../db/habits';
import { describeFrequency, habitStats, isScheduledOn } from '../domain/habits';
import { addDays, dateRange, formatShort } from '../domain/dates';
import { errorMessage, useFeedback } from '../app/feedback';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorMessage, Field, IconButton, Input, Modal, PageHeader, Select, Textarea, cx } from '../components/ui';
import { WeekdayPicker } from '../components/WeekdayPicker';
import { HabitCheck } from '../components/habits/HabitCheck';

export function HabitsPage() {
  const habits = useHabits();
  const logs = useHabitLogs();
  const day = useToday();
  const [editing, setEditing] = useState<Habit | 'new' | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  if (!habits || !logs) return null;
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
        <div className="space-y-6">
          <HabitSection title="Actives" habits={active} logs={logs} day={day} onEdit={setEditing} empty="Aucune habitude active." />
          {paused.length > 0 && <HabitSection title="Suspendues" habits={paused} logs={logs} day={day} onEdit={setEditing} />}
          {archived.length > 0 && (
            <section>
              <button type="button" onClick={() => setShowArchived((v) => !v)} className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase hover:text-fg">
                Archivées ({archived.length}) · {showArchived ? 'masquer' : 'afficher'}
              </button>
              {showArchived && <HabitSection habits={archived} logs={logs} day={day} onEdit={setEditing} />}
            </section>
          )}
        </div>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Nouvelle habitude' : 'Modifier l’habitude'}>
        {editing !== null && <HabitForm habit={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </>
  );
}

function HabitSection({ title, habits, logs, day, onEdit, empty }: { title?: string; habits: Habit[]; logs: HabitLog[]; day: string; onEdit: (h: Habit) => void; empty?: string }) {
  return (
    <section>
      {title && <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>}
      {habits.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <Card className="divide-y divide-line">
          {habits.map((h) => (
            <HabitRow key={h.id} habit={h} logs={logs} day={day} onEdit={() => onEdit(h)} />
          ))}
        </Card>
      )}
    </section>
  );
}

const pct = (rate: number | null) => (rate === null ? '—' : `${Math.round(rate * 100)} %`);

function HabitRow({ habit, logs, day, onEdit }: { habit: Habit; logs: HabitLog[]; day: string; onEdit: () => void }) {
  const { run } = useFeedback();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const own = useMemo(() => logs.filter((l) => l.habitId === habit.id), [logs, habit.id]);
  const doneDays = useMemo(() => new Set(own.map((l) => l.date)), [own]);
  const s7 = habitStats(habit, own, day, 7);
  const s30 = habitStats(habit, own, day, 30);
  const dueToday = habit.status === 'active' && isScheduledOn(habit, day);
  const doneToday = doneDays.has(day);

  return (
    <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <HabitCheck habit={habit} day={day} done={doneToday} disabled={habit.status !== 'active'} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{habit.name}</p>
          <p className="text-xs text-muted">
            {describeFrequency(habit)}
            {habit.status === 'active' && !dueToday && ' · pas prévue aujourd’hui'}
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
              'w-[7px] rounded-[2px] sm:w-2',
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
