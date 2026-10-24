import { describe, expect, it } from 'vitest';
import { buildIcs, escapeIcsText, foldIcsLine, icsFileName, type CalendarEventInput } from './calendar';
import { ValidationError } from '../validation/schemas';

const event = (over: Partial<CalendarEventInput> = {}): CalendarEventInput => ({
  uid: 'abc',
  title: 'Appeler Léa',
  description: '',
  date: '2026-10-25',
  time: null,
  durationMinutes: 60,
  ...over,
});

const NOW = new Date(Date.UTC(2026, 9, 20, 8, 30, 0));
const lines = (ics: string) => ics.split('\r\n');

describe('export calendrier (.ics)', () => {
  it('sans heure : événement toute la journée, fin le lendemain', () => {
    const ics = buildIcs(event(), NOW);
    expect(lines(ics)).toContain('DTSTART;VALUE=DATE:20261025');
    expect(lines(ics)).toContain('DTEND;VALUE=DATE:20261026');
    expect(lines(ics)).toContain('UID:abc@life-os');
    expect(lines(ics)).toContain('DTSTAMP:20261020T083000Z');
    expect(lines(ics)).toContain('SUMMARY:Appeler Léa');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/); // uniquement des fins de ligne CRLF
  });

  it('fin de mois : la fin exclusive passe au mois suivant', () => {
    expect(lines(buildIcs(event({ date: '2026-12-31' }), NOW))).toContain('DTEND;VALUE=DATE:20270101');
  });

  it('avec heure : heure locale flottante et durée', () => {
    const ics = buildIcs(event({ time: '14:30', durationMinutes: 45 }), NOW);
    expect(lines(ics)).toContain('DTSTART:20261025T143000');
    expect(lines(ics)).toContain('DTEND:20261025T151500');
  });

  it('un événement tard le soir déborde sur le lendemain', () => {
    const ics = buildIcs(event({ time: '23:30', durationMinutes: 90 }), NOW);
    expect(lines(ics)).toContain('DTEND:20261026T010000');
  });

  it('le jour du changement d’heure, la durée se compte à l’horloge (25/10/2026 à Paris)', () => {
    const ics = buildIcs(event({ time: '01:30', durationMinutes: 120 }), NOW);
    // Heures flottantes : 1h30 + 2 h = 3h30 « à l'horloge », comme le lirait l'utilisateur.
    expect(lines(ics)).toContain('DTSTART:20261025T013000');
    expect(lines(ics)).toContain('DTEND:20261025T033000');
  });

  it('échappe les caractères spéciaux et ajoute la description', () => {
    expect(escapeIcsText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
    const ics = buildIcs(event({ title: 'Courses : pain, lait', description: 'Ligne 1\nLigne 2' }), NOW);
    expect(lines(ics)).toContain('SUMMARY:Courses : pain\\, lait');
    expect(lines(ics)).toContain('DESCRIPTION:Ligne 1\\nLigne 2');
    expect(buildIcs(event(), NOW)).not.toContain('DESCRIPTION');
  });

  it('coupe les lignes longues à 75 octets sans casser les accents', () => {
    const long = 'SUMMARY:' + 'é'.repeat(60);
    const folded = foldIcsLine(long).split('\r\n');
    expect(folded.length).toBeGreaterThan(1);
    for (const l of folded) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(folded.map((l, i) => (i === 0 ? l : l.slice(1))).join('')).toBe(long);
  });

  it('refuse les données invalides avec un message en français', () => {
    expect(() => buildIcs(event({ title: '   ' }), NOW)).toThrow(ValidationError);
    expect(() => buildIcs(event({ date: '2026-02-30' }), NOW)).toThrow('Choisis une date valide.');
    expect(() => buildIcs(event({ time: '25:00' }), NOW)).toThrow('Choisis une heure valide.');
    expect(() => buildIcs(event({ time: '10:00', durationMinutes: 0 }), NOW)).toThrow(ValidationError);
  });

  it('nom de fichier lisible', () => {
    expect(icsFileName('Appeler Léa !')).toBe('appeler-lea.ics');
    expect(icsFileName('???')).toBe('evenement.ics');
  });
});
