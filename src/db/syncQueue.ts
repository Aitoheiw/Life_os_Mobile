import Dexie from 'dexie';
import type { DBCore, DBCoreMutateRequest, DBCoreTable, DBCoreTransaction, Middleware } from 'dexie';

/**
 * File d'attente de synchronisation.
 *
 * Chaque écriture locale (ajout, modification, suppression) dans une table synchronisée
 * ajoute une entrée `table:id` dans la table `syncQueue`, DANS LA MÊME TRANSACTION :
 * si l'écriture réussit, l'entrée existe forcément (même si l'app se ferme juste après).
 * La synchro (src/sync) lit ensuite l'état ACTUEL de l'élément et l'envoie à Supabase
 * (élément absent = supprimé).
 *
 * Techniquement c'est un « middleware » Dexie : il s'intercale entre l'app et IndexedDB,
 * aucun fichier de src/db/* n'a donc besoin d'être modifié.
 */

export const SYNC_QUEUE = 'syncQueue';

export interface SyncQueueEntry {
  /** `table:id` (clé primaire : une seule entrée par élément). */
  key: string;
  table: string;
  id: string;
  /** Change à chaque écriture : permet de savoir si l'élément a été remodifié pendant l'envoi. */
  token: string;
}

export const queueKey = (table: string, id: string) => `${table}:${id}`;
export const newQueueEntry = (table: string, id: string): SyncQueueEntry => ({ key: queueKey(table, id), table, id, token: crypto.randomUUID() });

/** Transactions qui appliquent des données VENANT du serveur : elles ne doivent pas être renvoyées. */
const silentTransactions = new WeakSet<object>();
export function markSilent(trans: object): void {
  silentTransactions.add(trans);
}

export function syncQueueMiddleware(syncedTables: readonly string[]): Middleware<DBCore> {
  const tracked = new Set(syncedTables);
  return {
    stack: 'dbcore',
    name: 'syncQueue',
    // Juste au-dessus du stockage et de l'observation (liveQuery) : nos ajouts dans la file sont donc observés.
    level: 1,
    create(down) {
      return {
        ...down,
        // Toute transaction d'écriture sur une table suivie inclut aussi la file d'attente.
        transaction(stores, mode, options) {
          const needsQueue = mode === 'readwrite' && !stores.includes(SYNC_QUEUE) && stores.some((s) => tracked.has(s));
          return down.transaction(needsQueue ? [...stores, SYNC_QUEUE] : stores, mode, options);
        },
        table(name) {
          const table = down.table(name);
          if (!tracked.has(name)) return table;
          return {
            ...table,
            // Pas de async/await ici : Dexie perdrait le contexte de la transaction.
            // On enchaîne avec Dexie.Promise, qui le conserve.
            mutate(req) {
              if (silentTransactions.has(req.trans)) return table.mutate(req);
              return changedIds(table, req).then((ids) =>
                table.mutate(req).then((result) =>
                  ids.length === 0
                    ? result
                    : down
                        .table(SYNC_QUEUE)
                        .mutate({ type: 'put', trans: req.trans, values: ids.map((id) => newQueueEntry(name, id)) })
                        .then(() => result),
                ),
              );
            },
          };
        },
      };
    },
  };
}

/** Identifiants des éléments touchés par une écriture. */
function changedIds(table: DBCoreTable, req: DBCoreMutateRequest): Promise<string[]> {
  const ids = new Set<string>();
  const addAll = (keys: readonly unknown[] | undefined) => keys?.forEach((k) => k != null && ids.add(String(k)));
  const result = () => [...ids];

  if (req.type === 'add' || req.type === 'put') {
    addAll(req.keys);
    addAll(req.values.map((v: { id?: unknown } | undefined) => v?.id));
    if (req.type === 'put') {
      addAll(req.updates?.keys);
      // Modification groupée décrite par un critère (ex. `where(...).modify(...)`).
      if (req.criteria) {
        const index = req.criteria.index ? table.schema.getIndexByKeyPath(req.criteria.index) : table.schema.primaryKey;
        if (index) return primaryKeys(table, req.trans, index, req.criteria.range).then((keys) => (addAll(keys), result()));
      }
    }
  } else if (req.type === 'delete') {
    addAll(req.keys);
  } else {
    // deleteRange : utilisé par `clear()` et les suppressions groupées.
    return primaryKeys(table, req.trans, table.schema.primaryKey, req.range).then((keys) => (addAll(keys), result()));
  }
  return Dexie.Promise.resolve(result());
}

type QueryArgs = Parameters<DBCoreTable['query']>[0]['query'];

function primaryKeys(table: DBCoreTable, trans: DBCoreTransaction, index: QueryArgs['index'], range: QueryArgs['range']): Promise<unknown[]> {
  return Dexie.Promise.resolve(table.query({ trans, values: false, query: { index, range } })).then((res) => res.result);
}
