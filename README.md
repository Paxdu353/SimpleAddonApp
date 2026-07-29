# SimpleAddonApp

Application Electron qui injecte automatiquement un ou plusieurs addons NationsGlory apres selection dans l'interface.

Les addons viennent du depot GitHub public `Paxdu353/SimpleAddon`.
Le code source doit vivre dans le depot prive `Paxdu353/SimpleAddonSourceCode`.
Les mises a jour de l'application sont publiees dans les releases GitHub de `Paxdu353/SimpleAddonApp`.

## Organisation GitHub

- `Paxdu353/SimpleAddonSourceCode`: depot prive du code source.
- `Paxdu353/SimpleAddonApp`: depot public utilise par `electron-updater` pour les releases de l'application.
- `Paxdu353/SimpleAddon`: depot public utilise comme catalogue d'addons et de `watcher.jar`.

Pour garder cette separation, pousse le code source sur `SimpleAddonSourceCode`, mais publie les tags et fichiers de release sur `SimpleAddonApp`.

## Installation dev

```bash
pnpm install
```

## Lancer en dev

```bash
pnpm dev
```

En dev, l'auto-update est desactive par securite.

## Build Windows

```bash
pnpm run build:win
```

Les fichiers sortent dans `dist/`.

## Procedure de mise a jour de l'application

1. Verifier que le code est pret :

```bash
pnpm run lint
pnpm run typecheck
git status
```

2. Commit les changements de code avant de changer la version.

`pnpm version` refuse de fonctionner si le dossier Git contient des fichiers modifies.

```bash
git add .
git commit -m "Prepare app update"
```

3. Augmenter la version dans `package.json`.

Pour une petite correction :

```bash
pnpm version patch
```

Exemple : `1.0.9` devient `1.0.10`.

Pour une version mineure :

```bash
pnpm version minor
```

Utilise bien `pnpm version`, pas `npm version`. Le projet est configure pour `pnpm`.

4. Generer le build Windows :

```bash
pnpm run build:win
```

5. Verifier les fichiers generes dans `dist/`.

Pour une version `1.0.10`, il faut publier au minimum :

```text
simple-addon-1.0.10-setup.exe
simple-addon-1.0.10-setup.exe.blockmap
latest.yml
```

Ne renomme pas ces fichiers. `latest.yml` doit rester exactement celui genere par `electron-builder`.

6. Pousser le code source vers le depot prive :

```bash
git push source master
```

7. Pousser le tag vers le depot de releases :

```bash
git push origin --tags
```

Le tag doit correspondre a la version, par exemple :

```text
v1.0.10
```

8. Creer une GitHub Release sur `Paxdu353/SimpleAddonApp`.

- Choisir le tag de la nouvelle version.
- Ajouter les fichiers generes dans `dist/`.
- Publier la release.

9. Tester la mise a jour.

Sur une ancienne version installee de l'app :

- ouvrir SimpleAddonApp ;
- cliquer sur `Verifier les mises a jour` ;
- si une nouvelle version existe, l'app la telecharge via `electron-updater` ;
- quand la mise a jour est telechargee, elle peut etre installee au redemarrage de l'app.

## Important

- La version publiee sur GitHub doit etre superieure a la version installee chez l'utilisateur.
- `latest.yml` est obligatoire, sinon `electron-updater` ne detecte pas la mise a jour.
- Le fichier `.blockmap` permet les mises a jour differentielles.
- L'app verifie automatiquement les mises a jour au lancement puis toutes les 15 minutes.
- Le bouton `Verifier les mises a jour` force une verification manuelle.
- Une mise a jour telechargee s'installe quand l'app quitte vraiment.

Pour quitter vraiment l'app sous Windows : icone de la zone de notification, clic droit, `Quitter`.
