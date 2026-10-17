import type { Recurrence } from '../models';
import { addDays, addMonths, weekday, type LocalDate } from './dates';

/**
 * Calcule la prochaine échéance d'une tâche récurrente.
 *
 * `from` est l'échéance de l'occurrence terminée. Si la tâche est terminée en
 * retard, on ne crée pas une occurrence déjà dépassée : la prochaine échéance
 * est la première date valide strictement après `max(from, completedOn)`.
 * Exemple : "sortir les poubelles" chaque lundi, cochée un mercredi → lundi suivant.
 */
export function nextOccurrence(rule: Recurrence, from: LocalDate, completedOn: LocalDate): LocalDate {
  const base = completedOn > from ? completedOn : from;

  switch (rule.type) {
    case 'daily': {
      const interval = Math.max(1, Math.floor(rule.interval));
      let next = addDays(from, interval);
      while (next <= base) next = addDays(next, interval);
      return next;
    }
    case 'weekly': {
      const days = rule.days.length > 0 ? rule.days : [weekday(from)];
      let next = addDays(base, 1);
      // 7 jours suffisent toujours pour trouver un jour de la liste.
      for (let i = 0; i < 7 && !days.includes(weekday(next)); i++) next = addDays(next, 1);
      return next;
    }
    case 'monthly': {
      let months = 1;
      let next = addMonths(from, months, rule.dayOfMonth);
      while (next <= base) next = addMonths(from, ++months, rule.dayOfMonth);
      return next;
    }
  }
}

export function describeRecurrence(rule: Recurrence): string {
  switch (rule.type) {
    case 'daily':
      return rule.interval <= 1 ? 'Tous les jours' : `Tous les ${rule.interval} jours`;
    case 'weekly': {
      const names = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
      const ordered = [1, 2, 3, 4, 5, 6, 0].filter((d) => rule.days.includes(d));
      return `Chaque ${ordered.map((d) => names[d]).join(', ')}`;
    }
    case 'monthly':
      return `Le ${rule.dayOfMonth} de chaque mois`;
  }
}
