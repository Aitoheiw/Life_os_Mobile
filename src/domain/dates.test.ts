import { afterEach, describe, expect, it } from 'vitest';
import { addDays, addMonths, dateRange, diffDays, isLocalDate, startOfWeek, toLocalDate, today, weekday } from './dates';

describe('dates locales', () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it('une action à 23h30 heure locale reste sur le bon jour', () => {
    const lateEvening = new Date(2026, 9, 17, 23, 30); // 17 oct. 2026, 23h30 locale (Paris)
    expect(today(lateEvening)).toBe('2026-10-17');
    // toISOString (UTC) donnerait déjà le 17 à 21h30 UTC → ok ici, mais à 00h30 il donnerait la veille :
    const justAfterMidnight = new Date(2026, 9, 18, 0, 30);
    expect(justAfterMidnight.toISOString().slice(0, 10)).toBe('2026-10-17'); // le piège UTC
    expect(today(justAfterMidnight)).toBe('2026-10-18'); // notre calcul local
  });

  it('reste correct dans un fuseau très en avance sur UTC (UTC+14)', () => {
    process.env.TZ = 'Pacific/Kiritimati';
    const morning = new Date(2026, 9, 17, 9, 0); // 19h00 UTC la veille
    expect(morning.toISOString().slice(0, 10)).toBe('2026-10-16');
    expect(today(morning)).toBe('2026-10-17');
  });

  it('reste correct dans un fuseau en retard sur UTC (UTC-10)', () => {
    process.env.TZ = 'Pacific/Honolulu';
    const evening = new Date(2026, 9, 17, 21, 0); // 07h00 UTC le 18
    expect(evening.toISOString().slice(0, 10)).toBe('2026-10-18');
    expect(today(evening)).toBe('2026-10-17');
  });

  it('traverse le changement d’heure sans sauter ni dupliquer de jour', () => {
    // Passage à l'heure d'hiver en France : dimanche 25 octobre 2026.
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(dateRange('2026-10-24', '2026-10-27')).toEqual(['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']);
    // Heure d'été : 29 mars 2026.
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2);
  });

  it('gère fins de mois et années bissextiles', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-02-28', 1, 31)).toBe('2026-03-31');
  });

  it('calcule le lundi de la semaine', () => {
    expect(startOfWeek('2026-10-17')).toBe('2026-10-12'); // samedi → lundi
    expect(startOfWeek('2026-10-18')).toBe('2026-10-12'); // dimanche → lundi précédent
    expect(startOfWeek('2026-10-12')).toBe('2026-10-12');
    expect(weekday('2026-10-17')).toBe(6);
  });

  it('valide le format des dates', () => {
    expect(isLocalDate('2026-10-17')).toBe(true);
    expect(isLocalDate('2026-02-30')).toBe(false);
    expect(isLocalDate('17/10/2026')).toBe(false);
    expect(isLocalDate(null)).toBe(false);
    expect(toLocalDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
