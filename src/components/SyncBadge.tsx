import { Link } from 'react-router';
import { Cloud, CloudOff, RefreshCw, TriangleAlert } from 'lucide-react';
import { useSync } from '../sync/sync';
import { cx } from './ui';

/** Petit indicateur de synchronisation (icône seule en mode compact). Mène aux réglages. */
export function SyncBadge({ compact = false }: { compact?: boolean }) {
  const sync = useSync();
  if (sync.status === 'disabled') return null;

  const view = {
    signedOut: { icon: <CloudOff size={15} />, label: 'Non connecté', tone: 'text-faint' },
    offline: { icon: <CloudOff size={15} />, label: sync.pending ? `Hors ligne · ${sync.pending} en attente` : 'Hors ligne', tone: 'text-warning' },
    error: { icon: <TriangleAlert size={15} />, label: 'Erreur de synchro', tone: 'text-danger' },
    syncing: { icon: <RefreshCw size={15} className="animate-spin" />, label: 'Synchronisation…', tone: 'text-muted' },
    idle: { icon: <Cloud size={15} />, label: sync.pending ? `${sync.pending} en attente` : 'Synchronisé', tone: 'text-success' },
  }[sync.status];

  return (
    <Link to="/settings" title={view.label} aria-label={view.label} className={cx('inline-flex items-center gap-1.5 rounded-lg text-xs transition-colors', compact ? 'h-9 w-9 justify-center' : 'px-1', view.tone)}>
      {view.icon}
      {!compact && <span>{view.label}</span>}
    </Link>
  );
}
