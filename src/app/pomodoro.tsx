import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import * as P from '../domain/pomodoro';
import { recordFocusSession } from '../db/focus';
import { errorMessage, useFeedback } from './feedback';

/**
 * Minuteur Pomodoro global : il continue quand on change de page.
 * Son état est sauvegardé dans le navigateur (localStorage) : un rechargement
 * ou un autre onglet retrouve le minuteur là où il en était.
 */
interface Pomodoro {
  state: P.TimerState;
  settings: P.PomodoroSettings;
  remaining: number;
  start: () => void;
  pause: () => void;
  reset: () => void;
  switchPhase: (phase: P.Phase) => void;
  setTask: (taskId: string | null) => void;
  updateSettings: (s: P.PomodoroSettings) => void;
}

const PomodoroContext = createContext<Pomodoro | null>(null);

const TIMER_KEY = 'life-os-pomodoro-timer';
const SETTINGS_KEY = 'life-os-pomodoro-settings';

function load<T>(key: string, parse: (raw: unknown) => T, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? parse(JSON.parse(raw)) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Stockage indisponible : le minuteur fonctionne quand même pour cette session.
  }
}

/** Vérifie grossièrement un état relu du stockage ; en cas de doute, on repart de zéro. */
function parseTimer(raw: unknown, settings: P.PomodoroSettings): P.TimerState {
  const r = raw as Partial<P.TimerState> | null;
  const valid =
    r &&
    ['focus', 'short', 'long'].includes(r.phase as string) &&
    ['idle', 'running', 'paused'].includes(r.status as string) &&
    typeof r.remainingMs === 'number' &&
    (r.status !== 'running' || typeof r.endsAt === 'number');
  return valid ? { ...P.initialState(settings), ...r } : P.initialState(settings);
}

/** Petit carillon généré (aucun fichier audio, fonctionne hors ligne). */
function chime(ctx: AudioContext | null): void {
  if (!ctx) return;
  const now = ctx.currentTime;
  [660, 880].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + i * 0.25);
    gain.gain.exponentialRampToValueAtTime(0.2, now + i * 0.25 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.25 + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + i * 0.25);
    osc.stop(now + i * 0.25 + 0.65);
  });
}

export function PomodoroProvider({ children }: { children: ReactNode }) {
  const { notify } = useFeedback();
  const [settings, setSettings] = useState(() => load(SETTINGS_KEY, P.sanitizeSettings, P.DEFAULT_SETTINGS));
  const [state, setState] = useState(() => load(TIMER_KEY, (r) => parseTimer(r, settings), P.initialState(settings)));
  const [now, setNow] = useState(() => Date.now());
  const audio = useRef<AudioContext | null>(null);

  // Mise à jour d'état + sauvegarde (pour le rechargement et les autres onglets).
  const commit = useCallback((next: P.TimerState) => {
    setState(next);
    save(TIMER_KEY, next);
  }, []);

  // Horloge : rafraîchit l'affichage seulement quand le minuteur tourne.
  useEffect(() => {
    if (state.status !== 'running') return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [state.status]);

  // Fin de phase (y compris si elle s'est terminée pendant que la page était fermée).
  useEffect(() => {
    const result = P.complete(state, Date.now(), settings);
    if (!result) return;
    commit(result.next);
    chime(audio.current);
    if (result.finished.phase === 'focus') {
      recordFocusSession(result.finished, state.taskId)
        .then(() => notify(`Session de focus terminée (${result.finished.minutes} min). Fais une pause.`))
        .catch((err) => notify(errorMessage(err), 'error'));
    } else {
      notify('Pause terminée. Prêt pour la suite ?');
    }
  }, [now, state, settings, commit, notify]);

  // Synchronisation entre onglets.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === TIMER_KEY && e.newValue) setState(parseTimer(JSON.parse(e.newValue), settings));
      if (e.key === SETTINGS_KEY && e.newValue) setSettings(P.sanitizeSettings(JSON.parse(e.newValue)));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [settings]);

  const remaining = P.remainingMs(state, now);

  // Temps restant dans le titre de l'onglet.
  useEffect(() => {
    document.title = state.status === 'idle' ? 'Life OS' : `${P.formatClock(remaining)} · ${P.PHASE_LABELS[state.phase]} — Life OS`;
  }, [remaining, state.status, state.phase]);

  const value: Pomodoro = {
    state,
    settings,
    remaining,
    start: () => {
      // Le navigateur n'autorise le son qu'après un clic : on prépare l'audio ici.
      try {
        audio.current ??= new AudioContext();
        void audio.current.resume();
      } catch {
        audio.current = null;
      }
      const t = Date.now();
      setNow(t);
      commit(P.start(state, t));
    },
    pause: () => commit(P.pause(state, Date.now())),
    reset: () => commit(P.reset(state, settings)),
    switchPhase: (phase) => commit(P.switchPhase(state, phase, settings)),
    setTask: (taskId) => commit({ ...state, taskId }),
    updateSettings: (s) => {
      const clean = P.sanitizeSettings(s);
      setSettings(clean);
      save(SETTINGS_KEY, clean);
      // Une phase non démarrée prend immédiatement la nouvelle durée.
      if (state.status === 'idle') commit(P.switchPhase(state, state.phase, clean));
    },
  };

  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>;
}

export function usePomodoro(): Pomodoro {
  const ctx = useContext(PomodoroContext);
  if (!ctx) throw new Error('usePomodoro doit être utilisé dans <PomodoroProvider>.');
  return ctx;
}
