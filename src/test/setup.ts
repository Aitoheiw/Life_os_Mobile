// IndexedDB simulée en mémoire pour les tests (Node n'a pas d'IndexedDB).
import 'fake-indexeddb/auto';
import { beforeEach } from 'vitest';
import { ALL_TABLES, db } from '../db/database';

// Chaque test démarre avec une base vide.
beforeEach(async () => {
  if (!db.isOpen()) await db.open();
  await db.transaction('rw', ALL_TABLES.map((t) => db.table(t)), async () => {
    for (const t of ALL_TABLES) await db.table(t).clear();
  });
});
