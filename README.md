# SimpleAddonApp

Application Electron qui injecte automatiquement un addon NationsGlory apres selection du mod dans l'interface.

Les mods viennent du depot GitHub public `Paxdu353/SimpleAddon`.
Les mises a jour de l'application viennent des releases GitHub de `Paxdu353/SimpleAddonApp`.

## Installation dev

```bash
pnpm install
```

## Lancer en dev

```bash
pnpm dev
```

En dev, l'auto-update est desactive.

## Build Windows

```bash
pnpm run build:win
```

Les fichiers sortent dans `dist/`.

## Faire une mise a jour de l'application

1. Verifier que le repo est propre :

```bash
git status
```

2. Augmenter la version :

```bash
pnpm version patch
```

Exemple : `1.0.1` devient `1.0.2`.

3. Generer le build Windows :

```bash
pnpm run build:win
```

4. Pousser le commit et le tag :

```bash
git push origin master
git push origin --tags
```

5. Creer une GitHub Release sur `Paxdu353/SimpleAddonApp`.

Le tag doit etre exactement la version generee, par exemple :

```text
v1.0.2
```

6. Ajouter exactement ces 3 fichiers depuis `dist/` :

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

7. Publier la release.

## Important

- Ne pas renommer les fichiers dans la release.
- `latest.yml` doit etre present, sinon l'auto-update ne fonctionne pas.
- Le fichier `.blockmap` doit etre present pour les mises a jour differentielles.
- Les utilisateurs ne recevront une update que si la version GitHub est plus grande que leur version installee.
- L'app verifie les updates au lancement puis toutes les 15 minutes.
- Une update telechargee s'installe quand l'app quitte vraiment.

Pour quitter vraiment l'app : icone de la zone de notification Windows, clic droit, `Quitter`.
