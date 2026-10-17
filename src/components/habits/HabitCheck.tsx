import { Check } from 'lucide-react';
import type { Habit } from '../../models';
import { toggleHabitLog } from '../../db/habits';
import { useFeedback } from '../../app/feedback';
import { cx } from '../ui';

/** Bouton de validation du jour, partagé avec le dashboard. */
export function HabitCheck({ habit, day, done, disabled }: { habit: Habit; day: string; done: boolean; disabled?: boolean }) {
  const { run } = useFeedback();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      disabled={disabled}
      aria-label={done ? `Annuler la validation de « ${habit.name} »` : `Valider « ${habit.name} » aujourd’hui`}
      onClick={() => run(() => toggleHabitLog(habit.id, day))}
      className={cx(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:opacity-40',
        done ? 'border-success bg-success text-bg' : 'border-faint hover:border-accent',
      )}
    >
      {done && <Check size={15} strokeWidth={3} />}
    </button>
  );
}
