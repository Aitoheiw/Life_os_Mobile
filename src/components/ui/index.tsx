import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { X } from 'lucide-react';

/** Concatène des classes CSS en ignorant les valeurs vides. */
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---------- Boutons ----------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg shadow-sm hover:brightness-110',
  secondary: 'bg-surface-2 text-fg hover:bg-line',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2',
  danger: 'bg-danger/15 text-danger hover:bg-danger/25',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  icon?: ReactNode;
}

export function Button({ variant = 'secondary', size = 'md', icon, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 ease-smooth active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' ? 'h-8 px-2.5 text-sm' : 'h-9 px-3.5 text-sm',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

/** Bouton icône seule : `label` est obligatoire pour l'accessibilité. */
export function IconButton({ label, icon, className, ...rest }: { label: string; icon: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-all duration-200 ease-smooth hover:bg-surface-2 hover:text-fg active:scale-90', className)}
      {...rest}
    >
      {icon}
    </button>
  );
}

// ---------- Champs de formulaire ----------

// Sur mobile, texte à 16 px : en dessous, Safari iOS zoome automatiquement sur le champ.
const fieldClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-base text-fg sm:text-sm transition-[border-color,box-shadow] duration-200 placeholder:text-faint focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(fieldClass, 'h-9', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(fieldClass, 'min-h-24 resize-y leading-relaxed', className)} {...rest} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(fieldClass, 'h-9 py-0', className)} {...rest}>
      {children}
    </select>
  );
}

/** Libellé + champ + message d'aide/erreur. */
export function Field({ label, hint, children, className }: { label: string; hint?: string; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-faint">{hint}</p>}
    </div>
  );
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}

// ---------- Fenêtre modale (élément <dialog> natif : Échap et focus gérés par le navigateur) ----------

export function Modal({ open, onClose, title, children, width = 'max-w-lg' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // showModal() place le focus sur le 1er élément focusable (le bouton Fermer) :
      // on le redonne au premier champ de saisie, s'il y en a un.
      d.querySelector<HTMLElement>('input:not([type=hidden]):not([type=file]), textarea, select')?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onMouseDown={(e) => e.target === ref.current && onClose()}
      // Sur téléphone : panneau qui monte du bas, pleine largeur (plus facile à atteindre au pouce).
      className={cx(
        'm-auto w-[calc(100%-2rem)] rounded-2xl border border-line bg-surface p-0 text-fg shadow-2xl max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-[env(safe-area-inset-bottom)]',
        width,
      )}
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="font-serif text-lg font-medium">{title}</h2>
            <IconButton label="Fermer" icon={<X size={16} />} onClick={onClose} />
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}

/** Confirmation explicite avant une action destructrice. */
export function ConfirmDialog({ open, title, message, confirmLabel = 'Supprimer', onConfirm, onCancel }: { open: boolean; title: string; message: ReactNode; confirmLabel?: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal open={open} onClose={onCancel} title={title} width="max-w-md">
      <div className="space-y-5 text-sm text-muted">
        <div>{message}</div>
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel}>Annuler</Button>
          <Button variant="danger" onClick={onConfirm} autoFocus>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- Affichage ----------

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('rounded-2xl border border-line bg-surface shadow-soft', className)}>{children}</section>;
}

export function CardHeader({ title, action, icon }: { title: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
        {icon && <span className="text-muted">{icon}</span>}
        {title}
      </h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-normal text-fg">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      {icon && <div className="mb-1 text-faint">{icon}</div>}
      <p className="text-sm font-medium text-fg">{title}</p>
      {children && <p className="max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' }) {
  const tones = {
    neutral: 'bg-surface-2 text-muted',
    accent: 'bg-accent-soft text-accent',
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    danger: 'bg-danger/15 text-danger',
  };
  return <span className={cx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap', tones[tone])}>{children}</span>;
}

/** Barre de progression. `ratio` null → aucune barre (pas de pourcentage inventé). */
export function ProgressBar({ ratio, className }: { ratio: number | null; className?: string }) {
  if (ratio === null) return null;
  const pct = Math.round(ratio * 100);
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-surface-2', className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-accent transition-[width] duration-700 ease-smooth" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Onglets simples. */
export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number }[] }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto rounded-lg bg-surface-2 p-1 [scrollbar-width:none]">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          type="button"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cx(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-all duration-200 ease-smooth',
            value === it.value ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
          )}
        >
          {it.label}
          {it.count !== undefined && <span className="text-xs text-faint">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}
