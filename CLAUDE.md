# Life OS — contexte projet

Application personnelle locale de productivité (tâches, projets, objectifs, habitudes, notes, bilans).
Principe : CAPTURER → ORGANISER → PLANIFIER → AGIR → ÉVALUER. Utilisateur débutant : code simple, commenté en français.
Tout fonctionne hors ligne, sans serveur ni service payant. Données dans IndexedDB (navigateur).

## Commandes
- `npm run dev` — serveur de dev sur http://localhost:5173
- `npm test` — tests Vitest (fake-indexeddb, fuseau forcé Europe/Paris)
- `npm run typecheck` — TypeScript strict
- `npm run build` — typecheck + build de production dans `dist/`
Après chaque étape : `npm run typecheck && npm test`.

## Stack
React 19, TypeScript 7 (tsc natif), Vite 8, Tailwind 4 (`@tailwindcss/vite`, thème dans `src/index.css`),
Dexie 4 + dexie-react-hooks, zod 4 (validation, messages FR), react-router 7 (BrowserRouter), lucide-react, Vitest 5.

## Architecture (`src/`)
- `models/` types des entités. IDs UUID ; relations facultatives = `null`.
- `domain/` règles métier PURES et testées : `dates` (jours locaux), `recurrence`, `tasks` (retard, tri, filtres),
  `projects` (progression, prochaine action, progression objectif), `habits` (jours prévus, régularité),
  `today` (progression du jour), `review` (résumé de semaine), `markdown` (parseur sûr).
- `validation/schemas.ts` schémas zod de toutes les entités + `ValidationError` (message affichable).
- `db/` SEUL endroit qui écrit en base : `database.ts` (schéma versionné), `tasks`, `projects` (+ objectifs), `habits`, `notes`, `reviews`.
- `backup/backup.ts` export / analyse / réparation des liens / restauration atomique.
- `hooks/useData.ts` lectures live (`useLiveQuery`) + `useToday()` (change à minuit).
- `app/` App, Layout (sidebar), `feedback` (toasts + `run()` qui affiche les erreurs), `editors` (modales globales tâche/idée + raccourcis), `theme`.
- `components/ui` composants génériques (Button, Modal sur `<dialog>`, Field, Card, Tabs, ConfirmDialog…) ; composants métier dans `components/tasks|projects|habits`.
- `pages/` une page par route.

## Conventions et décisions
- **Jours = `YYYY-MM-DD` en heure locale** (`domain/dates`). Jamais `toISOString()` pour un jour. Instants = ISO.
- Les composants ne touchent jamais `db` directement : lecture via `hooks/useData`, écriture via `src/db/*`.
- Toute écriture passe par `validate(schema, …)`. Erreurs utilisateur = `ValidationError` en français.
- Suppression : toujours `ConfirmDialog`. Supprimer projet/objectif DÉTACHE tâches/notes (rien perdu).
- Tâches terminées conservées (historique). `postponedCount` s'incrémente si l'échéance est repoussée.
- Récurrence : une seule occurrence ouverte par série (`seriesId`) ; la suivante est créée en terminant, avec anti-doublon.
- Priorités du jour : champ `focusDate`, max 3 par jour (vérifié en base).
- Habitudes : logs séparés, index unique `[habitId+date]`. Régularité = faits / jours prévus ; aujourd'hui non fait, jours suspendus, avant création ou après archivage ne comptent pas.
- Progression projet = tâches terminées / tâches (null si 0 tâche). Objectif : par projets terminés ou valeur chiffrée.
- Migrations : ne jamais modifier `version(1)` ; ajouter `version(N+1)` + upgrade et incrémenter `SCHEMA_VERSION` ; prévoir la migration des sauvegardes anciennes dans `parseBackup`.
- Raccourcis : `t` nouvelle tâche, `c` capturer une idée (ignorés pendant la saisie). Entrée valide la capture.
- Thème sombre par défaut (classe `dark` sur `<html>`, choix en localStorage).

## État (fin de session 1 — 17/10/2026)
Terminé et vérifié (tests + essai réel dans Chrome) : toutes les pages du MVP — Aujourd'hui, Boîte de réception,
Tâches (filtres, recherche, onglets, récurrence), Projets + détail, Objectifs, Habitudes (historique 30 j, pause/archivage),
Notes (Markdown, autosave, liens projet/objectif), Bilan hebdo (historique), Sauvegarde (export, import vérifié + confirmation « REMPLACER »), thème clair/sombre, responsive.
48 tests passent (dates/fuseaux, tâches, retard, récurrence, projets, habitudes, markdown, progression du jour, export/import, persistance).

## Bugs / limites connus
- Pas de tests de composants React (seulement logique + base). Les parcours UI ont été vérifiés à la main.
- Changer la fréquence d'une habitude modifie rétroactivement le calcul de l'historique.
- Import = remplacement total (pas de fusion).
- Le raccourci `t`/`c` n'a pas pu être déclenché par l'outil d'automatisation Chrome (OK avec un vrai clavier et un événement JS) : à confirmer à la main.

## Prochaines étapes recommandées
1. Utiliser l'app quelques jours et noter les frictions réelles.
2. Afficher sur le dashboard les 3 priorités de la semaine issues du dernier bilan.
3. PWA (manifest + service worker, ex. `vite-plugin-pwa`) pour l'installation et le hors-ligne complet.
4. Rappel d'export régulier (date de la dernière sauvegarde).
5. Tests de composants (Testing Library + jsdom) pour les parcours critiques.
