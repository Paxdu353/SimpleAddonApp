import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { is } from '@electron-toolkit/utils'

const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000

export interface UpdateSnapshot {
  status: 'idle' | 'checking' | 'available' | 'downloaded' | 'error'
  version: string | null
  error: string | null
}

const updateSnapshot: UpdateSnapshot = {
  status: 'idle',
  version: null,
  error: null
}

let notifyUpdate: ((snapshot: UpdateSnapshot) => void) | null = null

export function startAutoUpdater(onUpdate?: (snapshot: UpdateSnapshot) => void): void {
  notifyUpdate = onUpdate ?? null

  if (is.dev) {
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    setUpdateSnapshot({ status: 'checking', error: null })
  })

  autoUpdater.on('error', (error) => {
    setUpdateSnapshot({ status: 'error', error: error.message })
    console.error('[updater] update error:', error)
  })

  autoUpdater.on('update-available', (info) => {
    setUpdateSnapshot({ status: 'available', version: info.version, error: null })
    console.log('[updater] update available:', info.version)
  })

  autoUpdater.on('update-not-available', (info) => {
    setUpdateSnapshot({ status: 'idle', version: info.version, error: null })
    console.log('[updater] app is up to date:', info.version)
  })

  autoUpdater.on('update-downloaded', (info) => {
    setUpdateSnapshot({ status: 'downloaded', version: info.version, error: null })
    console.log('[updater] update downloaded:', info.version)
  })

  app.whenReady().then(() => {
    void autoUpdater.checkForUpdatesAndNotify()

    setInterval(() => {
      void autoUpdater.checkForUpdatesAndNotify()
    }, UPDATE_CHECK_INTERVAL_MS)
  })
}

export function getUpdateSnapshot(): UpdateSnapshot {
  return { ...updateSnapshot }
}

export async function checkForAppUpdates(): Promise<UpdateSnapshot> {
  if (is.dev) {
    setUpdateSnapshot({
      status: 'idle',
      version: app.getVersion(),
      error: null
    })
    return getUpdateSnapshot()
  }

  try {
    setUpdateSnapshot({ status: 'checking', error: null })
    await autoUpdater.checkForUpdatesAndNotify()
  } catch (error) {
    setUpdateSnapshot({
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    })
  }

  return getUpdateSnapshot()
}

export function installDownloadedUpdate(): void {
  if (updateSnapshot.status !== 'downloaded') {
    return
  }

  autoUpdater.quitAndInstall(false, true)
}

function setUpdateSnapshot(nextSnapshot: Partial<UpdateSnapshot>): void {
  Object.assign(updateSnapshot, nextSnapshot)
  notifyUpdate?.(getUpdateSnapshot())
}
