import { describe, expect, it } from 'vitest';
import { db } from '../db/database';
import { createTask, deleteTask, updateTask } from '../db/tasks';
import { createHabit, toggleHabitLog } from '../db/habits';
import { exportBackup, restoreBackup } from '../backup/backup';
import { enqueueAll, pullChanges, pushChanges, stableStringify, type OutgoingRow, type Remote, type RemoteRow } from './engine';

/** Faux serveur Supabase en mémoire : même comportement que la table `records`. */
function fakeRemote() {
  const rows = new Map<string, RemoteRow>();
  let clock = Date.parse('2026-10-21T08:00:00Z');
  const remote: Remote & { rows: Map<string, RemoteRow>; write: (r: OutgoingRow) => void } = {
    rows,
    write(r) {
      clock += 1000;
      // Comme jsonb : passage par JSON (les clés peuvent être réordonnées).
      rows.set(`${r.table_name}:${r.id}`, { ...r, data: JSON.parse(JSON.stringify(r.data)), updated_at: new Date(clock).toISOString() });
    },
    async push(batch) {
      batch.forEach((r) => remote.write(r));
    },
    async pull(since) {
      return [...rows.values()].filter((r) => since === null || Date.parse(r.updated_at) > Date.parse(since)).sort((a, b) => a.updated_at.localeCompare(b.updated_at));
    },
  };
  return remote;
}

describe('file d’attente de synchronisation', () => {
  it('note chaque création, modification et suppression', async () => {
    const t = await createTask({ title: 'Acheter du pain' });
    expect(await db.syncQueue.get(`tasks:${t.id}`)).toBeDefined();
    await db.syncQueue.clear();

    await updateTask(t.id, { title: 'Acheter du pain complet' });
    expect(await db.syncQueue.count()).toBe(1);
    await db.syncQueue.clear();

    await deleteTask(t.id);
    expect((await db.syncQueue.toArray()).map((e) => e.key)).toContain(`tasks:${t.id}`);
  });

  it('note aussi les suppressions groupées (restauration de sauvegarde)', async () => {
    const t = await createTask({ title: 'Ancienne' });
    const backup = await exportBackup();
    backup.data.tasks = [];
    await db.syncQueue.clear();
    await restoreBackup(backup);
    expect((await db.syncQueue.toArray()).map((e) => e.key)).toEqual([`tasks:${t.id}`]);
  });
});

describe('synchronisation', () => {
  it('envoie les éléments puis vide la file d’attente', async () => {
    const remote = fakeRemote();
    const t = await createTask({ title: 'Courir' });
    expect(await pushChanges(remote)).toBe(1);
    expect(await db.syncQueue.count()).toBe(0);
    expect(remote.rows.get(`tasks:${t.id}`)?.data).toMatchObject({ title: 'Courir' });
  });

  it('envoie une suppression sous forme de « pierre tombale »', async () => {
    const remote = fakeRemote();
    const t = await createTask({ title: 'Courir' });
    await pushChanges(remote);
    await deleteTask(t.id);
    await pushChanges(remote);
    expect(remote.rows.get(`tasks:${t.id}`)).toMatchObject({ deleted: true, data: null });
  });

  it('réplique les données d’un appareil à l’autre', async () => {
    const remote = fakeRemote();
    const t = await createTask({ title: 'Depuis le PC' });
    await pushChanges(remote);

    // « Autre appareil » : base vide, on tire tout depuis le serveur.
    await db.tasks.clear();
    await db.syncQueue.clear();
    const { cursor, applied } = await pullChanges(remote, null);
    expect(applied).toBe(1);
    expect(cursor).not.toBeNull();
    expect((await db.tasks.get(t.id))?.title).toBe('Depuis le PC');
    // Les écritures venant du serveur ne repartent pas vers le serveur.
    expect(await db.syncQueue.count()).toBe(0);
  });

  it('applique les suppressions faites sur un autre appareil', async () => {
    const remote = fakeRemote();
    const t = await createTask({ title: 'À supprimer' });
    await pushChanges(remote);
    const { cursor } = await pullChanges(remote, null);
    remote.write({ table_name: 'tasks', id: t.id, data: null, deleted: true });
    await pullChanges(remote, cursor);
    expect(await db.tasks.get(t.id)).toBeUndefined();
  });

  it('une modification locale non envoyée n’est pas écrasée par le serveur', async () => {
    const remote = fakeRemote();
    const t = await createTask({ title: 'Original' });
    await pushChanges(remote);
    remote.write({ table_name: 'tasks', id: t.id, data: { ...t, title: 'Version serveur' }, deleted: false });
    await updateTask(t.id, { title: 'Version locale' });

    await pullChanges(remote, null);
    expect((await db.tasks.get(t.id))?.title).toBe('Version locale');
    await pushChanges(remote);
    expect(remote.rows.get(`tasks:${t.id}`)?.data).toMatchObject({ title: 'Version locale' });
  });

  it('résout le doublon d’habitude validée sur deux appareils hors ligne', async () => {
    const remote = fakeRemote();
    const h = await createHabit({ name: 'Lire', startDate: '2026-10-01' });
    await pushChanges(remote);
    await toggleHabitLog(h.id, '2026-10-20');
    const local = (await db.habitLogs.toArray())[0]!;
    await db.syncQueue.clear(); // déjà « envoyée » pour simplifier

    remote.write({ table_name: 'habitLogs', id: 'autre-appareil', data: { id: 'autre-appareil', habitId: h.id, date: '2026-10-20', createdAt: local.createdAt }, deleted: false });
    await pullChanges(remote, null);

    const logs = await db.habitLogs.toArray();
    expect(logs.map((l) => l.id)).toEqual(['autre-appareil']);
    // La copie locale supprimée est signalée au serveur.
    expect(await db.syncQueue.get(`habitLogs:${local.id}`)).toBeDefined();
  });

  it('ignore une ligne invalide venue du serveur', async () => {
    const remote = fakeRemote();
    remote.write({ table_name: 'tasks', id: 'x', data: { id: 'x', title: 42 }, deleted: false });
    remote.write({ table_name: 'table-inconnue', id: 'y', data: {}, deleted: false });
    const { applied } = await pullChanges(remote, null);
    expect(applied).toBe(0);
    expect(await db.tasks.count()).toBe(0);
  });

  it('première connexion : tout le contenu local est mis en file d’attente', async () => {
    await createTask({ title: 'A' });
    await createHabit({ name: 'B' });
    await db.syncQueue.clear();
    await enqueueAll();
    expect(await db.syncQueue.count()).toBe(2);
  });

  it('compare les données sans tenir compte de l’ordre des clés', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: [1, { f: 1, e: 2 }] } })).toBe(stableStringify({ a: { c: [1, { e: 2, f: 1 }], d: 2 }, b: 1 }));
  });
});
