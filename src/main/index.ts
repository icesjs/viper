import { app, shell, BrowserWindow, dialog } from 'electron'
import { productionLogger } from './logger'
import AppUpdater from './updater'

/**
 * 应用配置对象
 */
interface ViperOptions {
  /**
   * 是否使用单实例应用
   */
  single?: boolean
  /**
   * 主窗口加载页面的地址
   */
  indexURL?: string
  /**
   * 主窗口是否需要集成node环境
   */
  nodeIntegration?: boolean
}

class Viper {
  /**
   * 构造函数
   * @param options
   */
  constructor(options?: ViperOptions) {
    this.options = options || { single: true, nodeIntegration: false, indexURL: '' }
    const boundHandleException = this.handleException.bind(this)
    process.on('uncaughtException', boundHandleException)
    process.on('unhandledRejection', boundHandleException)
  }

  /**
   * 当前运行环境是否时产品环境
   * @private
   */
  private readonly isEnvProduction = app.isPackaged || process.env.NODE_ENV !== 'development'

  /**
   * 配置项对象
   * @private
   */
  private readonly options: ViperOptions

  /**
   * 主窗口实例引用
   * @private
   */
  private mainWindow: BrowserWindow | null = null

  /**
   * 主程入口
   */
  main(): void {
    const { single } = this.options
    if (single && !this.checkInstanceLock()) {
      return app.quit()
    }

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit()
      }
    })

    // 创建窗口
    const boundCreateWindow = this.createWindow.bind(this)
    app.on('activate', boundCreateWindow)
    app.whenReady().then(boundCreateWindow)

    // 检查更新
    // 需要根据设置中是否检查更新来触发
    new AppUpdater().check().catch(productionLogger.error)
  }

  /**
   * 创建主窗口实例
   * @private
   */
  private async createWindow() {
    if (this.mainWindow !== null) {
      return
    }
    const { options, isEnvProduction } = this
    const { nodeIntegration, indexURL } = options

    // 创建窗口实例
    const window = (this.mainWindow = new BrowserWindow({
      title: app.name,
      show: false,
      width: 1024, // 宽高需要可定义
      height: 728,
      backgroundColor: 'transparent', // 初始背景色需要根据系统主题颜色自动设置
      // titleBarStyle: isEnvProduction ? 'hidden' : 'default',
      // vibrancy: 'ultra-dark',
      webPreferences: {
        nodeIntegration,
        enableRemoteModule: nodeIntegration,
        contextIsolation: !nodeIntegration,
        devTools: !app.isPackaged,
        webSecurity: isEnvProduction,
        allowRunningInsecureContent: true,
        scrollBounce: true,
        defaultEncoding: 'utf8',
        spellcheck: false,
        enableWebSQL: false,
      },
    }))

    window.once('ready-to-show', () => this.mainWindow?.show())
    window.once('closed', () => (this.mainWindow = null))

    if (indexURL) {
      await window.loadURL(indexURL)
    }

    // 是否支持打开超链接地址，需要确定下
    window.webContents.on('new-window', (event, url) => {
      event.preventDefault()
      shell.openExternal(url)
    })
  }

  /**
   * 处理运行时未捕获的异常
   * @param err
   * @private
   */
  private async handleException(err) {
    const { isEnvProduction } = this
    // 记录异常日志
    productionLogger.error(err)
    // 需要做国际化，产品模式，不能显示具体错误消息给用户
    const errMessage = isEnvProduction ? '' : err.message
    await dialog.showErrorBox('发生了一个错误！', errMessage)
    if (isEnvProduction) {
      process.nextTick(() => process.exit(1))
    }
  }

  /**
   * 检查单实例锁
   * @private
   */
  private checkInstanceLock(): boolean {
    if (app.requestSingleInstanceLock()) {
      app.on('second-instance', () => {
        // 运行第二个实例时
        const window = this.mainWindow
        if (window) {
          if (window.isMinimized()) {
            window.restore()
          }
          window.focus()
        }
      })
      return true
    }
    return false
  }
}

// 启动应用
new Viper({
  single: true,
  indexURL: process.env.ELECTRON_APP_INDEX_HTML_URL,
  nodeIntegration: !!process.env.ELECTRON_APP_NODE_INTEGRATION,
}).main()
