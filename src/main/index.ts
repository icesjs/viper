import path from 'path'
import url from 'url'
import { app, BrowserWindow, shell } from 'electron'
import AppUpdater from './updater'
import { developmentLogger as log } from './logger'

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

  const nodeIntegration = !!process.env.ELECTRON_RENDERER_NODE_INTEGRATION

  mainWindow = new BrowserWindow({
    show: false,
    // focusable: false,
    width: 1024,
    height: 728,
    // backgroundColor: '#202020',
    // icon: getAssetPath('icon.png'),
    webPreferences: {
      nodeIntegration,
      contextIsolation: !nodeIntegration,
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

  const htmlURL = process.env.ELECTRON_RENDERER_INDEX_HTML_URL
  if (htmlURL) {
    await mainWindow.loadURL(htmlURL)
  }

  mainWindow.webContents.on('new-window', (event, url) => {
    event.preventDefault()
    shell.openExternal(url)
  })
}
