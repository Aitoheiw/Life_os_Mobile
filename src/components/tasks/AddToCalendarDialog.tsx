import { useState, type FormEvent } from 'react';
import { CalendarPlus, Share } from 'lucide-react';
import { buildIcs, icsFileName } from '../../domain/calendar';
import { today } from '../../domain/dates';
import { canShareFile, downloadFile, shareFile } from '../../app/files';
import { errorMessage, useFeedback } from '../../app/feedback';
import { Button, ErrorMessage, Field, Input, Modal, Select } from '../ui';

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];

const durationLabel = (min: number) => (min < 60 ? `${min} min` : min % 60 === 0 ? `${min / 60} h` : `${Math.floor(min / 60)} h ${min % 60}`);

export interface CalendarTask {
  uid: string;
  title: string;
  description: string;
  dueDate: string | null;
}

/**
 * Fenêtre « Ajouter au calendrier » : choisit le jour et, si on veut, l'heure et la durée,
 * puis remet un fichier `.ics` au système (le calendrier de l'iPhone propose alors de l'ajouter).
 */
export function AddToCalendarDialog({ open, onClose, task }: { open: boolean; onClose: () => void; task: CalendarTask }) {
  return (
    <Modal open={open} onClose={onClose} title="Ajouter au calendrier" width="max-w-sm">
      <CalendarForm task={task} onDone={onClose} />
    </Modal>
  );
}

function CalendarForm({ task, onDone }: { task: CalendarTask; onDone: () => void }) {
  const { notify } = useFeedback();
  const [date, setDate] = useState(task.dueDate || today());
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [error, setError] = useState('');

  /** Fabrique le fichier, ou affiche l'erreur et renvoie null. */
  const makeFile = (): File | null => {
    setError('');
    try {
      const ics = buildIcs({ uid: task.uid, title: task.title, description: task.description, date, time: time || null, durationMinutes: duration });
      return new File([ics], icsFileName(task.title), { type: 'text/calendar' });
    } catch (err) {
      setError(errorMessage(err));
      return null;
    }
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    const file = makeFile();
    if (!file) return;
    downloadFile(file, file.name);
    notify('Événement prêt : valide-le dans ton calendrier');
    onDone();
  };

  const share = async () => {
    const file = makeFile();
    if (!file) return;
    try {
      if (await shareFile(file, task.title)) onDone();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  // Le partage de fichiers n'existe pas partout (Firefox ordinateur, par ex.) : bouton masqué dans ce cas.
  const sharable = canShareFile(new File([''], 'test.ics', { type: 'text/calendar' }));

  return (
    <form onSubmit={add} className="space-y-4">
      <p className="truncate text-sm font-medium text-fg" title={task.title}>
        {task.title.trim() || 'Tâche sans titre'}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Jour">{(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />}</Field>
        <Field label="Heure (facultatif)">{(id) => <Input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
      </div>
      {time ? (
        <Field label="Durée">
          {(id) => (
            <Select id={id} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {durationLabel(d)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : (
        <p className="text-xs text-faint">Sans heure, l’événement occupe toute la journée.</p>
      )}

      <ErrorMessage>{error}</ErrorMessage>

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        {sharable && (
          <Button icon={<Share size={15} />} onClick={() => void share()}>
            Partager…
          </Button>
        )}
        <Button type="submit" variant="primary" icon={<CalendarPlus size={15} />}>
          Ajouter au calendrier
        </Button>
      </div>
      <p className="text-xs text-faint">C’est une copie : si tu modifies la tâche ensuite, l’événement ne change pas.</p>
    </form>
  );
}
