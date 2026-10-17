# Life OS

Application personnelle d'organisation : tâches, projets, objectifs, habitudes, notes et bilan hebdomadaire.
Elle fonctionne entièrement dans ton navigateur, sans compte ni abonnement. Tes données restent sur ton ordinateur.

## Démarrer

Prérequis : Node.js 20 ou plus.

```bash
npm install      # une seule fois
npm run dev      # puis ouvrir http://localhost:5173
```

## Commandes utiles

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Lance l'application en développement |
| `npm test` | Lance les tests automatisés |
| `npm run typecheck` | Vérifie les types TypeScript |
| `npm run build` | Crée la version optimisée dans `dist/` |
| `npm run preview` | Sert la version optimisée localement |

## Tes données

- Stockées dans IndexedDB, **propres à ce navigateur et à cette adresse** (`localhost:5173`).
  Changer de navigateur ou effacer les données du site = repartir de zéro.
- Exporte régulièrement depuis **Sauvegarde et réglages → Télécharger une sauvegarde** (fichier JSON).
- La restauration vérifie le fichier, affiche ce qu'il contient et demande de taper `REMPLACER` avant d'écraser quoi que ce soit.

## Raccourcis clavier

- `t` : nouvelle tâche
- `c` : capturer une idée (Entrée pour enregistrer)
- `Échap` : fermer une fenêtre

Voir `CLAUDE.md` pour l'architecture et les conventions techniques.
