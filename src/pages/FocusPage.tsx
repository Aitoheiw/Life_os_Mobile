import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Pause, Play, RotateCcw, Settings2, SkipForward, Timer, Trash2 } from 'lucide-react';
import { usePomodoro } from '../app/pomodoro';
import { useFeedback } from '../app/feedback';
import { useFocusSessions, useTasks, useToday } from '../hooks/useData';
import { deleteFocusSession } from '../db/focus';
import { compareTasks } from '../domain/tasks';
import { addDays, startOfWeek } from '../domain/dates';
import { focusTotals, formatClock, formatMinutes, phaseDurationMs, PHASE_LABELS, type Phase, type PomodoroSettings } from '../domain/pomodoro';
import { Button, Card, CardHeader, Field, IconButton, Input, Modal, PageHeader, ProgressBar, Select, Tabs } from '../components/ui';

export function FocusPage() {
  const tasks = useTasks();
  const sessions = useFocusSessions();
  const day = useToday();
  const { run } = useFeedback();
  const { state, settings, remaining, start, pause, reset, switchPhase, setTask, updateSettings } = usePomodoro();
  const [editingSettings, setEditingSettings] = useState(false);

  if (!tasks || !sessions) return null;

  const openTasks = tasks.filter((t) => t.status !== 'done').sort(compareTasks);
  const taskTitle = new Map(tasks.map((t) => [t.id, t.title]));
  const linkedTaskExists = state.taskId === null || openTasks.some((t) => t.id === state.taskId);
  const todaySessions = sessions.filter((s) => s.date === day).sort((a, b) => b.endedAt.localeCompare(a.endedAt));
  const today = focusTotals(sessions, day, day);
  const week = focusTotals(sessions, startOfWeek(day), addDays(startOfWeek(day), 6));
  const total = phaseDurationMs(state.phase, settings);
  const isBreak = state.phase !== 'focus';
  const sessionNumber = (state.completedInCycle % settings.longEvery) + (state.phase === 'focus' ? 1 : 0);

  return (
    <>
      <PageHeader
        title="Focus"
        subtitle="Une tâche, un temps limité, puis une vraie pause. Les sessions interrompues ne sont pas comptées."
        actions={
          <Button icon={<Settings2 size={15} />} onClick={() => setEditingSettings(true)}>
            Durées
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <Card className="p-5">
          <div className={state.status !== 'idle' ? 'pointer-events-none opacity-50' : ''} title={state.status !== 'idle' ? 'Réinitialise le minuteur pour changer de phase' : undefined}>
            <Tabs<Phase>
              value={state.phase}
              onChange={switchPhase}
              items={(['focus', 'short', 'long'] as Phase[]).map((p) => ({ value: p, label: PHASE_LABELS[p] }))}
            />
          </div>

          <div className="py-10 text-center">
            <p className={`font-mono text-6xl font-semibold tracking-tight tabular-nums sm:text-7xl ${isBreak ? 'text-success' : ''}`} aria-live="off">
              {formatClock(remaining)}
            </p>
            <p className="mt-2 text-sm text-muted">
              {isBreak ? PHASE_LABELS[state.phase] : `Session ${sessionNumber} sur ${settings.longEvery} avant la pause longue`}
              {state.status === 'paused' && ' · en pause'}
            </p>
            <ProgressBar ratio={state.status === 'idle' ? null : 1 - remaining / total} className="mx-auto mt-5 max-w-xs" />
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {state.status === 'running' ? (
              <Button variant="primary" icon={<Pause size={16} />} onClick={pause} className="min-w-32">
                Pause
              </Button>
            ) : (
              <Button variant="primary" icon={<Play size={16} />} onClick={start} className="min-w-32">
                {state.status === 'paused' ? 'Reprendre' : 'Démarrer'}
              </Button>
            )}
            {state.status !== 'idle' && (
              <Button icon={<RotateCcw size={15} />} onClick={reset}>
                Réinitialiser
              </Button>
            )}
            {isBreak && (
              <Button variant="ghost" icon={<SkipForward size={15} />} onClick={() => switchPhase('focus')}>
                Passer la pause
              </Button>
            )}
          </div>

          <div className="mt-6 border-t border-line pt-4">
            <Field label="Sur quoi travailles-tu ?">
              {(id) => (
                <Select id={id} value={linkedTaskExists ? (state.taskId ?? '') : ''} onChange={(e) => setTask(e.target.value || null)}>
                  <option value="">Sans tâche particulière</option>
                  {openTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="grid grid-cols-2 divide-x divide-line">
            <div className="p-4">
              <p className="text-xs text-muted">Aujourd’hui</p>
              <p className="mt-1 text-lg font-semibold">{formatMinutes(today.minutes)}</p>
              <p className="text-xs text-faint">{today.count} session(s)</p>
            </div>
            <div className="p-4">
              <p className="text-xs text-muted">Cette semaine</p>
              <p className="mt-1 text-lg font-semibold">{formatMinutes(week.minutes)}</p>
              <p className="text-xs text-faint">{week.count} session(s)</p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Sessions du jour" icon={<Timer size={14} />} />
            {todaySessions.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted">Aucune session terminée aujourd’hui.</p>
            ) : (
              <ul className="divide-y divide-line">
                {todaySessions.map((s) => (
                  <li key={s.id} className="group flex items-center gap-3 px-4 py-2 text-sm">
                    <span className="w-12 text-xs text-faint tabular-nums">{new Date(s.endedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="min-w-0 flex-1 truncate">{(s.taskId && taskTitle.get(s.taskId)) || <span className="text-muted">Sans tâche</span>}</span>
                    <span className="text-xs text-muted">{s.minutes} min</span>
                    <IconButton label="Supprimer cette session" icon={<Trash2 size={13} />} className="sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100" onClick={() => run(() => deleteFocusSession(s.id), 'Session supprimée')} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Modal open={editingSettings} onClose={() => setEditingSettings(false)} title="Durées" width="max-w-md">
        {editingSettings && (
          <SettingsForm
            initial={settings}
            running={state.status !== 'idle'}
            onSave={(s) => {
              updateSettings(s);
              setEditingSettings(false);
            }}
            onCancel={() => setEditingSettings(false)}
          />
        )}
      </Modal>
    </>
  );
}

function SettingsForm({ initial, running, onSave, onCancel }: { initial: PomodoroSettings; running: boolean; onSave: (s: PomodoroSettings) => void; onCancel: () => void }) {
  const [values, setValues] = useState(initial);
  const set = (key: keyof PomodoroSettings) => (e: ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [key]: Number(e.target.value) }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave(values);
  };
  const fields: { key: keyof PomodoroSettings; label: string; min: number; max: number }[] = [
    { key: 'focusMinutes', label: 'Focus (min)', min: 1, max: 180 },
    { key: 'shortMinutes', label: 'Pause courte (min)', min: 1, max: 60 },
    { key: 'longMinutes', label: 'Pause longue (min)', min: 1, max: 120 },
    { key: 'longEvery', label: 'Pause longue toutes les … sessions', min: 2, max: 12 },
  ];
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f) => (
          <Field key={f.key} label={f.label}>
            {(id) => <Input id={id} type="number" min={f.min} max={f.max} step={1} required value={values[f.key]} onChange={set(f.key)} />}
          </Field>
        ))}
      </div>
      {running && <p className="text-xs text-muted">La phase en cours garde sa durée ; les nouvelles valeurs s’appliqueront à la suivante.</p>}
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>Annuler</Button>
        <Button type="submit" variant="primary">
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
