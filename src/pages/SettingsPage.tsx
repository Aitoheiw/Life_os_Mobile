import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Download, HardDrive, Moon, Sun, Upload } from 'lucide-react';
import { ALL_TABLES } from '../db/database';
import { backupFileName, countDatabase, exportBackup, parseBackup, restoreBackup, TABLE_LABELS, type BackupCounts, type ParsedBackup } from '../backup/backup';
import { errorMessage, useFeedback } from '../app/feedback';
import { getStoredTheme, setTheme, type Theme } from '../app/theme';
import { Button, Card, CardHeader, ErrorMessage, Input, PageHeader, cx } from '../components/ui';

const CONFIRM_WORD = 'REMPLACER';

async function downloadBackup(): Promise<void> {
  const backup = await exportBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFileName();
  a.click();
  URL.revokeObjectURL(url);
}

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Sauvegarde et réglages" subtitle="Tes données restent sur cet ordinateur, dans ce navigateur. Exporte-les régulièrement." />
      <div className="space-y-4">
        <ExportCard />
        <ImportCard />
        <StorageCard />
        <ThemeCard />
      </div>
    </>
  );
}

function ExportCard() {
  const { run } = useFeedback();
  return (
    <Card>
      <CardHeader title="Exporter mes données" icon={<Download size={14} />} />
      <div className="space-y-3 px-4 pb-4">
        <p className="text-sm text-muted">Crée un fichier JSON contenant toutes tes tâches, projets, objectifs, habitudes, notes et bilans. Garde-le dans un endroit sûr (clé USB, cloud personnel…).</p>
        <Button variant="primary" icon={<Download size={15} />} onClick={() => run(downloadBackup, 'Sauvegarde téléchargée')}>
          Télécharger une sauvegarde
        </Button>
      </div>
    </Card>
  );
}

function ImportCard() {
  const { run, notify } = useFeedback();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedBackup | null>(null);
  const [fileName, setFileName] = useState('');
  const [current, setCurrent] = useState<BackupCounts | null>(null);
  const [error, setError] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setParsed(null);
    setFileName('');
    setConfirmText('');
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const onFile = async (file: File | undefined) => {
    reset();
    if (!file) return;
    setFileName(file.name);
    try {
      const result = parseBackup(await file.text());
      setCurrent(await countDatabase());
      setParsed(result);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const currentTotal = current ? ALL_TABLES.reduce((s, t) => s + current[t], 0) : 0;
  const canRestore = parsed !== null && (currentTotal === 0 || confirmText.trim().toUpperCase() === CONFIRM_WORD) && !busy;

  const restore = async () => {
    if (!parsed || !canRestore) return;
    setBusy(true);
    try {
      await restoreBackup(parsed.backup);
      notify('Sauvegarde restaurée');
      reset();
    } catch (err) {
      setError(`La restauration a échoué, aucune donnée n’a été modifiée. (${errorMessage(err)})`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Restaurer une sauvegarde" icon={<Upload size={14} />} />
      <div className="space-y-4 px-4 pb-4">
        <p className="text-sm text-muted">Le fichier est d’abord vérifié. Rien n’est modifié tant que tu n’as pas confirmé.</p>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={(e) => onFile(e.target.files?.[0])} className="hidden" aria-hidden tabIndex={-1} />
        <Button icon={<Upload size={15} />} onClick={() => fileRef.current?.click()}>
          Choisir un fichier…
        </Button>
        {fileName && <p className="text-xs text-faint">Fichier : {fileName}</p>}
        <ErrorMessage>{error}</ErrorMessage>

        {parsed && current && (
          <div className="space-y-4 rounded-lg border border-line p-4">
            <p className="text-sm">
              Sauvegarde valide
              {parsed.backup.exportedAt && !Number.isNaN(Date.parse(parsed.backup.exportedAt)) && <> du {new Date(parsed.backup.exportedAt).toLocaleString('fr-FR')}</>}.
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="pb-1 font-medium">Contenu</th>
                  <th className="pb-1 text-right font-medium">Actuellement</th>
                  <th className="pb-1 text-right font-medium">Dans le fichier</th>
                </tr>
              </thead>
              <tbody>
                {ALL_TABLES.map((t) => (
                  <tr key={t} className="border-t border-line">
                    <td className="py-1.5">{TABLE_LABELS[t]}</td>
                    <td className="py-1.5 text-right text-muted tabular-nums">{current[t]}</td>
                    <td className={cx('py-1.5 text-right tabular-nums', parsed.counts[t] < current[t] && 'text-warning')}>{parsed.counts[t]}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {parsed.warnings.length > 0 && (
              <ul className="space-y-1 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                {parsed.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}

            {currentTotal > 0 && (
              <div className="space-y-3 rounded-lg bg-danger/10 p-3">
                <p className="flex items-start gap-2 text-sm text-danger">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  La restauration REMPLACE toutes tes données actuelles ({currentTotal} éléments). Exporte-les d’abord si tu veux pouvoir revenir en arrière.
                </p>
                <Button size="sm" icon={<Download size={14} />} onClick={() => run(downloadBackup, 'Sauvegarde des données actuelles téléchargée')}>
                  Exporter mes données actuelles d’abord
                </Button>
                <label className="block text-xs text-muted">
                  Pour confirmer, tape <strong className="text-fg">{CONFIRM_WORD}</strong> :
                  <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="mt-1 max-w-56" autoComplete="off" />
                </label>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant={currentTotal > 0 ? 'danger' : 'primary'} disabled={!canRestore} onClick={restore}>
                {busy ? 'Restauration…' : currentTotal > 0 ? 'Remplacer mes données' : 'Importer'}
              </Button>
              <Button variant="ghost" onClick={reset}>
                Annuler
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

/** Demande au navigateur de ne pas effacer la base en cas de manque d'espace disque. */
function StorageCard() {
  const { notify } = useFeedback();
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<string>('');
  const supported = typeof navigator !== 'undefined' && !!navigator.storage?.persist;

  useEffect(() => {
    if (!supported) return;
    void navigator.storage.persisted().then(setPersisted);
    void navigator.storage.estimate?.().then((e) => e.usage !== undefined && setUsage(`${(e.usage / 1024 / 1024).toFixed(1)} Mo utilisés`));
  }, [supported]);

  const request = async () => {
    const ok = await navigator.storage.persist();
    setPersisted(ok);
    notify(ok ? 'Stockage persistant activé' : 'Le navigateur a refusé. Pense à exporter régulièrement.', ok ? 'success' : 'error');
  };

  return (
    <Card>
      <CardHeader title="Stockage" icon={<HardDrive size={14} />} />
      <div className="space-y-3 px-4 pb-4 text-sm text-muted">
        <p>
          Les données sont enregistrées dans IndexedDB, propre à ce navigateur. Effacer les données de navigation du site les supprime.
          {usage && <> {usage}.</>}
        </p>
        {!supported ? (
          <p>Ce navigateur ne permet pas de demander un stockage persistant.</p>
        ) : persisted ? (
          <p className="text-success">Stockage persistant activé : le navigateur ne supprimera pas tes données automatiquement.</p>
        ) : (
          <Button size="sm" onClick={request}>
            Demander un stockage persistant
          </Button>
        )}
      </div>
    </Card>
  );
}

function ThemeCard() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);
  const choose = (t: Theme) => {
    setTheme(t);
    setThemeState(t);
  };
  return (
    <Card>
      <CardHeader title="Apparence" />
      <div className="flex gap-2 px-4 pb-4">
        <Button variant={theme === 'dark' ? 'primary' : 'secondary'} icon={<Moon size={14} />} onClick={() => choose('dark')}>
          Sombre
        </Button>
        <Button variant={theme === 'light' ? 'primary' : 'secondary'} icon={<Sun size={14} />} onClick={() => choose('light')}>
          Clair
        </Button>
      </div>
    </Card>
  );
}
