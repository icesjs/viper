// 开发模式下，初始化开发辅助菜单

const { app, dialog, shell, BrowserWindow, Menu } = require('electron')
const { getLocalExtensions, installFromLocalFile } = require('./extensions')

const isChina = /^cn$/i.test(app.getLocaleCountryCode())
const open = (url, opts) => shell.openExternal(url, opts)

/**
 * 获取上下文菜单所属的窗口对象
 * @param context
 * @returns {any|Electron.BrowserWindow}
 */
function getContextWindow(context) {
  return context.window || BrowserWindow.getFocusedWindow()
}

/**
 * 获取菜单模板
 * @param context
 */
function getTemplate(context) {
  const extensions = getLocalExtensions(process.env.BROWSER_EXTENSIONS_DIR || 'extensions')
  return [
    {
      label: isChina ? '刷新页面' : 'Reload',
      accelerator: 'CmdOrCtrl+R',
      click: () => getContextWindow(context).webContents.reloadIgnoringCache(),
    },
    { type: 'separator' },
    {
      label: isChina ? '重启应用' : 'Relaunch',
      click: async () => {
        const { response } = await dialog.showMessageBox(getContextWindow(context), {
          title: isChina ? '重启应用' : 'Restart The Application',
          type: 'question',
          message: isChina
            ? '你确定要立即重启应用吗？'
            : 'Are you sure you want to restart the app immediately?',
          buttons: [isChina ? '取消' : 'Cancel', isChina ? '重启' : 'Yes'],
          cancelId: 0,
          defaultId: 1,
        })
        if (response) {
          // 退出码15不能更改，构建工具需要用到这个值
          app.exit(15)
        }
      },
    },
    {
      label: isChina ? '退出应用' : 'Quit',
      click: async () => {
        const { response } = await dialog.showMessageBox(getContextWindow(context), {
          title: isChina ? '退出应用' : 'Quit The Application',
          type: 'question',
          message: isChina
            ? '你确定要现在退出应用吗？'
            : 'Are you sure you want to quit the app immediately?',
          buttons: [isChina ? '取消' : 'Cancel', isChina ? '退出' : 'Yes'],
          cancelId: 0,
          defaultId: 1,
        })
        if (response) {
          app.quit()
        }
      },
    },
    { type: 'separator' },
    {
      label: isChina ? '在线资源' : 'Online Help',
      submenu: [
        {
          label: isChina ? 'React文档' : 'React Documentation',
          click: () =>
            open(`https://${isChina ? 'zh-hans.' : ''}reactjs.org/docs/getting-started.html`),
        },
        {
          label: isChina ? 'Node.js文档' : 'Node.js Documentation',
          click: () => open(isChina ? 'http://nodejs.cn/api/' : `https://nodejs.org/docs/`),
        },
        {
          label: isChina ? 'Electron文档' : 'Electron Documentation',
          click: () => open('https://www.electronjs.org/docs/'),
        },
        {
          label: isChina ? 'TypeScript文档' : 'TypeScript Documentation',
          click: () => open(`https://www.typescriptlang.org/${isChina ? 'zh/' : ''}docs/`),
        },
        { type: 'separator' },
        {
          label: isChina ? 'Electron社区' : 'Community Discussions',
          click: () => open('https://www.electronjs.org/community'),
        },
        {
          label: isChina ? '查找Electron缺陷' : 'Search Issues',
          click: () => open('https://github.com/electron/electron/issues'),
        },

        { type: 'separator' },
        {
          label: isChina ? 'NPM首页' : 'Site of NPM',
          click: () => open('https://www.npmjs.com'),
        },
        {
          label: isChina ? 'Github首页' : 'Site of Github',
          click: () => open('https://github.com/'),
        },
        {
          label: isChina ? 'Electron首页' : 'Site of Electron',
          click: () => open('https://electronjs.org'),
        },
      ],
    },
    extensions.length && {
      label: isChina ? '重新安装扩展插件' : 'Reinstall Extensions',
      submenu: extensions.map((crx) => ({
        label: crx.name,
        click: () => installExtensions(context, crx),
      })),
    },
    { type: 'separator' },
    {
      label: isChina ? '开发人员工具' : 'Toggle Developer Tools',
      accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
      click: () => getContextWindow(context).webContents.toggleDevTools(),
    },
    {
      label: isChina ? '检查元素' : 'Inspect element',
      click: () => getContextWindow(context).inspectElement(context.x, context.y),
    },
  ].filter(Boolean)
}

/**
 * 创建上下文菜单
 * @returns {Electron.Menu|*}
 */
function createContextMenu() {
  const context = {
    x: 0,
    y: 0,
    window: null,
  }
  //
  return new Proxy(Menu.buildFromTemplate(getTemplate(context)), {
    get(target, prop, receiver) {
      const val = target[prop]
      if (prop === 'popup') {
        return new Proxy(val, {
          apply(popup, thisArg, args) {
            const { callback } = Object.assign(context, args[0])
            args[0] = Object.assign({}, args[0], {
              callback() {
                process.nextTick(() => (context.window = null))
                callback && callback()
              },
            })
            return Reflect.apply(popup, thisArg === receiver ? target : thisArg, args)
          },
        })
      }
      return val
    },
  })
}

/**
 * 重新安装扩展插件
 * @param context
 * @param crx
 * @returns {Promise<void>}
 */
async function installExtensions(context, crx) {
  const title = isChina ? '安装扩展插件' : 'Install Extensions'
  const win = getContextWindow(context)
  try {
    await installFromLocalFile(win, crx, true)
    await dialog.showMessageBox(win, {
      title,
      type: 'info',
      message: isChina ? '安装成功' : 'Installed successfully',
      buttons: [isChina ? '好的' : 'OK'],
    })
  } catch (e) {
    dialog.showErrorBox(`${title}${isChina ? '失败' : ' Failed'}`, `${e.message}`)
  }
}

//
module.exports = createContextMenu()
