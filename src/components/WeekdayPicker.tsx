import { WEEKDAY_ORDER, WEEKDAY_SHORT } from '../domain/dates';
import { cx } from './ui';

/** Sélection de jours de la semaine (0 = dimanche … 6 = samedi), affichés du lundi au dimanche. */
export function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (days: number[]) => void }) {
  const toggle = (d: number) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d]);
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Jours de la semaine">
      {WEEKDAY_ORDER.map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={value.includes(d)}
          onClick={() => toggle(d)}
          className={cx(
            'h-8 w-11 rounded-lg text-xs font-medium capitalize transition-colors',
            value.includes(d) ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-muted hover:text-fg',
          )}
        >
          {WEEKDAY_SHORT[d]}
        </button>
      ))}
    </div>
  );
}
