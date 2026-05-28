import { ElectronAPI } from '@electron-toolkit/preload'

export interface InjectorLog {
  at: string
  level: 'INFO' | 'OK' | 'WARN' | 'ERROR'
  message: string
}

export interface RemoteAddon {
  id: string
  name: string
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
  selectedAddonId: string | null
  selectedAddonName: string | null
  repositoryReady: boolean
  watcherReady: boolean
  autoStartEnabled: boolean
  gameRunning: boolean
  lastInjectionAt: string | null
  logs: InjectorLog[]
}

export interface InjectorApi {
  getInjectorSnapshot: () => Promise<InjectorSnapshot>
  setSelectedAddon: (addonId: string) => Promise<InjectorSnapshot>
  setAutoStartEnabled: (enabled: boolean) => Promise<InjectorSnapshot>
  onInjectorUpdate: (callback: (snapshot: InjectorSnapshot) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: InjectorApi
  }
}
