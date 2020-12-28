// 开发模式下才会加载此脚本

const getContextMenuTemplate = require('./menu.dev')

const useModuleProxy = process.env.USE_MODULE_PROXY_FOR_ELECTRON !== 'false'
const { app, Menu } = useModuleProxy ? proxyElectron() : require('electron')

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

app.on('browser-window-created', (e, window) => {
  if (process.env.ELECTRON_AUTO_OPEN_DEV_TOOLS !== 'false') {
    autoOpenDevTools(window)
  }
  window.webContents.on('context-menu', (e, cord) => {
    const menu = Menu.buildFromTemplate(getContextMenuTemplate(window, cord))
    menu.popup({ window })
  })
})

//
function autoOpenDevTools(window) {
  window['once']('show', () => window.webContents.openDevTools())
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
  const options = Object.assign({}, opts)
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
