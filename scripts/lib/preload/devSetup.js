// 开发模式下才会加载此脚本
const fs = require('fs')
const url = require('url')
const path = require('path')
const yaml = require('js-yaml')

//
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
const {
  USE_MODULE_PROXY_FOR_ELECTRON,
  AUTO_OPEN_DEV_TOOLS,
  ENABLE_DEV_CONTEXT_MENU,
  ELECTRON_BUILDER_CONFIG = 'pack.yml',
  BROWSER_EXTENSIONS_DIR = 'extensions',
} = process.env

const { installFromLocalStore } = require('./devExtensions')
const contextMenu = ENABLE_DEV_CONTEXT_MENU !== 'false' ? require('./devToolsMenu') : null
const { app } = USE_MODULE_PROXY_FOR_ELECTRON !== 'false' ? proxyElectron() : require('electron')

//
app.on('browser-window-created', (e, win) => setupDevTools(win))

//
async function setupDevTools(win) {
  if (contextMenu) {
    win.webContents.on('context-menu', (e, { x, y }) => contextMenu.popup({ x, y, window: win }))
  }
  await installFromLocalStore(win, BROWSER_EXTENSIONS_DIR)
  win.webContents.on('console-message', (event, level, message, line, source) => {
    const { pathname, protocol } = url.parse(source || '')
    if (level === 3 && (pathname === '/' || protocol === 'chrome-extension:')) {
      // 清空插件输出的错误消息
      event['sender'].executeJavaScript('console.clear()', false).catch(() => {})
    }
  })
  if (AUTO_OPEN_DEV_TOOLS !== 'false') {
    autoOpenDevTools(win)
  }
}

//
function autoOpenDevTools(win) {
  if (win.isVisible()) {
    win.webContents.openDevTools()
  } else {
    win.once('show', () => win.webContents.openDevTools())
  }
}

//
function proxyElectron() {
  const modulePath = require.resolve('electron')
  let cachedModule = require.cache[modulePath]
  if (!cachedModule) {
    require('electron')
    cachedModule = require.cache[modulePath]
  }
  const newExports = {}
  const exports = cachedModule.exports
  const { app, Menu, BrowserWindow } = exports
  const proxies = {
    app: proxyElectronApp(app),
    Menu: proxyElectronMenu(Menu),
    BrowserWindow: proxyElectronBrowserWindow(BrowserWindow),
  }
  for (const key of Object.keys(exports)) {
    const descriptor = Reflect.getOwnPropertyDescriptor(exports, key)
    const proxy = proxies[key]
    const newDescriptor = proxy ? { ...descriptor, get: () => proxy } : descriptor
    Reflect.defineProperty(newExports, key, newDescriptor)
  }
  cachedModule.exports = newExports
  return newExports
}

//
function proxyElectronBrowserWindow(BrowserWindow) {
  return new Proxy(BrowserWindow, {
    construct(target, args) {
      return proxyBrowserWindowInstance(target, args[0])
    },
  })
}

//
function proxyBrowserWindowInstance(BrowserWindow, opts) {
  const options = Object.assign(
    {
      icon: getAppWindowIcon(),
    },
    opts
  )
  let getInstance
  const created = (ins) => getInstance && getInstance(ins)
  const afterCreated = (get) => (getInstance = get)
  const methodProxies = {
    show: proxyBrowserWindowInstanceShow(options, afterCreated),
  }

  let instanceTarget
  const instanceProxy = Proxy.revocable((instanceTarget = new BrowserWindow(options)), {
    get(target, propKey) {
      const getMethodProxy = methodProxies[propKey]
      if (getMethodProxy) {
        const proxy = getMethodProxy(target, instanceProxy.proxy)
        if (proxy) {
          return proxy
        }
      }
      const propValue = target[propKey]
      if (typeof propValue === 'function') {
        return new Proxy(propValue, {
          apply(tar, ctx, args) {
            return Reflect.apply(tar, ctx === instanceProxy.proxy ? target : tar, args)
          },
        })
      }
      return propValue
    },
  })

  instanceTarget.on('closed', () => {
    process.nextTick(() => instanceProxy.revoke())
  })

  created(instanceTarget)
  return instanceProxy.proxy
}

//
function proxyBrowserWindowInstanceShow(opts, afterCreated) {
  if (process.env.WINDOW_FIRST_SHOW_INACTIVE === 'false') {
    return
  }
  const { show: defaultShow } = opts
  afterCreated((ins) => {
    if (defaultShow) {
      ins.showInactive()
    }
  })

  opts.show = false
  return (target, instanceProxy) => {
    if (target.getParentWindow()) {
      return
    }
    let firstShowed = false
    return function show(...args) {
      if (this === instanceProxy) {
        if (!firstShowed) {
          target.showInactive()
          firstShowed = true
          return
        }
        return Reflect.apply(target.show, target, args)
      }
      return Reflect.apply(target.show, this, args)
    }
  }
}

//
function proxyElectronApp(app) {
  return app
}

//
function proxyElectronMenu(Menu) {
  return Menu
}

// 获取应用的图标路径
function getAppWindowIcon() {
  // 生产打包模式下，应用会使用打包进可执行程序中的图标
  // 此处获取图标仅在开发模式下执行
  try {
    const configPath = path.resolve(ELECTRON_BUILDER_CONFIG)
    if (!fs.existsSync(configPath)) {
      return
    }
    const config = yaml.safeLoad(fs.readFileSync(configPath, 'utf8'))
    const platformConfig =
      config[
        {
          win32: 'win',
          darwin: 'mac',
          linux: 'linux',
        }[process.platform]
      ]
    if (platformConfig) {
      const icon = path.resolve(platformConfig.icon)
      if (fs.existsSync(icon)) {
        return icon
      }
    }
  } catch (e) {}
}
