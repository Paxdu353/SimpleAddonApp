import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  getInjectorSnapshot: () => ipcRenderer.invoke('injector:get-snapshot'),
  setSelectedAddon: (addonId: string) => ipcRenderer.invoke('injector:set-selected-addon', addonId),
  setSelectedAddons: (addonIds: string[]) =>
    ipcRenderer.invoke('injector:set-selected-addons', addonIds),
  refreshAddons: () => ipcRenderer.invoke('injector:refresh-addons'),
  setAutoStartEnabled: (enabled: boolean) => ipcRenderer.invoke('injector:set-auto-start', enabled),
  getUpdateSnapshot: () => ipcRenderer.invoke('updater:get-snapshot'),
  checkForAppUpdates: () => ipcRenderer.invoke('updater:check-for-updates'),
  installDownloadedUpdate: () => ipcRenderer.invoke('updater:install-downloaded-update'),
  onUpdaterUpdate: (callback: (snapshot: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: unknown): void =>
      callback(snapshot)
    ipcRenderer.on('updater:update', listener)

    return () => ipcRenderer.removeListener('updater:update', listener)
  },
  onInjectorUpdate: (callback: (snapshot: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: unknown): void =>
      callback(snapshot)
    ipcRenderer.on('injector:update', listener)

    return () => ipcRenderer.removeListener('injector:update', listener)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
