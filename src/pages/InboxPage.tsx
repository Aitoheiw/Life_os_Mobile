import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Check, CheckSquare, Inbox, NotebookPen, RotateCcw, Trash2 } from 'lucide-react';
import type { Note } from '../models';
import { useNotes } from '../hooks/useData';
import { captureIdea, convertIdeaToTask, deleteNote, markProcessed, reopenNote, updateNote } from '../db/notes';
import { useFeedback } from '../app/feedback';
import { useEditors } from '../app/editors';
import { Button, Card, EmptyState, IconButton, Input, PageHeader } from '../components/ui';

/**
 * Boîte de réception : tout ce qui est capturé sans être classé.
 * Objectif : la vider régulièrement en décidant pour chaque idée →
 * tâche, note, ou "traitée" (rien à faire).
 */
export function InboxPage() {
  const notes = useNotes();
  const { run } = useFeedback();
  const [text, setText] = useState('');
  const [showProcessed, setShowProcessed] = useState(false);

  if (!notes) return null;
  const ideas = notes.filter((n) => n.kind === 'idea');
  const open = ideas.filter((n) => n.status === 'open').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const processed = ideas.filter((n) => n.status !== 'open');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(() => captureIdea(text))) setText('');
  };

  return (
    <>
      <PageHeader title="Boîte de réception" subtitle="Capture d’abord, trie ensuite. Pour chaque idée : en faire une tâche, une note, ou la marquer traitée." />

      <form onSubmit={submit} className="mb-6 flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Capturer une idée… (Entrée pour ajouter)" aria-label="Nouvelle idée" autoFocus />
        <Button type="submit" variant="primary" disabled={!text.trim()}>
          Ajouter
        </Button>
      </form>

      <Card className="overflow-hidden">
        {open.length === 0 ? (
          <EmptyState icon={<Inbox size={28} />} title="Boîte de réception vide">
            Tout est trié. Utilise la touche <kbd className="font-mono">c</kbd> n’importe où pour capturer une idée.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {open.map((n) => (
              <IdeaRow key={n.id} idea={n} />
            ))}
          </ul>
        )}
      </Card>

      {processed.length > 0 && (
        <section className="mt-6">
          <button type="button" className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase hover:text-fg" onClick={() => setShowProcessed((v) => !v)}>
            Traitées ({processed.length}) · {showProcessed ? 'masquer' : 'afficher'}
          </button>
          {showProcessed && (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-line">
                {processed.map((n) => (
                  <li key={n.id} className="flex items-center gap-3 px-4 py-2">
                    <span className="flex-1 truncate text-sm text-muted">{n.title}</span>
                    {n.taskId && <span className="text-xs text-faint">→ tâche</span>}
                    <IconButton label="Remettre dans la boîte de réception" icon={<RotateCcw size={14} />} onClick={() => run(() => reopenNote(n.id))} />
                    <IconButton label="Supprimer" icon={<Trash2 size={14} />} onClick={() => run(() => deleteNote(n.id), 'Idée supprimée')} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      )}
    </>
  );
}

function IdeaRow({ idea }: { idea: Note }) {
  const { run } = useFeedback();
  const { editTask } = useEditors();
  const navigate = useNavigate();

  const toTask = () =>
    run(async () => {
      const task = await convertIdeaToTask(idea.id);
      // Ouvre la tâche pour compléter échéance / projet si besoin.
      editTask(task);
    }, 'Idée transformée en tâche');

  const toNote = () =>
    run(async () => {
      await updateNote(idea.id, { kind: 'note', status: 'open' });
      navigate(`/notes?id=${idea.id}`);
    }, 'Idée convertie en note');

  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-sm">{idea.title}</p>
        {idea.content && <p className="mt-0.5 line-clamp-2 text-xs whitespace-pre-wrap text-muted">{idea.content}</p>}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button size="sm" icon={<CheckSquare size={14} />} onClick={toTask}>
          Tâche
        </Button>
        <Button size="sm" icon={<NotebookPen size={14} />} onClick={toNote}>
          Note
        </Button>
        <Button size="sm" variant="ghost" icon={<Check size={14} />} onClick={() => run(() => markProcessed(idea.id))}>
          Traitée
        </Button>
      </div>
    </li>
  );
}
