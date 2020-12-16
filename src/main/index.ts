import path from 'path'
import { app, BrowserWindow, shell } from 'electron'
import AppUpdater from './updater'

let mainWindow: BrowserWindow | null = null

;(async () => {
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  await app.whenReady()
  await createWindow()

  app.on('activate', async () => {
    if (mainWindow === null) {
      await createWindow()
    }
  })

  await new AppUpdater().check()
})()

//
async function createWindow() {
  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'resources')
    : path.join(__dirname, '../resources')

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths)
  }

  mainWindow = new BrowserWindow({
    show: false,
    // focusable: false,
    width: 1024,
    height: 728,
    // backgroundColor: '#202020',
    // icon: getAssetPath('icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.once('show', () => {
    mainWindow?.setBackgroundColor('transparent')
  })

  await mainWindow.loadURL(process.env.ELECTRON_RENDERER_INDEX_HTML_URL || '')

  mainWindow.webContents.on('new-window', (event, url) => {
    event.preventDefault()
    shell.openExternal(url)
  })
}
