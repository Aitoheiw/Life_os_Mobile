/**
 * Export d'une tâche vers un calendrier (iPhone, Outlook, Google Agenda…)
 * sous forme de fichier `.ics` (format iCalendar, RFC 5545).
 *
 * Choix :
 * - Sans heure → événement « toute la journée ».
 * - Avec heure → heure « flottante » (sans fuseau) : le calendrier l'interprète
 *   dans le fuseau de l'appareil, exactement comme l'app affiche les jours.
 * - C'est une copie : modifier la tâche ensuite ne met pas l'événement à jour.
 */
import { addDays, isLocalDate, parseLocalDate, type LocalDate } from './dates';
import { ValidationError } from '../validation/schemas';

export interface CalendarEventInput {
  /** Identifiant stable (id de la tâche) : réimporter le même événement le remplace au lieu de le dupliquer. */
  uid: string;
  title: string;
  description: string;
  date: LocalDate;
  /** Heure locale `HH:MM`, ou null pour toute la journée. */
  time: string | null;
  durationMinutes: number;
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const pad = (n: number) => String(n).padStart(2, '0');

/** `2026-10-25` → `20261025`. */
const icsDate = (d: LocalDate) => d.replaceAll('-', '');

/** Date locale → `20261025T143000` (heure flottante, sans « Z »). */
const icsLocalDateTime = (d: Date) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

/** Instant → `20261025T123000Z` (UTC, utilisé pour l'horodatage de création). */
const icsUtc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Échappe les caractères spéciaux d'un texte iCalendar. */
export function escapeIcsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Coupe les lignes trop longues (75 octets max) : la suite commence par un espace. */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    // 75 octets pour la 1re ligne, 74 pour les suivantes (l'espace initial compte).
    if (size + bytes > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/** Construit le contenu du fichier `.ics`. Lève une ValidationError si les données sont incomplètes. */
export function buildIcs(event: CalendarEventInput, now: Date = new Date()): string {
  const title = event.title.trim();
  if (!title) throw new ValidationError('Donne un titre à la tâche avant de l’ajouter au calendrier.');
  if (!isLocalDate(event.date)) throw new ValidationError('Choisis une date valide.');
  if (event.time !== null && !TIME_RE.test(event.time)) throw new ValidationError('Choisis une heure valide.');
  if (!Number.isInteger(event.durationMinutes) || event.durationMinutes < 5 || event.durationMinutes > 24 * 60) {
    throw new ValidationError('La durée doit être comprise entre 5 minutes et 24 heures.');
  }

  let when: string[];
  if (event.time === null) {
    // Toute la journée : la fin est exclusive (le lendemain).
    when = [`DTSTART;VALUE=DATE:${icsDate(event.date)}`, `DTEND;VALUE=DATE:${icsDate(addDays(event.date, 1))}`];
  } else {
    const start = parseLocalDate(event.date);
    start.setHours(Number(event.time.slice(0, 2)), Number(event.time.slice(3, 5)), 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + event.durationMinutes);
    when = [`DTSTART:${icsLocalDateTime(start)}`, `DTEND:${icsLocalDateTime(end)}`];
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Life OS//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}@life-os`,
    `DTSTAMP:${icsUtc(now)}`,
    ...when,
    `SUMMARY:${escapeIcsText(title)}`,
    ...(event.description.trim() ? [`DESCRIPTION:${escapeIcsText(event.description.trim())}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  // Le format impose des fins de ligne CRLF, y compris la dernière.
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

/** Nom de fichier lisible tiré du titre : « Appeler Léa ! » → `appeler-lea.ics`. */
export function icsFileName(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return `${slug || 'evenement'}.ics`;
}
