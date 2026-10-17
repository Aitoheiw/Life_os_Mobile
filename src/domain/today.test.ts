import { describe, expect, it } from 'vitest';
import type { Habit, Task } from '../models';
import { dailyProgress } from './today';

const task = (over: Partial<Task>): Task => ({
  id: Math.random().toString(),
  title: 't',
  description: '',
  priority: 'medium',
  status: 'todo',
  dueDate: null,
  projectId: null,
  focusDate: null,
  recurrence: null,
  seriesId: null,
  postponedCount: 0,
  completedAt: null,
  createdAt: '',
  updatedAt: '',
  ...over,
});

const habit: Habit = {
  id: 'h',
  name: 'h',
  description: '',
  frequency: { type: 'daily' },
  status: 'active',
  startDate: '2026-01-01',
  pauses: [],
  archivedAt: null,
  createdAt: '',
  updatedAt: '',
};

describe('progression du jour', () => {
  it('compte tâches du jour, priorités et habitudes prévues, sans doublon ni retard', () => {
    const day = '2026-10-17';
    const tasks = [
      task({ dueDate: day, status: 'done' }),
      task({ dueDate: day, focusDate: day }), // compté une seule fois
      task({ focusDate: day }),
      task({ dueDate: '2026-10-10' }), // en retard : pas compté
      task({ dueDate: '2026-10-18' }),
    ];
    const paused: Habit = { ...habit, id: 'p', status: 'paused' };
    const logs = [{ id: 'l', habitId: 'h', date: day, createdAt: '' }];
    expect(dailyProgress(tasks, [habit, paused], logs, day)).toEqual({ done: 2, total: 4 });
  });

  it('journée vide : 0 / 0', () => {
    expect(dailyProgress([], [], [], '2026-10-17')).toEqual({ done: 0, total: 0 });
  });
});
