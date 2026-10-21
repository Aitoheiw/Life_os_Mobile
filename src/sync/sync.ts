import { useSyncExternalStore } from 'react';
import { liveQuery } from 'dexie';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { db } from '../db/database';
import { nowIso } from '../domain/dates';
import { ValidationError } from '../validation/schemas';
import { enqueueAll, pullChanges, pushChanges } from './engine';
import { supabase, supabaseRemote } from './supabase';

/**
 * Pilote de la synchronisation avec Supabase (un seul pour toute l'app).
 *
 * Quand synchroniser ?
 * - à l'ouverture de l'app et à la connexion ;
 * - 2 s après une modification locale (on regroupe les frappes rapides) ;
 * - quand un autre appareil modifie quelque chose (temps réel Supabase) ;
 * - au retour sur l'app, au retour du réseau, et toutes les 5 minutes.
 * Hors ligne, les modifications attendent dans la file et partent dès le retour du réseau.
 */

export type SyncStatus = 'disabled' | 'signedOut' | 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncState {
  status: SyncStatus;
  email: string | null;
  /** Modifications locales pas encore envoyées. */
  pending: number;
  lastSyncAt: string | null;
  error: string | null;
}

let state: SyncState = { status: supabase ? 'signedOut' : 'disabled', email: null, pending: 0, lastSyncAt: null, error: null };
const listeners = new Set<() => void>();

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useSync(): SyncState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

// ---------- Synchronisation ----------

let userId: string | null = null;
let running: Promise<void> | null = null;
let runAgain = false;
let timer: number | undefined;

const cursorKey = (id: string) => `life-os-sync-cursor:${id}`;
const initKey = (id: string) => `life-os-sync-init:${id}`;

/** Lance une synchronisation (ou en programme une autre si une est déjà en cours). */
export function syncNow(): Promise<void> {
  if (!supabase || !userId) return Promise.resolve();
  if (running) {
    runAgain = true;
    return running;
  }
  running = (async () => {
    do {
      runAgain = false;
      await syncOnce();
    } while (runAgain);
  })().finally(() => (running = null));
  return running;
}

function scheduleSync(delayMs: number) {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void syncNow(), delayMs);
}

async function syncOnce() {
  const id = userId;
  if (!supabase || !id) return;
  if (!navigator.onLine) {
    setState({ status: 'offline' });
    return;
  }
  setState({ status: 'syncing' });
  try {
    const remote = supabaseRemote(supabase, id);
    await pushChanges(remote);
    const { cursor } = await pullChanges(remote, localStorage.getItem(cursorKey(id)));
    if (cursor) localStorage.setItem(cursorKey(id), cursor);
    // La réception peut avoir généré des suppressions (doublons résolus) : on les envoie.
    if ((await db.syncQueue.count()) > 0) await pushChanges(remote);
    if (userId === id) setState({ status: 'idle', lastSyncAt: nowIso(), error: null });
  } catch (err) {
    if (userId !== id) return;
    setState({ status: navigator.onLine ? 'error' : 'offline', error: err instanceof Error ? err.message : String(err) });
  }
}

// ---------- Démarrage ----------

let channel: RealtimeChannel | null = null;
let started = false;

/** À appeler une fois au lancement de l'app (main.tsx). */
export function startSync(): void {
  if (started || !supabase) return;
  started = true;
  const client = supabase;

  // Compteur de modifications en attente + envoi automatique.
  liveQuery(() => db.syncQueue.count()).subscribe((n) => {
    setState({ pending: n });
    if (n > 0 && userId) scheduleSync(2000);
  });

  client.auth.onAuthStateChange((_event, session) => {
    const id = session?.user.id ?? null;
    setState({ email: session?.user.email ?? null });
    if (id === userId) return;
    userId = id;
    // Supabase recommande de ne pas appeler ses fonctions directement dans ce rappel.
    window.setTimeout(() => void onUserChanged(id), 0);
  });

  window.addEventListener('online', () => void syncNow());
  window.addEventListener('offline', () => userId && setState({ status: 'offline' }));
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void syncNow());
  window.setInterval(() => document.visibilityState === 'visible' && void syncNow(), 5 * 60_000);
}

async function onUserChanged(id: string | null) {
  if (channel) {
    void supabase?.removeChannel(channel);
    channel = null;
  }
  if (!supabase || !id) {
    setState({ status: supabase ? 'signedOut' : 'disabled', lastSyncAt: null, error: null });
    return;
  }
  // Première connexion de ce compte sur cet appareil : on envoie tout le contenu local
  // (il est FUSIONNÉ avec celui du compte, rien n'est effacé).
  if (!localStorage.getItem(initKey(id))) {
    await enqueueAll();
    localStorage.setItem(initKey(id), nowIso());
  }
  channel = supabase
    .channel(`records-${id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `user_id=eq.${id}` }, () => scheduleSync(800))
    .subscribe();
  await syncNow();
}

// ---------- Compte ----------

const AUTH_MESSAGES: [RegExp, string][] = [
  [/invalid login credentials/i, 'E-mail ou mot de passe incorrect.'],
  [/email not confirmed/i, 'Confirme d’abord ton adresse e-mail grâce au lien reçu par mail.'],
  [/already registered|already been registered/i, 'Un compte existe déjà avec cet e-mail : connecte-toi.'],
  [/password should be at least/i, 'Le mot de passe doit contenir au moins 6 caractères.'],
  [/rate limit|too many/i, 'Trop de tentatives. Réessaie dans quelques minutes.'],
  [/invalid email|unable to validate email/i, 'Adresse e-mail invalide.'],
  [/failed to fetch|network/i, 'Impossible de joindre le serveur. Vérifie ta connexion.'],
];

function authError(message: string): ValidationError {
  const found = AUTH_MESSAGES.find(([re]) => re.test(message));
  return new ValidationError(found ? found[1] : `Erreur de connexion : ${message}`);
}

function client() {
  if (!supabase) throw new ValidationError('La synchronisation n’est pas configurée (fichier .env.local manquant).');
  return supabase;
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await client().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw authError(error.message);
}

/** Retourne `true` si le compte est utilisable tout de suite, `false` s'il faut confirmer l'e-mail. */
export async function signUp(email: string, password: string): Promise<boolean> {
  const { data, error } = await client().auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } });
  if (error) throw authError(error.message);
  return data.session !== null;
}

export async function signOut(): Promise<void> {
  const { error } = await client().auth.signOut();
  if (error) throw authError(error.message);
}
