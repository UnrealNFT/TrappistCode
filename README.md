# TrappistCode

Assistant de code intelligent connecté à GitHub, avec éditeur embarqué et mode autonome (type Copilot).

## Fonctionnalités

- **Chat de code contextuel** : l'assistant connaît le fichier ouvert dans l'éditeur et son contenu.
- **Édition locale** : modifications ciblées du buffer via `edit_buffer` / `set_buffer`.
- **Intégration GitHub** : lecture, création et patch de fichiers directement sur le dépôt.
- **Mode autonomie** : l'assistant enchaîne les actions (une par tour) jusqu'à compléter la tâche.
- **Push manuel** : l'utilisateur garde le contrôle — il pousse lui-même ses changements depuis l'éditeur.

## Stack technique

- React + TypeScript
- Vite (HMR via Oxc / SWC)
- Oxlint pour le linting
- API GitHub via token personnel

## Démarrage

    npm install
    npm run dev

## Scripts

    npm run dev       # serveur de développement
    npm run build     # build de production
    npm run lint      # lint avec Oxlint
    npm run preview   # prévisualiser le build

## Actions de l'assistant

### Actions locales (éditeur, prioritaires)

| Action         | Description                                          |
| -------------- | ---------------------------------------------------- |
| `edit_buffer`  | Remplace un extrait exact dans le fichier ouvert     |
| `set_buffer`   | Remplace tout le contenu du fichier ouvert           |

> Les actions locales modifient l'éditeur, pas GitHub. Le push reste manuel.

### Actions GitHub (une seule par réponse)

| Action        | Description                                            |
| ------------- | ------------------------------------------------------ |
| `list_files`  | Liste les fichiers d'un chemin du dépôt                |
| `read_file`   | Lit un fichier du dépôt                                |
| `create_file` | Crée un fichier sur le dépôt (~2500 caractères max)    |
| `patch_file`  | Patch un fichier directement sur GitHub                |

## Linting

Configuration Oxlint dans `.oxlintrc.json`. Pour une application en production, active les règles type-aware avec `oxlint-tsgolint` — voir la [documentation Oxlint](https://oxc.rs/docs/guide/usage/linter/rules).
