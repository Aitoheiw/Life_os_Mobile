import { useState } from 'react';
import { Check } from 'lucide-react';
import type { Habit } from '../../models';
import { toggleHabitLog } from '../../db/habits';
import { useFeedback } from '../../app/feedback';
import { cx } from '../ui';

/**
 * Bouton de validation du jour, partagé avec le dashboard.
 * `xpGain` (facultatif) : XP affichée en petit "+N XP" qui s'envole quand on coche.
 */
export function HabitCheck({ habit, day, done, disabled, xpGain }: { habit: Habit; day: string; done: boolean; disabled?: boolean; xpGain?: number }) {
  const { run } = useFeedback();
  // Incrémenté à chaque validation : sert de clé pour rejouer les animations.
  const [burst, setBurst] = useState(0);

  const toggle = async () => {
    const ok = await run(() => toggleHabitLog(habit.id, day));
    if (ok && !done) setBurst((b) => b + 1);
  };

  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        disabled={disabled}
        aria-label={done ? `Annuler la validation de « ${habit.name} »` : `Valider « ${habit.name} » aujourd’hui`}
        onClick={toggle}
        className={cx(
          'flex h-7 w-7 items-center justify-center rounded-lg border transition-all duration-300 ease-smooth active:scale-90 disabled:opacity-40',
          done ? 'border-success bg-success text-surface' : 'border-faint hover:border-accent hover:bg-accent-soft',
        )}
      >
        {done && (
          <span key={burst} className={burst > 0 ? 'animate-pop' : undefined}>
            <Check size={15} strokeWidth={3} />
          </span>
        )}
      </button>
      {burst > 0 && !!xpGain && (
        <span key={burst} aria-hidden className="animate-float-up pointer-events-none absolute -top-2 left-1/2 text-xs font-semibold whitespace-nowrap text-accent">
          +{xpGain} XP
        </span>
      )}
    </span>
  );
}
