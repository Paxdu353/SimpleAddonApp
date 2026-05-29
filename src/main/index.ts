import { app, shell, BrowserWindow, ipcMain, Menu, Tray } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { NationsGloryInjector } from './injector'
import { startAutoUpdater } from './updater'

const injector = new NationsGloryInjector()
const startHidden = process.argv.includes('--hidden')
const appIcon = icon
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false

if (!app.requestSingleInstanceLock()) {
  app.quit()
}

startAutoUpdater()

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    skipTaskbar: startHidden,
    autoHideMenuBar: true,
    icon: appIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) return

    injector.attachWindow(mainWindow)
    if (!startHidden) {
      mainWindow.show()
    }
  })

  mainWindow.on('close', (event) => {
    if (quitting || process.platform === 'darwin') {
      return
    }

    event.preventDefault()
    mainWindow?.hide()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function showMainWindow(): void {
  if (!mainWindow) {
    createWindow()
    return
  }

  mainWindow.setSkipTaskbar(false)
  mainWindow.show()
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
}

function createTray(): void {
  if (tray) return

  tray = new Tray(appIcon)
  tray.setToolTip('SimpleAddonApp')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Ouvrir',
        click: showMainWindow
      },
      {
        label: 'Quitter',
        click: () => {
          quitting = true
          app.quit()
        }
      }
    ])
  )
  tray.on('double-click', showMainWindow)
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('injector:get-snapshot', () => injector.getSnapshot())
  ipcMain.handle('injector:set-selected-addon', (_event, addonId: string) =>
    injector.setSelectedAddon(addonId)
  )
  ipcMain.handle('injector:set-selected-addons', (_event, addonIds: string[]) =>
    injector.setSelectedAddons(addonIds)
  )
  ipcMain.handle('injector:refresh-addons', () => injector.refreshAddons())
  ipcMain.handle('injector:set-auto-start', (_event, enabled: boolean) =>
    injector.setAutoStartEnabled(enabled)
  )

  injector.start()

  createTray()
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('second-instance', () => {
  showMainWindow()
})

app.on('before-quit', () => {
  quitting = true
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
