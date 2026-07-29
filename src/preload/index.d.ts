import { ElectronAPI } from '@electron-toolkit/preload'

export interface InjectorLog {
  at: string
  level: 'INFO' | 'OK' | 'WARN' | 'ERROR'
  message: string
}

export interface RemoteAddon {
  id: string
  name: string
  displayName: string
  version: string | null
  required: boolean
  beta: boolean
  fileName: string
  size: number
  updatedAt: string | null
}

export interface InjectorSnapshot {
  status:
    | 'syncing'
    | 'searching'
    | 'needs-selection'
    | 'armed'
    | 'waiting-game'
    | 'watching'
    | 'injecting'
    | 'injected'
    | 'error'
  addons: RemoteAddon[]
  selectedAddonIds: string[]
  selectedAddonNames: string[]
  selectedAddonId: string | null
  selectedAddonName: string | null
  repositoryReady: boolean
  watcherReady: boolean
  autoStartEnabled: boolean
  gameRunning: boolean
  lastInjectionAt: string | null
  logs: InjectorLog[]
}

export interface UpdateSnapshot {
  status: 'idle' | 'checking' | 'available' | 'downloaded' | 'error'
  version: string | null
  error: string | null
}

export interface InjectorApi {
  getInjectorSnapshot: () => Promise<InjectorSnapshot>
  setSelectedAddon: (addonId: string) => Promise<InjectorSnapshot>
  setSelectedAddons: (addonIds: string[]) => Promise<InjectorSnapshot>
  refreshAddons: () => Promise<InjectorSnapshot>
  setAutoStartEnabled: (enabled: boolean) => Promise<InjectorSnapshot>
  getUpdateSnapshot: () => Promise<UpdateSnapshot>
  checkForAppUpdates: () => Promise<UpdateSnapshot>
  installDownloadedUpdate: () => Promise<void>
  onUpdaterUpdate: (callback: (snapshot: UpdateSnapshot) => void) => () => void
  onInjectorUpdate: (callback: (snapshot: InjectorSnapshot) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: InjectorApi
  }
}
