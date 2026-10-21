# Life OS — version mobile (PWA)

Application personnelle de productivité : tâches, projets, objectifs, habitudes, notes, focus Pomodoro, bilans.
Elle fonctionne hors ligne et se synchronise entre l'iPhone et l'ordinateur via Supabase. Elle s'installe sans passer par l'App Store.

## 1. Préparer Supabase (une seule fois)

1. Dans le projet Supabase **Life os**, ouvre **SQL Editor**, colle le contenu de [`supabase/schema.sql`](supabase/schema.sql), puis clique sur **Run**.
2. Dans **Project Settings → API**, récupère l'**URL du projet** et la clé **anon / publishable**.
3. Copie `.env.example` en `.env.local` et renseigne ces deux valeurs.
4. Dans **Authentication → URL Configuration**, mets l'adresse de l'app en ligne dans **Site URL** : le lien de confirmation envoyé par e-mail mènera alors à l'app.
   (Autre possibilité : désactiver **Confirm email** dans **Authentication → Sign In / Providers → Email**.)

## 2. Lancer en local

Prérequis : Node.js 20 ou plus.

```bash
npm install      # une seule fois
npm run dev      # puis ouvrir http://localhost:5173
```

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Lance l'application en développement |
| `npm test` | Lance les tests automatisés |
| `npm run typecheck` | Vérifie les types TypeScript |
| `npm run build` | Crée la version optimisée (+ service worker PWA) dans `dist/` |
| `npm run preview` | Sert la version optimisée localement |
| `npm run icons` | Régénère les icônes de l'app depuis `public/icon-app.svg` |

## 3. Mettre en ligne (nécessaire pour l'iPhone)

Une PWA doit être servie en HTTPS. Avec Vercel (gratuit) : importe ce dépôt GitHub, puis ajoute les variables
`VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans les réglages du projet. `vercel.json` est déjà prêt.

## 4. Installer sur l'iPhone

Ouvre l'adresse de l'app dans **Safari**, touche **Partager**, puis **Sur l'écran d'accueil**.
Ouvre ensuite l'app depuis son icône, va dans **Plus → Réglages** et connecte-toi : tes données arrivent.

## Comment marche la synchronisation

- L'app lit et écrit toujours d'abord sur l'appareil (IndexedDB) : elle est instantanée et fonctionne sans réseau.
- Chaque modification est mise dans une file d'attente, puis envoyée à Supabase dès que le réseau est disponible.
- Les modifications faites sur tes autres appareils arrivent en temps réel, ou au retour dans l'app.
- Chaque compte ne voit que ses propres données (règles RLS dans `supabase/schema.sql`).

## Tes données

- Elles sont stockées sur chaque appareil (IndexedDB) et, si tu es connecté, dans ton compte Supabase.
- Sans connexion, l'app marche quand même, mais seulement sur l'appareil utilisé.
- Tu peux toujours exporter une copie depuis **Réglages → Télécharger une sauvegarde** (fichier JSON).
- La restauration vérifie le fichier, affiche ce qu'il contient et demande de taper `REMPLACER` avant d'écraser quoi que ce soit.
  Si tu es connecté, la restauration est ensuite synchronisée vers tes autres appareils.

## Raccourcis clavier (ordinateur)

- `t` : nouvelle tâche
- `c` : capturer une idée (Entrée pour enregistrer)
- `Échap` : fermer une fenêtre

## Widgets iPhone

Apple réserve les widgets d'écran d'accueil aux apps natives : une PWA ne peut pas en créer.
Une piste gratuite : l'app **Scriptable**, qui peut afficher un widget lisant tes données dans Supabase.

Voir `CLAUDE.md` pour l'architecture et les conventions techniques.
