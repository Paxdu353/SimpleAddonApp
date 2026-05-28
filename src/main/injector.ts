import { app, BrowserWindow } from 'electron'
import { access, copyFile, mkdir, readdir, readFile, stat, writeFile } from 'fs/promises'
import { constants } from 'fs'
import { dirname, join } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import https from 'https'

const execFileAsync = promisify(execFile)

type InjectorStatus =
  | 'syncing'
  | 'searching'
  | 'needs-selection'
  | 'armed'
  | 'waiting-game'
  | 'watching'
  | 'injecting'
  | 'injected'
  | 'error'

export interface RemoteAddon {
  id: string
  name: string
  fileName: string
  size: number
  updatedAt: string | null
}

export interface InjectorSnapshot {
  status: InjectorStatus
  addons: RemoteAddon[]
  selectedAddonId: string | null
  selectedAddonName: string | null
  repositoryReady: boolean
  watcherReady: boolean
  autoStartEnabled: boolean
  gameRunning: boolean
  lastInjectionAt: string | null
  logs: InjectorLog[]
}

export interface InjectorLog {
  at: string
  level: 'INFO' | 'OK' | 'WARN' | 'ERROR'
  message: string
}

interface StoredConfig {
  selectedAddonId: string | null
  autoStartEnabled: boolean
}

interface CachedAsset extends RemoteAddon {
  localPath: string
  remotePath: string
}

interface GitHubTreeItem {
  path: string
  type: 'blob' | 'tree'
  size?: number
}

const REPOSITORY_OWNER = 'Paxdu353'
const REPOSITORY_NAME = 'SimpleAddon'
const GITHUB_API = 'https://api.github.com'
const GAME_PROCESS_NAME = 'NationsGlory.exe'
const WATCHER_FILE_NAME = 'watcher.jar'
const MAX_LOGS = 200
const CONFIG_FILE_NAME = 'injector-config.json'

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export class NationsGloryInjector {
  private snapshot: InjectorSnapshot = {
    status: 'syncing',
    addons: [],
    selectedAddonId: null,
    selectedAddonName: null,
    repositoryReady: false,
    watcherReady: false,
    autoStartEnabled: false,
    gameRunning: false,
    lastInjectionAt: null,
    logs: []
  }

  private windows = new Set<BrowserWindow>()
  private assets = new Map<string, CachedAsset>()
  private watcherPath: string | null = null
  private started = false
  private lastLogKey: string | null = null
  private configPath: string | null = null

  start(): void {
    if (this.started) return

    this.started = true
    this.configPath = join(app.getPath('userData'), CONFIG_FILE_NAME)
    void this.bootstrap()
  }

  attachWindow(window: BrowserWindow): void {
    this.windows.add(window)
    window.on('closed', () => this.windows.delete(window))
    this.emit()
  }

  getSnapshot(): InjectorSnapshot {
    return {
      ...this.snapshot,
      addons: [...this.snapshot.addons],
      logs: [...this.snapshot.logs]
    }
  }

  async setSelectedAddon(addonId: string): Promise<InjectorSnapshot> {
    if (!this.assets.has(addonId)) {
      throw new Error('Addon introuvable dans le catalogue.')
    }

    this.snapshot.selectedAddonId = addonId
    this.snapshot.selectedAddonName = this.assets.get(addonId)?.name ?? null
    await this.saveConfig()
    this.log('OK', `Addon selectionne: ${this.snapshot.selectedAddonName}`)
    this.emit()
    return this.getSnapshot()
  }

  async setAutoStartEnabled(enabled: boolean): Promise<InjectorSnapshot> {
    this.snapshot.autoStartEnabled = enabled

    if (process.platform === 'win32') {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        path: process.execPath,
        args: ['--hidden']
      })
    }

    await this.saveConfig()
    this.log(
      'OK',
      enabled
        ? 'Demarrage automatique active. L application attendra NationsGlory apres ouverture de Windows.'
        : 'Demarrage automatique desactive.'
    )
    this.emit()
    return this.getSnapshot()
  }

  private async bootstrap(): Promise<void> {
    this.log('INFO', 'Synchronisation avec le depot GitHub public.')
    await this.loadConfig()
    await this.syncRepository()
    void this.runForever()
  }

  private async loadConfig(): Promise<void> {
    if (!this.configPath) return

    try {
      const config = JSON.parse(await readFile(this.configPath, 'utf8')) as Partial<StoredConfig>
      this.snapshot.selectedAddonId =
        typeof config.selectedAddonId === 'string' ? config.selectedAddonId : null
      this.snapshot.autoStartEnabled = config.autoStartEnabled === true

      if (process.platform === 'win32') {
        const loginSettings = app.getLoginItemSettings()
        this.snapshot.autoStartEnabled = loginSettings.openAtLogin || this.snapshot.autoStartEnabled
      }
    } catch {
      this.snapshot.autoStartEnabled =
        process.platform === 'win32' ? app.getLoginItemSettings().openAtLogin : false
    }
  }

  private async saveConfig(): Promise<void> {
    if (!this.configPath) return

    await mkdir(dirname(this.configPath), { recursive: true })
    await writeFile(
      this.configPath,
      JSON.stringify(
        {
          selectedAddonId: this.snapshot.selectedAddonId,
          autoStartEnabled: this.snapshot.autoStartEnabled
        } satisfies StoredConfig,
        null,
        2
      ),
      'utf8'
    )
  }

  private async syncRepository(): Promise<void> {
    this.setStatus('syncing')

    try {
      const defaultBranch = await this.fetchDefaultBranch()
      const tree = await this.fetchRepositoryTree(defaultBranch)
      const jars = tree
        .filter((item) => item.type === 'blob' && item.path.toLowerCase().endsWith('.jar'))
        .sort((a, b) => a.path.localeCompare(b.path))

      const watcher = jars.find((jar) => jar.path.toLowerCase().endsWith(WATCHER_FILE_NAME))
      const addons = jars.filter((jar) => jar !== watcher)

      if (!watcher) {
        throw new Error('Aucun watcher.jar trouve dans le depot GitHub.')
      }

      if (addons.length === 0) {
        throw new Error('Aucun addon injectable trouve dans le depot GitHub.')
      }

      const cacheDir = join(app.getPath('userData'), 'github-cache')
      await mkdir(cacheDir, { recursive: true })

      this.watcherPath = await this.downloadJar(defaultBranch, watcher.path, cacheDir)
      this.snapshot.watcherReady = true
      this.assets.clear()

      for (const addon of addons) {
        const cachedPath = await this.downloadJar(defaultBranch, addon.path, cacheDir)
        const asset = this.toCachedAsset(addon, cachedPath)
        this.assets.set(asset.id, asset)
      }

      this.snapshot.addons = [...this.assets.values()].map((addon) => ({
        id: addon.id,
        name: addon.name,
        fileName: addon.fileName,
        size: addon.size,
        updatedAt: addon.updatedAt
      }))
      this.snapshot.repositoryReady = true

      if (this.snapshot.selectedAddonId && !this.assets.has(this.snapshot.selectedAddonId)) {
        this.snapshot.selectedAddonId = null
        this.snapshot.selectedAddonName = null
        await this.saveConfig()
      }

      if (this.snapshot.selectedAddonId) {
        this.snapshot.selectedAddonName =
          this.assets.get(this.snapshot.selectedAddonId)?.name ?? null
      }

      this.log('OK', `${this.snapshot.addons.length} addon(s) recuperes depuis GitHub.`)
    } catch (error) {
      this.snapshot.repositoryReady = false
      this.snapshot.watcherReady = false
      this.setStatus('error')
      this.log('ERROR', error instanceof Error ? error.message : String(error))
      await sleep(5000)
      await this.syncRepository()
    }
  }

  private async fetchDefaultBranch(): Promise<string> {
    const repository = await this.getJson<{ default_branch?: string }>(
      `${GITHUB_API}/repos/${REPOSITORY_OWNER}/${REPOSITORY_NAME}`
    )
    return repository.default_branch ?? 'main'
  }

  private async fetchRepositoryTree(branch: string): Promise<GitHubTreeItem[]> {
    const data = await this.getJson<{ tree?: GitHubTreeItem[] }>(
      `${GITHUB_API}/repos/${REPOSITORY_OWNER}/${REPOSITORY_NAME}/git/trees/${branch}?recursive=1`
    )
    return data.tree ?? []
  }

  private async downloadJar(branch: string, remotePath: string, cacheDir: string): Promise<string> {
    const fileName = remotePath.split('/').at(-1) ?? remotePath
    const localPath = join(cacheDir, fileName)
    const url = `https://raw.githubusercontent.com/${REPOSITORY_OWNER}/${REPOSITORY_NAME}/${branch}/${remotePath
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`

    const content = await this.getBuffer(url)
    await writeFile(localPath, content)
    return localPath
  }

  private toCachedAsset(item: GitHubTreeItem, localPath: string): CachedAsset {
    const fileName = item.path.split('/').at(-1) ?? item.path
    const name = fileName.replace(/\.jar$/i, '')

    return {
      id: item.path,
      name,
      fileName,
      size: item.size ?? 0,
      updatedAt: null,
      localPath,
      remotePath: item.path
    }
  }

  private async runForever(): Promise<void> {
    this.log('INFO', 'Injector pret. Selectionne un addon, puis lance NationsGlory.')

    while (true) {
      try {
        await this.runCycle()
      } catch (error) {
        this.setStatus('error')
        this.log('ERROR', error instanceof Error ? error.message : String(error))
        await sleep(3000)
      }
    }
  }

  private async runCycle(): Promise<void> {
    if (!this.snapshot.selectedAddonId) {
      this.setStatus('needs-selection')
      await sleep(1000)
      return
    }

    const selectedAddon = this.assets.get(this.snapshot.selectedAddonId)
    if (!selectedAddon) {
      this.snapshot.selectedAddonId = null
      this.snapshot.selectedAddonName = null
      await this.saveConfig()
      this.setStatus('needs-selection')
      return
    }

    this.setStatus('searching')
    const modsPath = await this.findModsPath()
    if (!modsPath) {
      this.log('WARN', 'Dossier mods NationsGlory introuvable. Nouvelle tentative dans 3 secondes.')
      await sleep(3000)
      return
    }

    if (!this.watcherPath) {
      this.log('WARN', 'Watcher pas encore disponible. Resynchronisation GitHub.')
      await this.syncRepository()
      return
    }

    const watcherDest = join(modsPath, WATCHER_FILE_NAME)
    await this.injectFile(this.watcherPath, watcherDest)
    this.setStatus('armed')
    this.log('OK', 'Watcher installe automatiquement.')

    this.setStatus('waiting-game')
    this.log('INFO', `En attente de ${GAME_PROCESS_NAME}.`)

    while (!(await this.isGameRunning())) {
      this.setGameRunning(false)
      await sleep(1000)
    }

    this.setGameRunning(true)
    this.setStatus('watching')
    this.log('INFO', `${GAME_PROCESS_NAME} detecte. Surveillance active.`)

    while (await this.pathExists(watcherDest)) {
      this.setGameRunning(await this.isGameRunning())
      await sleep(500)
    }

    this.setStatus('injecting')
    this.log('INFO', `Injection de ${selectedAddon.name}.`)
    await this.injectFile(selectedAddon.localPath, join(modsPath, selectedAddon.fileName))

    this.snapshot.lastInjectionAt = new Date().toISOString()
    this.setStatus('injected')
    this.log('OK', `${selectedAddon.name} injecte.`)

    while (await this.isGameRunning()) {
      this.setGameRunning(true)
      await sleep(2000)
    }

    this.setGameRunning(false)
    this.log('INFO', 'NationsGlory ferme. Re-armement automatique.')
  }

  private async findModsPath(): Promise<string | null> {
    const appData = process.env.APPDATA
    if (!appData) return null

    const root = join(appData, '.NationsGlory')
    const versionsPath = join(root, 'versions')
    const stableModsPath = join(versionsPath, 'stable', 'mods')

    if (await this.isDirectory(stableModsPath)) {
      return stableModsPath
    }

    if (!(await this.isDirectory(versionsPath))) {
      return null
    }

    const versions = await readdir(versionsPath, { withFileTypes: true })
    const candidates: Array<{ path: string; mtimeMs: number }> = []

    for (const entry of versions) {
      if (!entry.isDirectory()) continue

      const modsPath = join(versionsPath, entry.name, 'mods')
      if (!(await this.isDirectory(modsPath))) continue

      const info = await stat(modsPath)
      candidates.push({ path: modsPath, mtimeMs: info.mtimeMs })
    }

    candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)
    return candidates[0]?.path ?? null
  }

  private async injectFile(source: string, destination: string): Promise<void> {
    if (!(await this.pathExists(source))) {
      throw new Error('Fichier source introuvable. Relance la synchronisation GitHub.')
    }

    await mkdir(dirname(destination), { recursive: true })
    await copyFile(source, destination)
  }

  private async isGameRunning(): Promise<boolean> {
    if (process.platform !== 'win32') {
      return false
    }

    try {
      const { stdout } = await execFileAsync('tasklist', [
        '/FI',
        `IMAGENAME eq ${GAME_PROCESS_NAME}`,
        '/NH'
      ])
      return stdout.toLowerCase().includes(GAME_PROCESS_NAME.toLowerCase())
    } catch {
      return false
    }
  }

  private async isDirectory(path: string): Promise<boolean> {
    try {
      return (await stat(path)).isDirectory()
    } catch {
      return false
    }
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      await access(path, constants.F_OK)
      return true
    } catch {
      return false
    }
  }

  private getJson<T>(url: string): Promise<T> {
    return this.getBuffer(url).then((buffer) => JSON.parse(buffer.toString('utf8')) as T)
  }

  private getBuffer(url: string, redirects = 0): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const request = https.get(
        url,
        {
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'SimpleAddonInjector'
          }
        },
        (response) => {
          const statusCode = response.statusCode ?? 0
          const location = response.headers.location

          if ([301, 302, 303, 307, 308].includes(statusCode) && location && redirects < 5) {
            response.resume()
            this.getBuffer(location, redirects + 1)
              .then(resolve)
              .catch(reject)
            return
          }

          if (statusCode < 200 || statusCode >= 300) {
            response.resume()
            reject(new Error(`GitHub a repondu avec le statut ${statusCode}.`))
            return
          }

          const chunks: Buffer[] = []
          response.on('data', (chunk: Buffer) => chunks.push(chunk))
          response.on('end', () => resolve(Buffer.concat(chunks)))
        }
      )

      request.on('error', reject)
      request.setTimeout(15000, () => {
        request.destroy(new Error('Delai depasse pendant la connexion a GitHub.'))
      })
    })
  }

  private setStatus(status: InjectorStatus): void {
    this.snapshot.status = status
    this.emit()
  }

  private setGameRunning(gameRunning: boolean): void {
    if (this.snapshot.gameRunning === gameRunning) return

    this.snapshot.gameRunning = gameRunning
    this.emit()
  }

  private log(level: InjectorLog['level'], message: string): void {
    const logKey = `${level}:${message}`
    if (this.lastLogKey === logKey) return

    this.lastLogKey = logKey
    this.snapshot.logs = [
      ...this.snapshot.logs.slice(-(MAX_LOGS - 1)),
      {
        at: new Date().toISOString(),
        level,
        message
      }
    ]
    this.emit()
  }

  private emit(): void {
    const snapshot = this.getSnapshot()

    for (const window of this.windows) {
      if (!window.isDestroyed()) {
        window.webContents.send('injector:update', snapshot)
      }
    }
  }
}
