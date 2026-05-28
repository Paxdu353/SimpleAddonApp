import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { is } from '@electron-toolkit/utils'

const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000

export function startAutoUpdater(): void {
  if (is.dev) {
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('error', (error) => {
    console.error('[updater] update error:', error)
  })

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] update available:', info.version)
  })

  autoUpdater.on('update-not-available', (info) => {
    console.log('[updater] app is up to date:', info.version)
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[updater] update downloaded:', info.version)
  })

  app.whenReady().then(() => {
    void autoUpdater.checkForUpdatesAndNotify()

    setInterval(() => {
      void autoUpdater.checkForUpdatesAndNotify()
    }, UPDATE_CHECK_INTERVAL_MS)
  })
}
