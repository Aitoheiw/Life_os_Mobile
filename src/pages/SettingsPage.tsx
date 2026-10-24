import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertTriangle, Cloud, Download, HardDrive, LogOut, Moon, RefreshCw, Sun, Upload } from 'lucide-react';
import { signIn, signOut, signUp, syncNow, useSync } from '../sync/sync';
import { SyncBadge } from '../components/SyncBadge';
import { ALL_TABLES } from '../db/database';
import { backupFileName, countDatabase, exportBackup, parseBackup, restoreBackup, TABLE_LABELS, type BackupCounts, type ParsedBackup } from '../backup/backup';
import { errorMessage, useFeedback } from '../app/feedback';
import { downloadFile } from '../app/files';
import { useTheme } from '../app/theme';
import { Button, Card, CardHeader, ErrorMessage, Field, Input, PageHeader, cx } from '../components/ui';

const CONFIRM_WORD = 'REMPLACER';

async function downloadBackup(): Promise<void> {
  const backup = await exportBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  downloadFile(blob, backupFileName());
}

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Réglages" subtitle="Tes données sont enregistrées sur cet appareil et, si tu es connecté, synchronisées avec ton compte." />
      <div className="space-y-4">
        <AccountCard />
        <ExportCard />
        <ImportCard />
        <StorageCard />
        <ThemeCard />
      </div>
    </>
  );
}

/** Connexion au compte Supabase et état de la synchronisation. */
function AccountCard() {
  const sync = useSync();
  const { run, notify } = useFeedback();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (sync.status === 'disabled') {
    return (
      <Card>
        <CardHeader title="Synchronisation" icon={<Cloud size={14} />} />
        <p className="px-4 pb-4 text-sm text-muted">
          Non configurée : l’app fonctionne uniquement sur cet appareil. Renseigne <code className="font-mono text-xs">.env.local</code> (voir <code className="font-mono text-xs">.env.example</code>) pour activer Supabase.
        </p>
      </Card>
    );
  }

  if (sync.email) {
    return (
      <Card>
        <CardHeader title="Compte et synchronisation" icon={<Cloud size={14} />} action={<SyncBadge />} />
        <div className="space-y-3 px-4 pb-4 text-sm">
          <p className="text-muted">
            Connecté en tant que <strong className="font-medium text-fg">{sync.email}</strong>. Tes modifications sont envoyées automatiquement et arrivent sur tes autres appareils.
          </p>
          <ul className="space-y-0.5 text-xs text-faint">
            <li>Dernière synchronisation : {sync.lastSyncAt ? new Date(sync.lastSyncAt).toLocaleString('fr-FR') : 'jamais'}</li>
            <li>Modifications en attente d’envoi : {sync.pending}</li>
          </ul>
          <ErrorMessage>{sync.status === 'error' ? `La synchronisation a échoué : ${sync.error}` : ''}</ErrorMessage>
          <div className="flex flex-wrap gap-2">
            <Button icon={<RefreshCw size={14} className={cx(sync.status === 'syncing' && 'animate-spin')} />} disabled={sync.status === 'syncing'} onClick={() => run(syncNow, 'Synchronisation terminée')}>
              Synchroniser maintenant
            </Button>
            <Button variant="ghost" icon={<LogOut size={14} />} onClick={() => run(signOut, 'Déconnecté. Tes données restent sur cet appareil.')}>
              Se déconnecter
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'signIn') {
        await signIn(email, password);
        notify('Connecté : synchronisation en cours');
      } else if (await signUp(email, password)) {
        notify('Compte créé : synchronisation en cours');
      } else {
        notify('Compte créé. Clique sur le lien reçu par e-mail, puis connecte-toi ici.');
        setMode('signIn');
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Compte et synchronisation" icon={<Cloud size={14} />} />
      <form onSubmit={submit} className="space-y-3 px-4 pb-4">
        <p className="text-sm text-muted">Connecte-toi pour retrouver tes données sur ton iPhone et ton ordinateur. Ce qui est déjà sur cet appareil est fusionné avec ton compte, rien n’est effacé.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="E-mail">{(id) => <Input id={id} type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
          <Field label="Mot de passe" hint={mode === 'signUp' ? 'Au moins 6 caractères.' : undefined}>
            {(id) => <Input id={id} type="password" autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
        </div>
        <ErrorMessage>{error}</ErrorMessage>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Un instant…' : mode === 'signIn' ? 'Se connecter' : 'Créer mon compte'}
          </Button>
          <Button variant="ghost" onClick={() => (setMode(mode === 'signIn' ? 'signUp' : 'signIn'), setError(''))}>
            {mode === 'signIn' ? 'Pas encore de compte ? En créer un' : 'J’ai déjà un compte'}
          </Button>
        </div>
      </form>
    </Card>
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
          Les données sont enregistrées dans IndexedDB, propre à ce navigateur. Effacer les données du site les supprime de cet appareil (elles restent dans ton compte si tu es connecté).
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
  const [theme, choose] = useTheme();
  return (
    <Card>
      <CardHeader title="Apparence" />
      <div className="flex gap-2 px-4 pb-4">
        <Button variant={theme === 'light' ? 'primary' : 'secondary'} icon={<Sun size={14} />} onClick={() => choose('light')}>
          Clair
        </Button>
        <Button variant={theme === 'dark' ? 'primary' : 'secondary'} icon={<Moon size={14} />} onClick={() => choose('dark')}>
          Sombre
        </Button>
      </div>
    </Card>
  );
}
