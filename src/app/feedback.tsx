import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { ValidationError } from '../validation/schemas';
import { cx } from '../components/ui';

interface Toast {
  id: number;
  kind: 'success' | 'error';
  message: string;
}

interface Feedback {
  notify: (message: string, kind?: Toast['kind']) => void;
  /** Exécute une action et affiche l'erreur de façon lisible si elle échoue. Retourne true si succès. */
  run: (action: () => Promise<unknown>, successMessage?: string) => Promise<boolean>;
}

const FeedbackContext = createContext<Feedback | null>(null);

/** Message compréhensible pour l'utilisateur, quelle que soit l'erreur. */
export function errorMessage(err: unknown): string {
  if (err instanceof ValidationError) return err.message;
  if (err instanceof Error && err.name === 'QuotaExceededError') return 'Espace de stockage du navigateur plein.';
  console.error(err);
  return 'Une erreur inattendue est survenue. Tes données n’ont pas été modifiées.';
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  const notify = useCallback((message: string, kind: Toast['kind'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, kind, message }]);
    window.setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 2500);
  }, []);

  const run = useCallback(
    async (action: () => Promise<unknown>, successMessage?: string) => {
      try {
        await action();
        if (successMessage) notify(successMessage);
        return true;
      } catch (err) {
        notify(errorMessage(err), 'error');
        return false;
      }
    },
    [notify],
  );

  return (
    <FeedbackContext.Provider value={{ notify, run }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto flex max-w-sm items-start gap-2 rounded-lg border bg-surface px-3 py-2.5 text-sm shadow-lg',
              t.kind === 'error' ? 'border-danger/40 text-danger' : 'border-line text-fg',
            )}
          >
            {t.kind === 'error' ? <AlertCircle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" />}
            <span className="flex-1">{t.message}</span>
            <button type="button" aria-label="Fermer" onClick={() => dismiss(t.id)} className="text-faint hover:text-fg">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): Feedback {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback doit être utilisé dans <FeedbackProvider>.');
  return ctx;
}
