import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Archive, ArchiveRestore, Eye, NotebookPen, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { Note } from '../models';
import { useGoals, useNotes, useProjects } from '../hooks/useData';
import { createNote, deleteNote, updateNote } from '../db/notes';
import { stripMarkdown } from '../domain/markdown';
import { errorMessage, useFeedback } from '../app/feedback';
import { Button, Card, ConfirmDialog, EmptyState, IconButton, Input, PageHeader, Select, Tabs, Textarea, cx } from '../components/ui';
import { Markdown } from '../components/Markdown';

type View = 'open' | 'archived';

export function NotesPage() {
  const notes = useNotes();
  const { run } = useFeedback();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<View>('open');
  const [search, setSearch] = useState('');
  const selectedId = params.get('id');

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (notes ?? [])
      .filter((n) => n.kind === 'note' && (view === 'archived' ? n.status === 'archived' : n.status !== 'archived'))
      .filter((n) => !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
  }, [notes, view, search]);

  if (!notes) return null;
  const selected = notes.find((n) => n.id === selectedId);
  const select = (id: string | null) => setParams(id ? { id } : {}, { replace: true });

  const create = () =>
    run(async () => {
      const n = await createNote({ title: 'Nouvelle note', content: '' });
      setView('open');
      select(n.id);
    });

  return (
    <>
      <PageHeader
        title="Notes"
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={create}>
            Nouvelle note
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <div className={cx('space-y-3', selected && 'hidden lg:block')}>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="pl-9" aria-label="Rechercher une note" />
          </div>
          <Tabs value={view} onChange={setView} items={[{ value: 'open', label: 'Notes' }, { value: 'archived', label: 'Archivées' }]} />
          <Card className="overflow-hidden">
            {visible.length === 0 ? (
              <EmptyState icon={<NotebookPen size={24} />} title={search ? 'Aucun résultat' : view === 'open' ? 'Aucune note' : 'Aucune note archivée'} />
            ) : (
              <ul className="divide-y divide-line">
                {visible.map((n) => (
                  <li key={n.id}>
                    <button type="button" onClick={() => select(n.id)} className={cx('block w-full px-3 py-2.5 text-left hover:bg-surface-2/60', n.id === selectedId && 'bg-surface-2')}>
                      <span className="block truncate text-sm font-medium">{n.title || 'Sans titre'}</span>
                      <span className="block truncate text-xs text-muted">{stripMarkdown(n.content).split('\n')[0] || 'Vide'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className={cx(!selected && 'hidden lg:block')}>
          {selected ? (
            <NoteEditor key={selected.id} note={selected} onClose={() => select(null)} />
          ) : (
            <Card>
              <EmptyState icon={<NotebookPen size={28} />} title="Sélectionne ou crée une note">
                Formatage simple : # titre, - liste, - [ ] case, **gras**, *italique*, [lien](https://…)
              </EmptyState>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

/** Éditeur avec enregistrement automatique (après une courte pause de frappe). */
function NoteEditor({ note, onClose }: { note: Note; onClose: () => void }) {
  const projects = useProjects();
  const goals = useGoals();
  const { run, notify } = useFeedback();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [preview, setPreview] = useState(note.content.trim() !== '');
  const [status, setStatus] = useState<'saved' | 'pending' | 'error'>('saved');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const latest = useRef({ title, content });
  latest.current = { title, content };

  useEffect(() => {
    if (title === note.title && content === note.content) return;
    setStatus('pending');
    const timer = window.setTimeout(() => {
      updateNote(note.id, { title, content })
        .then(() => setStatus('saved'))
        .catch((err) => {
          setStatus('error');
          notify(errorMessage(err), 'error');
        });
    }, 600);
    return () => window.clearTimeout(timer);
    // note.title / note.content changent après chaque sauvegarde : on ne relance que sur la frappe.
  }, [title, content]);

  // Sauvegarde immédiate si on quitte l'éditeur avant la fin du délai.
  useEffect(
    () => () => {
      const { title: t, content: c } = latest.current;
      if (t !== note.title || c !== note.content) void updateNote(note.id, { title: t, content: c }).catch(() => undefined);
    },
    [],
  );

  const archived = note.status === 'archived';

  return (
    <Card className="flex min-h-[60vh] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
        <button type="button" onClick={onClose} className="text-sm text-muted hover:text-fg lg:hidden">
          ← Notes
        </button>
        <span className="text-xs text-faint">{status === 'saved' ? 'Enregistré' : status === 'pending' ? 'Enregistrement…' : 'Erreur d’enregistrement'}</span>
        <div className="ml-auto flex items-center">
          <IconButton label={preview ? 'Modifier' : 'Aperçu'} icon={preview ? <Pencil size={14} /> : <Eye size={14} />} onClick={() => setPreview((p) => !p)} />
          {archived ? (
            <IconButton label="Désarchiver" icon={<ArchiveRestore size={14} />} onClick={() => run(() => updateNote(note.id, { status: 'open' }), 'Note restaurée')} />
          ) : (
            <IconButton label="Archiver" icon={<Archive size={14} />} onClick={() => run(() => updateNote(note.id, { status: 'archived' }), 'Note archivée')} />
          )}
          <IconButton label="Supprimer" icon={<Trash2 size={14} />} onClick={() => setConfirmDelete(true)} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre"
          aria-label="Titre de la note"
          className="bg-transparent text-lg font-semibold placeholder:text-faint focus:outline-none"
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Select aria-label="Projet lié" value={note.projectId ?? ''} onChange={(e) => run(() => updateNote(note.id, { projectId: e.target.value || null }))}>
            <option value="">Aucun projet lié</option>
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                Projet : {p.title}
              </option>
            ))}
          </Select>
          <Select aria-label="Objectif lié" value={note.goalId ?? ''} onChange={(e) => run(() => updateNote(note.id, { goalId: e.target.value || null }))}>
            <option value="">Aucun objectif lié</option>
            {(goals ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                Objectif : {g.title}
              </option>
            ))}
          </Select>
        </div>
        {preview ? (
          <div className="flex-1 cursor-text" onDoubleClick={() => setPreview(false)}>
            {content.trim() ? <Markdown source={content} /> : <p className="text-sm text-faint">Note vide. Double-clique pour écrire.</p>}
          </div>
        ) : (
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            autoFocus
            placeholder={'# Titre\n- liste\n- [ ] à faire\n**gras**, *italique*'}
            className="min-h-80 flex-1 font-mono text-[13px]"
            aria-label="Contenu de la note"
          />
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer la note ?"
        message={<>« {note.title || 'Sans titre'} » sera supprimée définitivement. L’archivage permet de la masquer sans la perdre.</>}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          run(async () => {
            await deleteNote(note.id);
            onClose();
          }, 'Note supprimée')
        }
      />
    </Card>
  );
}
