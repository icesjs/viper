import { app, shell, BrowserWindow, dialog } from 'electron'
import { productionLogger } from './logger'
import AppUpdater from './updater'

// 编译环境注入变量
const indexURL = process.env.ELECTRON_APP_INDEX_HTML_URL
const nodeIntegration = !!process.env.ELECTRON_APP_NODE_INTEGRATION

// 主窗口引用
let mainWindow: BrowserWindow | null = null

/**
 * 主程序入口
 */
async function main() {
  // 处理未捕获异常
  process.on('uncaughtException', handleException)
  process.on('unhandledRejection', handleException)

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('activate', createWindow)

  await app.whenReady()
  await createWindow()

  // 检查更新
  // 需要根据设置中是否检查更新来触发
  await new AppUpdater().check().catch(productionLogger.error)
}

/**
 * 捕获全局异常
 * @param err
 */
async function handleException(err) {
  // 记录异常日志
  productionLogger.error(err)
  // 需要做国际化，产品模式，不能显示具体错误消息给用户
  const isEnvProduction = process.env.NODE_ENV === 'production' || app.isPackaged
  const errMessage = isEnvProduction ? '' : err.message
  await dialog.showErrorBox('发生了一个错误！', errMessage)
  if (isEnvProduction) {
    process.nextTick(() => process.exit(1))
  }
}

/**
 * 创建主窗口
 */
async function createWindow() {
  //
  if (mainWindow !== null) {
    return
  }

  // 主窗口对象
  mainWindow = new BrowserWindow({
    show: false,
    width: 1024, // 宽高需要可定义
    height: 728,
    backgroundColor: 'transparent', // 初始背景色需要根据系统主题颜色自动设置
    webPreferences: {
      nodeIntegration,
      enableRemoteModule: nodeIntegration,
      contextIsolation: !nodeIntegration,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (indexURL) {
    await mainWindow.loadURL(indexURL)
  }

  // 是否支持打开超链接地址，需要确定下
  mainWindow.webContents.on('new-window', (event, url) => {
    event.preventDefault()
    shell.openExternal(url)
  })
}

// 启动程序
main().catch(handleException)
