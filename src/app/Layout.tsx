import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { CalendarCheck, CheckSquare, FolderKanban, Inbox, LayoutGrid, Lightbulb, Moon, NotebookPen, Plus, Repeat, Settings, Sun, Target, Timer } from 'lucide-react';
import { useEditors } from './editors';
import { useInboxCount } from '../hooks/useData';
import { usePomodoro } from './pomodoro';
import { formatClock } from '../domain/pomodoro';
import { cx } from '../components/ui';
import { SyncBadge } from '../components/SyncBadge';
import { useTheme } from './theme';

interface NavEntry {
  to: string;
  label: string;
  /** Libellé court pour la barre d'onglets / le menu mobile. */
  short?: string;
  icon: (size: number) => ReactNode;
  end?: boolean;
}

const NAV: NavEntry[] = [
  { to: '/', label: 'Aujourd’hui', icon: (s) => <CalendarCheck size={s} />, end: true },
  { to: '/inbox', label: 'Boîte de réception', short: 'Idées', icon: (s) => <Inbox size={s} /> },
  { to: '/tasks', label: 'Tâches', icon: (s) => <CheckSquare size={s} /> },
  { to: '/projects', label: 'Projets', icon: (s) => <FolderKanban size={s} /> },
  { to: '/goals', label: 'Objectifs', icon: (s) => <Target size={s} /> },
  { to: '/habits', label: 'Habitudes', icon: (s) => <Repeat size={s} /> },
  { to: '/notes', label: 'Notes', icon: (s) => <NotebookPen size={s} /> },
  { to: '/focus', label: 'Focus', icon: (s) => <Timer size={s} /> },
  { to: '/review', label: 'Bilan de la semaine', short: 'Bilan', icon: (s) => <Lightbulb size={s} /> },
];
const SETTINGS: NavEntry = { to: '/settings', label: 'Réglages et sauvegarde', short: 'Réglages', icon: (s) => <Settings size={s} /> };

/** Onglets toujours visibles sur téléphone ; le reste est dans « Plus ». */
const TAB_PATHS = ['/', '/tasks', '/habits'];
const byPath = (to: string) => NAV.find((n) => n.to === to)!;
/** Vrai si `path` appartient à la section `to` (ex. /projects/42 → /projects). */
const inSection = (path: string, to: string) => (to === '/' ? path === '/' : path === to || path.startsWith(to + '/'));
/** Position d'une page dans le menu : sert à savoir si l'on « avance » ou « recule ». */
const pageIndex = (path: string) => [...NAV, SETTINGS].findIndex((n) => inSection(path, n.to));

export function Layout() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const [lastPath, setLastPath] = useState(location.pathname);
  // Sens de la transition : 1 = la page arrive par la droite, -1 = par la gauche.
  const [direction, setDirection] = useState(1);
  // Ferme le menu « Plus » à chaque changement de page.
  if (lastPath !== location.pathname) {
    setDirection(pageIndex(location.pathname) >= pageIndex(lastPath) ? 1 : -1);
    setLastPath(location.pathname);
    setMoreOpen(false);
  }

  // Nouvelle page : on repart du haut.
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="flex h-full">
      {/* ---------- Ordinateur : barre latérale ---------- */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface/60 md:flex">
        <div className="flex h-14 items-center justify-between px-4">
          <Brand />
          <ThemeToggle />
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
          <div className="mb-1 px-3">
            <SyncBadge />
          </div>
          <NavItem {...SETTINGS} />
          <p className="mt-2 px-3 text-[11px] leading-relaxed text-faint">
            Raccourcis : <kbd className="font-mono">t</kbd> nouvelle tâche · <kbd className="font-mono">c</kbd> capturer une idée
          </p>
        </div>
      </aside>

      {/* ---------- Téléphone : barre du haut ---------- */}
      <header className="fixed inset-x-0 top-0 z-30 border-b border-line/70 bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl md:hidden">
        <div className="flex h-12 items-center justify-between pr-1.5 pl-4">
          <Brand />
          <div className="flex items-center">
            <PomodoroChip />
            <SyncBadge compact />
            <ThemeToggle large />
            <CaptureButton />
          </div>
        </div>
      </header>

      <main ref={mainRef} className="min-w-0 flex-1 overflow-y-auto overscroll-contain pt-[calc(3rem+env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))] md:pt-0 md:pb-0">
        {/* La clé change à chaque page : le contenu rejoue son animation d'entrée (voir `.page-enter` dans index.css). */}
        <div key={location.pathname} className="page-enter mx-auto max-w-5xl px-4 py-5 md:px-8 md:py-10" style={{ '--dir': direction } as CSSProperties}>
          <Outlet />
        </div>
      </main>

      {/* ---------- Téléphone : onglets du bas ---------- */}
      <TabBar moreOpen={moreOpen} onMore={() => setMoreOpen((o) => !o)} />
      {moreOpen && <MoreSheet onClose={() => setMoreOpen(false)} />}
    </div>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2 font-serif text-lg">
      <img src="/icon.svg" alt="" className="h-6 w-6 rounded-md" aria-hidden /> Life OS
    </Link>
  );
}

function NavItem({ to, label, icon, end }: NavEntry) {
  const inbox = useInboxCount();
  const pomodoro = usePomodoro();
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cx('group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200 ease-smooth', isActive ? 'bg-surface-2 font-medium text-fg' : 'text-muted hover:bg-surface-2/60 hover:text-fg')
      }
    >
      <span className="transition-transform duration-200 ease-smooth group-hover:scale-110">{icon(17)}</span>
      <span className="flex-1">{label}</span>
      {to === '/inbox' && !!inbox && <span className="rounded-md bg-accent-soft px-1.5 text-xs font-medium text-accent">{inbox}</span>}
      {to === '/focus' && pomodoro.state.status !== 'idle' && (
        <span className={cx('font-mono text-xs tabular-nums', pomodoro.state.status === 'running' ? (pomodoro.state.phase === 'focus' ? 'text-accent' : 'text-success') : 'text-faint')}>
          {formatClock(pomodoro.remaining)}
        </span>
      )}
    </NavLink>
  );
}

// ---------- Téléphone ----------

/**
 * Barre d'onglets du téléphone. Une « encoche » creusée dans la barre et une pastille
 * terre cuite glissent jusqu'à l'onglet actif. Seul `transform` est animé → fluide.
 * Colonnes : 0 Aujourd'hui · 1 Tâches · 2 Ajouter · 3 Habitudes · 4 Plus.
 */
function TabBar({ moreOpen, onMore }: { moreOpen: boolean; onMore: () => void }) {
  const { newTask } = useEditors();
  const inbox = useInboxCount();
  const { pathname } = useLocation();
  const [today, tasks, habits] = TAB_PATHS.map(byPath) as [NavEntry, NavEntry, NavEntry];

  // Colonne de l'indicateur : l'onglet de la page, sinon « Plus » (menu ouvert ou autre page).
  const tabIndex = [today, tasks, null, habits].findIndex((t) => t !== null && inSection(pathname, t.to));
  const column = moreOpen || tabIndex < 0 ? 4 : tabIndex;
  // Icône dans la pastille : celle de la page en cours (ou la grille si le menu est ouvert).
  const current = [...NAV, SETTINGS].find((n) => inSection(pathname, n.to));
  const bubbleKey = moreOpen || !current ? 'more' : current.to;

  return (
    <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] [clip-path:inset(-48px_0_0_0)] md:hidden">
      <div className="relative mx-auto grid h-16 max-w-md grid-cols-5 items-center px-1">
        {/* Indicateur : large d'une colonne, déplacé de colonne en colonne. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-1 w-[calc((100%-0.5rem)/5)] transition-transform duration-500 ease-spring will-change-transform"
          style={{ transform: `translateX(${column * 100}%)` }}
        >
          <NotchBackground />
          <div className="absolute top-1 left-1/2 grid h-[52px] w-[52px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent text-accent-fg shadow-lg shadow-accent/35">
            <span key={bubbleKey} className="animate-bubble grid place-items-center">
              {bubbleKey === 'more' ? <LayoutGrid size={22} strokeWidth={2.2} /> : current!.icon(22)}
            </span>
          </div>
        </div>

        <Tab {...today} covered={column === 0} />
        <Tab {...tasks} covered={column === 1} />
        <button type="button" aria-label="Nouvelle tâche" onClick={() => newTask()} className="relative flex flex-col items-center gap-1 py-1 text-[11px] text-muted transition-transform duration-200 ease-smooth active:scale-90">
          <span className="grid h-[22px] w-[22px] place-items-center rounded-md bg-accent-soft text-accent">
            <Plus size={17} strokeWidth={2.6} />
          </span>
          Ajouter
        </button>
        <Tab {...habits} covered={column === 3} />
        <button type="button" onClick={onMore} aria-expanded={moreOpen} className={cx('relative flex flex-col items-center gap-1 py-1 text-[11px] transition-colors duration-300', column === 4 ? 'font-medium text-accent' : 'text-muted')}>
          <TabIcon hidden={column === 4}>
            <LayoutGrid size={22} strokeWidth={1.8} />
          </TabIcon>
          Plus
          {!!inbox && <span className="absolute top-0 right-[calc(50%-18px)] h-2 w-2 rounded-full bg-accent ring-2 ring-surface" aria-label={`${inbox} idée(s) à traiter`} />}
        </button>
      </div>
    </nav>
  );
}

/**
 * Fond de la barre avec l'encoche. Très large (3000 px) et centré sur l'indicateur :
 * en le déplaçant, l'encoche suit l'onglet actif sans jamais redessiner la barre.
 */
function NotchBackground() {
  // Creux arrondi de 100 px de large et 36 px de profondeur, centré en x = 1500.
  const notch = (y: number) => `H1450 C1466,${y} 1464,36 1500,36 C1536,36 1534,${y} 1550,${y}`;
  return (
    <svg className="absolute top-0 left-1/2 -ml-[1500px] h-[200px] w-[3000px] max-w-none" viewBox="0 0 3000 200">
      <path d={`M0,0 ${notch(0)} H3000 V200 H0 Z`} className="fill-surface" />
      {/* Fin trait de séparation qui suit le bord de l'encoche. */}
      <path d={`M0,0.5 ${notch(0.5)} H3000`} className="fill-none stroke-line" />
    </svg>
  );
}

/** Icône d'onglet : s'efface vers le bas quand la pastille vient se poser dessus. */
function TabIcon({ hidden, children }: { hidden: boolean; children: ReactNode }) {
  return <span className={cx('transition-all duration-300 ease-smooth', hidden ? 'translate-y-3 scale-50 opacity-0' : 'opacity-100')}>{children}</span>;
}

/** `covered` : la pastille est posée sur cet onglet (faux quand le menu « Plus » est ouvert). */
function Tab({ to, label, short, icon, end, covered }: NavEntry & { covered: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => cx('relative flex flex-col items-center gap-1 py-1 text-[11px] transition-colors duration-300', isActive ? 'font-medium text-accent' : 'text-muted')}>
      <TabIcon hidden={covered}>{icon(22)}</TabIcon>
      {short ?? label}
    </NavLink>
  );
}

/** Panneau « Plus » : toutes les autres sections sous forme de tuiles. */
function MoreSheet({ onClose }: { onClose: () => void }) {
  const inbox = useInboxCount();
  const pomodoro = usePomodoro();
  const items = [...NAV.filter((n) => !TAB_PATHS.includes(n.to)), SETTINGS];
  return (
    <>
      <div className="animate-fade fixed inset-0 z-30 bg-fg/25 backdrop-blur-[2px] md:hidden" onClick={onClose} aria-hidden />
      {/* Le panneau descend derrière la barre d'onglets : l'encoche laisse voir sa couleur, pas le voile. */}
      <div className="animate-sheet fixed inset-x-0 bottom-0 z-30 rounded-t-3xl border-t border-line bg-surface px-4 pt-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] shadow-2xl md:hidden">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden />
        <div className="grid grid-cols-3 gap-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cx('relative flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3.5 text-xs transition-all duration-200 ease-smooth active:scale-95', isActive ? 'bg-accent-soft font-medium text-accent' : 'bg-surface-2/70 text-fg')
              }
            >
              {item.icon(22)}
              {item.short ?? item.label}
              {item.to === '/inbox' && !!inbox && <span className="absolute top-2 right-2 rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-fg">{inbox}</span>}
              {item.to === '/focus' && pomodoro.state.status !== 'idle' && <span className="absolute top-2 right-2 font-mono text-[10px] text-accent tabular-nums">{formatClock(pomodoro.remaining)}</span>}
            </NavLink>
          ))}
        </div>
      </div>
    </>
  );
}

/** Minuteur Pomodoro en cours, visible depuis n'importe quelle page. */
function PomodoroChip() {
  const pomodoro = usePomodoro();
  if (pomodoro.state.status === 'idle') return null;
  const running = pomodoro.state.status === 'running';
  return (
    <Link
      to="/focus"
      className={cx(
        'mr-1 flex h-7 items-center gap-1 rounded-full px-2.5 font-mono text-xs tabular-nums',
        running ? (pomodoro.state.phase === 'focus' ? 'bg-accent-soft text-accent' : 'bg-success/15 text-success') : 'bg-surface-2 text-muted',
      )}
    >
      <Timer size={13} />
      {formatClock(pomodoro.remaining)}
    </Link>
  );
}

function CaptureButton() {
  const { capture } = useEditors();
  return (
    <button type="button" aria-label="Capturer une idée" onClick={capture} className="grid h-9 w-9 place-items-center rounded-lg text-muted active:scale-90">
      <Lightbulb size={19} />
    </button>
  );
}

function QuickButtons() {
  const { newTask, capture } = useEditors();
  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => newTask()} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent text-sm font-medium text-accent-fg shadow-sm transition-all duration-200 ease-smooth hover:brightness-110 active:scale-[0.97]">
        <Plus size={16} /> Tâche
      </button>
      <button type="button" onClick={capture} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-surface-2 text-sm font-medium text-fg transition-all duration-200 ease-smooth hover:bg-line active:scale-[0.97]">
        <Inbox size={15} /> Idée
      </button>
    </div>
  );
}

/** Bouton clair / sombre : le soleil et la lune pivotent l'un vers l'autre. */
function ThemeToggle({ large = false }: { large?: boolean }) {
  const [theme, setTheme] = useTheme();
  const dark = theme === 'dark';
  const label = dark ? 'Passer en thème clair' : 'Passer en thème sombre';
  const size = large ? 18 : 16;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      className={cx('relative grid place-items-center overflow-hidden rounded-lg text-muted transition-all duration-200 ease-smooth hover:bg-surface-2 hover:text-fg active:scale-90', large ? 'h-9 w-9' : 'h-8 w-8')}
    >
      <Sun size={size} className={cx('absolute transition-all duration-500 ease-smooth', dark ? 'translate-y-6 rotate-90 opacity-0' : 'translate-y-0 rotate-0 opacity-100')} />
      <Moon size={size} className={cx('absolute transition-all duration-500 ease-smooth', dark ? 'translate-y-0 rotate-0 opacity-100' : '-translate-y-6 -rotate-90 opacity-0')} />
    </button>
  );
}
