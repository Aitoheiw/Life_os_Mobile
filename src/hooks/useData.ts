import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { today, type LocalDate } from '../domain/dates';

/**
 * Lectures "vivantes" : les composants se mettent à jour automatiquement
 * dès que la base change (y compris depuis un autre onglet).
 * Toutes les lectures passent par ici ; les écritures passent par src/db/*.
 * `undefined` signifie "chargement en cours".
 */
export const useTasks = () => useLiveQuery(() => db.tasks.toArray(), []);
export const useProjects = () => useLiveQuery(() => db.projects.toArray(), []);
export const useGoals = () => useLiveQuery(() => db.goals.toArray(), []);
export const useHabits = () => useLiveQuery(() => db.habits.toArray(), []);
export const useHabitLogs = () => useLiveQuery(() => db.habitLogs.toArray(), []);
export const useNotes = () => useLiveQuery(() => db.notes.orderBy('updatedAt').reverse().toArray(), []);
export const useReviews = () => useLiveQuery(() => db.weeklyReviews.orderBy('weekStart').reverse().toArray(), []);
export const useFocusSessions = () => useLiveQuery(() => db.focusSessions.orderBy('date').reverse().toArray(), []);
export const useInboxCount = () => useLiveQuery(() => db.notes.where('status').equals('open').filter((n) => n.kind === 'idea').count(), []);

/**
 * Jour local courant, mis à jour automatiquement après minuit
 * (vérification chaque minute et au retour sur l'onglet).
 */
export function useToday(): LocalDate {
  const [day, setDay] = useState(today);
  useEffect(() => {
    const check = () => setDay(today());
    const timer = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return day;
}
