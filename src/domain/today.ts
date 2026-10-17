import type { Habit, HabitLog, Task } from '../models';
import { habitsDueOn } from './habits';
import type { LocalDate } from './dates';

/**
 * Progression du jour — règle :
 *   éléments prévus = tâches dont l'échéance est aujourd'hui (même terminées)
 *                   + priorités du jour (sans doublon)
 *                   + habitudes prévues aujourd'hui ;
 *   éléments faits  = ceux qui sont terminés / validés.
 * Les tâches en retard ne sont pas comptées : elles ne doivent pas rendre
 * la journée "impossible à finir". Elles sont affichées à part.
 */
export function dailyProgress(tasks: Task[], habits: Habit[], logs: HabitLog[], day: LocalDate): { done: number; total: number } {
  const planned = tasks.filter((t) => t.dueDate === day || t.focusDate === day);
  const dueHabits = habitsDueOn(habits, day);
  const doneHabits = new Set(logs.filter((l) => l.date === day).map((l) => l.habitId));
  return {
    total: planned.length + dueHabits.length,
    done: planned.filter((t) => t.status === 'done').length + dueHabits.filter((h) => doneHabits.has(h.id)).length,
  };
}
