import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Task } from '../models';
import { captureIdea } from '../db/notes';
import { Button, ErrorMessage, Modal, Textarea } from '../components/ui';
import { TaskForm, type TaskDefaults } from '../components/tasks/TaskForm';
import { errorMessage, useFeedback } from './feedback';

/**
 * Fenêtres d'édition accessibles depuis n'importe quelle page :
 * nouvelle tâche, modification d'une tâche, capture rapide d'une idée.
 * Raccourcis clavier globaux : `t` = nouvelle tâche, `c` = capturer une idée.
 */
interface Editors {
  newTask: (defaults?: TaskDefaults) => void;
  editTask: (task: Task) => void;
  capture: () => void;
}

const EditorsContext = createContext<Editors | null>(null);

type State = { kind: 'none' } | { kind: 'task'; task?: Task; defaults?: TaskDefaults } | { kind: 'capture' };

/** Vrai si l'utilisateur est en train de taper dans un champ (on ignore alors les raccourcis). */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

export function EditorsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ kind: 'none' });
  const close = useCallback(() => setState({ kind: 'none' }), []);

  const editors: Editors = {
    newTask: useCallback((defaults?: TaskDefaults) => setState({ kind: 'task', defaults }), []),
    editTask: useCallback((task: Task) => setState({ kind: 'task', task }), []),
    capture: useCallback(() => setState({ kind: 'capture' }), []),
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || document.querySelector('dialog[open]')) return;
      if (e.key === 'c') {
        e.preventDefault();
        setState({ kind: 'capture' });
      } else if (e.key === 't') {
        e.preventDefault();
        setState({ kind: 'task' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <EditorsContext.Provider value={editors}>
      {children}
      <Modal open={state.kind === 'task'} onClose={close} title={state.kind === 'task' && state.task ? 'Modifier la tâche' : 'Nouvelle tâche'}>
        {state.kind === 'task' && <TaskForm key={state.task?.id ?? 'new'} task={state.task} defaults={state.defaults} onDone={close} />}
      </Modal>
      <Modal open={state.kind === 'capture'} onClose={close} title="Capturer une idée" width="max-w-md">
        {state.kind === 'capture' && <QuickCapture onDone={close} />}
      </Modal>
    </EditorsContext.Provider>
  );
}

/** Capture en une étape : taper, puis Entrée. Maj+Entrée pour aller à la ligne. */
function QuickCapture({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const { notify } = useFeedback();
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    try {
      await captureIdea(text);
      notify('Idée ajoutée à la boîte de réception');
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Textarea
        ref={ref}
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
        }}
        placeholder="Une idée, un truc à ne pas oublier…"
        rows={3}
        aria-label="Texte de l'idée"
      />
      <ErrorMessage>{error}</ErrorMessage>
      <div className="flex items-center justify-between">
        <span className="text-xs text-faint">Entrée pour enregistrer · Maj+Entrée pour une nouvelle ligne</span>
        <Button type="submit" variant="primary" disabled={!text.trim()}>
          Capturer
        </Button>
      </div>
    </form>
  );
}

export function useEditors(): Editors {
  const ctx = useContext(EditorsContext);
  if (!ctx) throw new Error('useEditors doit être utilisé dans <EditorsProvider>.');
  return ctx;
}
