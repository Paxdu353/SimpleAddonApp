# SimpleAddonApp

Application Electron qui injecte automatiquement un ou plusieurs addons NationsGlory après sélection dans l'interface.

Les addons viennent du dépôt GitHub public `Paxdu353/SimpleAddon`.
Le code source doit vivre dans le dépôt privé `Paxdu353/SimpleAddonSourceCode`.
Les mises à jour de l'application restent sur les releases GitHub de `Paxdu353/SimpleAddonApp`.

## Organisation GitHub

- `Paxdu353/SimpleAddonSourceCode`: dépôt privé du code source.
- `Paxdu353/SimpleAddonApp`: dépôt public utilisé par `electron-updater` pour les releases de l'application.
- `Paxdu353/SimpleAddon`: dépôt public utilisé comme catalogue d'addons et de `watcher.jar`.

Pour garder cette séparation, publie les tags et les fichiers de release sur `SimpleAddonApp`, mais pousse le code source sur `SimpleAddonSourceCode`.

## Installation dev

```bash
pnpm install
```

## Lancer en dev

```bash
pnpm dev
```

En dev, l'auto-update est désactivé.

## Build Windows

```bash
pnpm run build:win
```

Les fichiers sortent dans `dist/`.

## Faire une mise à jour de l'application

1. Vérifier que le dépôt est propre :

```bash
git status
```

2. Augmenter la version :

```bash
pnpm version patch
```

Exemple : `1.0.1` devient `1.0.2`.

3. Générer le build Windows :

```bash
pnpm run build:win
```

4. Pousser le code source vers le dépôt privé :

```bash
git push source master
```

5. Pousser le tag vers le dépôt de releases :

```bash
git push origin --tags
```

6. Créer une GitHub Release sur `Paxdu353/SimpleAddonApp`.

Le tag doit être exactement la version générée, par exemple :

```text
v1.0.2
```

7. Ajouter exactement ces 3 fichiers depuis `dist/` :

```text
simple-addon-X.Y.Z-setup.exe
latest.yml
simple-addon-X.Y.Z-setup.exe.blockmap
```

Exemple pour `1.0.2` :

```text
simple-addon-1.0.2-setup.exe
latest.yml
simple-addon-1.0.2-setup.exe.blockmap
```

8. Publier la release.

## Important

- Ne pas renommer les fichiers dans la release.
- `latest.yml` doit être présent, sinon l'auto-update ne fonctionne pas.
- Le fichier `.blockmap` doit être présent pour les mises à jour différentielles.
- Les utilisateurs ne recevront une update que si la version GitHub est plus grande que leur version installée.
- L'app vérifie les updates au lancement puis toutes les 15 minutes.
- Une update téléchargée s'installe quand l'app quitte vraiment.

Pour quitter vraiment l'app : icône de la zone de notification Windows, clic droit, `Quitter`.
