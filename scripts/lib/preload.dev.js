// 开发模式下才会加载此脚本
// 用于设置辅助开发工具等

const { app, Menu } = require('electron')
const getContextMenuTemplate = require('./menu.dev')

app.commandLine.appendSwitch('enable-logging', 'true')
app.commandLine.appendSwitch('enable-stack-dumping', 'true')
app.commandLine.appendSwitch('v', '-1')

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

app.on('browser-window-created', (e, window) => {
  if (!/^false$/.test(process.env.ELECTRON_AUTO_OPEN_DEV_TOOLS)) {
    autoOpenDevTools(window)
  }
  window.webContents.on('context-menu', (e, cord) => {
    const menu = Menu.buildFromTemplate(getContextMenuTemplate(window, cord))
    menu.popup({ window })
  })
})

function autoOpenDevTools(window) {
  window.once('show', () => window.webContents.openDevTools())
}
