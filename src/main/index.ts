import { app, BrowserWindow, shell, dialog } from 'electron'
import AppUpdater from './updater'
// @ts-ignore
// import helloAddonsTest from '../addons/hello'
import helloAddonsLibTest from '@ices/node-addons-hello'

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
  const nodeIntegration = !!process.env.ELECTRON_RENDERER_NODE_INTEGRATION

  mainWindow = new BrowserWindow({
    // show: false,
    show: true,
    // focusable: false,
    width: 1024,
    height: 728,
    backgroundColor: 'transparent',
    // icon: getAssetPath('icon.png'),
    webPreferences: {
      nodeIntegration,
      enableRemoteModule: nodeIntegration,
      contextIsolation: !nodeIntegration,
    },
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.once('show', async () => {
    // await dialog.showMessageBox({
    //   title: 'Native Addons Test',
    //   message: `Addons say: ${helloAddonsTest.hello()}`,
    // })
    await dialog.showMessageBox({
      title: 'Native Addons Test',
      message: `AddonsLib say: ${helloAddonsLibTest.hello()}`,
    })
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
