import { ALL_TABLES, db, type TableName } from '../db/database';
import { markSilent, newQueueEntry, queueKey, type SyncQueueEntry } from '../db/syncQueue';
import { ENTITY_SCHEMAS } from '../backup/backup';

/**
 * Moteur de synchronisation local ⇄ serveur, indépendant de Supabase
 * (le serveur est représenté par l'interface `Remote`, simulée dans les tests).
 *
 * Règles :
 * - ENVOI : chaque entrée de la file d'attente envoie l'état actuel de l'élément
 *   (ou une suppression s'il n'existe plus).
 * - RÉCEPTION : on récupère les lignes modifiées depuis le dernier passage (curseur = heure serveur).
 *   Si l'élément a une modification locale pas encore envoyée, la version locale gagne
 *   (elle sera envoyée juste après) ; sinon la version du serveur remplace la locale.
 */

/** Ligne de la table `records` côté serveur. */
export interface RemoteRow {
  table_name: string;
  id: string;
  data: unknown;
  deleted: boolean;
  updated_at: string;
}

export type OutgoingRow = Omit<RemoteRow, 'updated_at'>;

export interface Remote {
  push(rows: OutgoingRow[]): Promise<void>;
  /** Toutes les lignes modifiées après `since` (toutes si null), triées par `updated_at`. */
  pull(since: string | null): Promise<RemoteRow[]>;
}

const PUSH_BATCH = 500;
/** Marge de relecture : une écriture validée un peu tard côté serveur n'est pas ratée (réappliquer est sans effet). */
const PULL_OVERLAP_MS = 5_000;

const isTable = (name: string): name is TableName => (ALL_TABLES as readonly string[]).includes(name);

/** Nombre de modifications locales en attente d'envoi. */
export const pendingCount = () => db.syncQueue.count();

/** Envoie les modifications en attente. Retourne le nombre d'éléments envoyés. */
export async function pushChanges(remote: Remote): Promise<number> {
  let sent = 0;
  for (;;) {
    const batch = await db.syncQueue.limit(PUSH_BATCH).toArray();
    if (batch.length === 0) return sent;

    const rows: OutgoingRow[] = [];
    for (const entry of batch) {
      if (!isTable(entry.table)) continue;
      const data = await db.table(entry.table).get(entry.id);
      rows.push({ table_name: entry.table, id: entry.id, data: data ?? null, deleted: data === undefined });
    }
    if (rows.length > 0) await remote.push(rows);

    // On ne retire que les entrées qui n'ont pas été remodifiées pendant l'envoi.
    await db.transaction('rw', db.syncQueue, async () => {
      const current = await db.syncQueue.bulkGet(batch.map((e) => e.key));
      const done = batch.filter((e, i) => current[i]?.token === e.token).map((e) => e.key);
      await db.syncQueue.bulkDelete(done);
    });
    sent += rows.length;
    // Sécurité anti-boucle : si tout le lot a été remodifié pendant l'envoi, on s'arrête là.
    if (batch.length < PUSH_BATCH) return sent;
  }
}

/**
 * Récupère et applique les modifications du serveur.
 * Retourne le nouveau curseur (inchangé si rien de nouveau) et le nombre d'éléments modifiés localement.
 */
export async function pullChanges(remote: Remote, cursor: string | null): Promise<{ cursor: string | null; applied: number }> {
  const since = cursor ? new Date(Date.parse(cursor) - PULL_OVERLAP_MS).toISOString() : null;
  const rows = await remote.pull(since);
  if (rows.length === 0) return { cursor, applied: 0 };
  const applied = await applyRemoteRows(rows);
  const newest = rows.reduce((max, r) => (Date.parse(r.updated_at) > Date.parse(max) ? r.updated_at : max), cursor ?? rows[0]!.updated_at);
  return { cursor: newest, applied };
}

export async function applyRemoteRows(rows: RemoteRow[]): Promise<number> {
  const tables = [...ALL_TABLES.map((t) => db.table(t)), db.syncQueue];
  return db.transaction('rw', tables, async (tx) => {
    // Ces écritures viennent du serveur : elles ne doivent pas repartir dans la file d'attente.
    markSilent(tx.idbtrans);
    const pending = new Set((await db.syncQueue.toCollection().primaryKeys()) as string[]);
    let applied = 0;

    for (const row of rows) {
      if (!isTable(row.table_name) || pending.has(queueKey(row.table_name, row.id))) continue;
      const table = db.table(row.table_name);
      const existing: unknown = await table.get(row.id);

      if (row.deleted || row.data === null) {
        if (existing !== undefined) {
          await table.delete(row.id);
          applied++;
        }
        continue;
      }
      // Donnée corrompue ou d'une version plus récente de l'app : ignorée plutôt que de casser la base.
      const parsed = ENTITY_SCHEMAS[row.table_name].safeParse(row.data);
      if (!parsed.success || parsed.data.id !== row.id) continue;
      if (existing !== undefined && stableStringify(existing) === stableStringify(parsed.data)) continue;

      await removeUniqueConflicts(row.table_name, parsed.data as unknown as Record<string, unknown>);
      await table.put(parsed.data);
      applied++;
    }
    return applied;
  });
}

/**
 * Deux appareils hors ligne peuvent créer chacun « la même » réalisation d'habitude
 * (même habitude, même jour) ou le bilan d'une même semaine, avec des id différents.
 * La version du serveur gagne : la copie locale est supprimée, et cette suppression est envoyée.
 */
async function removeUniqueConflicts(table: TableName, data: Record<string, unknown>): Promise<void> {
  let duplicates: { id: string }[] = [];
  if (table === 'habitLogs') {
    duplicates = await db.habitLogs.where('[habitId+date]').equals([data.habitId as string, data.date as string]).toArray();
  } else if (table === 'weeklyReviews') {
    duplicates = await db.weeklyReviews.where('weekStart').equals(data.weekStart as string).toArray();
  }
  for (const dup of duplicates) {
    if (dup.id === data.id) continue;
    await db.table(table).delete(dup.id);
    await db.syncQueue.put(newQueueEntry(table, dup.id));
  }
}

/** Ajoute TOUS les éléments locaux à la file d'attente (première connexion de cet appareil). */
export async function enqueueAll(): Promise<void> {
  const tables = [...ALL_TABLES.map((t) => db.table(t)), db.syncQueue];
  await db.transaction('rw', tables, async () => {
    const entries: SyncQueueEntry[] = [];
    for (const t of ALL_TABLES) {
      const ids = (await db.table(t).toCollection().primaryKeys()) as string[];
      entries.push(...ids.map((id) => newQueueEntry(t, id)));
    }
    await db.syncQueue.bulkPut(entries);
  });
}

/** JSON avec clés triées : Postgres (jsonb) ne conserve pas l'ordre des clés. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v,
  );
}
