import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { CalendarCheck, CheckSquare, FolderKanban, Inbox, Lightbulb, Menu, NotebookPen, Plus, Repeat, Settings, Target, X } from 'lucide-react';
import { useEditors } from './editors';
import { useInboxCount } from '../hooks/useData';
import { cx } from '../components/ui';

const NAV: { to: string; label: string; icon: ReactNode; end?: boolean }[] = [
  { to: '/', label: 'Aujourd’hui', icon: <CalendarCheck size={17} />, end: true },
  { to: '/inbox', label: 'Boîte de réception', icon: <Inbox size={17} /> },
  { to: '/tasks', label: 'Tâches', icon: <CheckSquare size={17} /> },
  { to: '/projects', label: 'Projets', icon: <FolderKanban size={17} /> },
  { to: '/goals', label: 'Objectifs', icon: <Target size={17} /> },
  { to: '/habits', label: 'Habitudes', icon: <Repeat size={17} /> },
  { to: '/notes', label: 'Notes', icon: <NotebookPen size={17} /> },
  { to: '/review', label: 'Bilan de la semaine', icon: <Lightbulb size={17} /> },
];

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const [lastPath, setLastPath] = useState(location.pathname);
  // Ferme le menu mobile à chaque changement de page.
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setMobileOpen(false);
  }

  return (
    <div className="flex h-full">
      {/* Barre supérieure (mobile uniquement) */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-12 items-center justify-between border-b border-line bg-bg/95 px-3 backdrop-blur md:hidden">
        <button type="button" aria-label="Ouvrir le menu" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-muted hover:text-fg">
          <Menu size={18} />
        </button>
        <span className="text-sm font-semibold">Life OS</span>
        <QuickButtons compact />
      </div>

      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} aria-hidden />}

      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-line bg-surface transition-transform md:static md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden /> Life OS
          </span>
          <button type="button" aria-label="Fermer le menu" onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 text-muted hover:text-fg md:hidden">
            <X size={16} />
          </button>
        </div>

        <div className="px-3 pb-3">
          <QuickButtons />
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Navigation principale">
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        <div className="border-t border-line p-3">
          <NavItem to="/settings" label="Sauvegarde et réglages" icon={<Settings size={17} />} />
          <p className="mt-2 px-3 text-[11px] leading-relaxed text-faint">
            Raccourcis : <kbd className="font-mono">t</kbd> nouvelle tâche · <kbd className="font-mono">c</kbd> capturer une idée
          </p>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto pt-12 md:pt-0">
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function NavItem({ to, label, icon, end }: { to: string; label: string; icon: ReactNode; end?: boolean }) {
  const inbox = useInboxCount();
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors', isActive ? 'bg-surface-2 font-medium text-fg' : 'text-muted hover:bg-surface-2/60 hover:text-fg')
      }
    >
      {icon}
      <span className="flex-1">{label}</span>
      {to === '/inbox' && !!inbox && <span className="rounded-md bg-accent-soft px-1.5 text-xs font-medium text-accent">{inbox}</span>}
    </NavLink>
  );
}

function QuickButtons({ compact = false }: { compact?: boolean }) {
  const { newTask, capture } = useEditors();
  if (compact) {
    return (
      <div className="flex gap-1">
        <button type="button" aria-label="Capturer une idée" onClick={capture} className="rounded-lg p-2 text-muted hover:text-fg">
          <Inbox size={18} />
        </button>
        <button type="button" aria-label="Nouvelle tâche" onClick={() => newTask()} className="rounded-lg p-2 text-accent">
          <Plus size={18} />
        </button>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => newTask()} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent text-sm font-medium text-accent-fg hover:opacity-90">
        <Plus size={16} /> Tâche
      </button>
      <button type="button" onClick={capture} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-surface-2 text-sm font-medium text-fg hover:bg-line">
        <Inbox size={15} /> Idée
      </button>
    </div>
  );
}
