const devToolsInstaller = require('electron-devtools-installer')
const { app, dialog, shell, BrowserWindow } = require('electron')
const isChina = /^cn$/i.test(app.getLocaleCountryCode())
const open = (url, opts) => shell.openExternal(url, opts)

module.exports = function getContextMenuTemplate(window, { x, y }) {
  return [
    {
      label: isChina ? '刷新页面' : 'Reload',
      accelerator: 'CmdOrCtrl+R',
      click: () => window.webContents.reloadIgnoringCache(),
    },
    { type: 'separator' },
    {
      label: isChina ? '重启应用' : 'Relaunch',
      click: async () => {
        const { response } = await dialog.showMessageBox(window, {
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
          app.exit(15)
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
          click: () => open(`https://nodejs.org/${isChina ? 'zh-cn' : 'en'}/docs/`),
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
    {
      label: isChina ? '更新扩展插件' : 'Update Extensions',
      submenu: [
        {
          label: 'React Developer Tools',
          click: () => updateExtensions(devToolsInstaller.REACT_DEVELOPER_TOOLS),
        },
        {
          label: 'Redux Devtools',
          click: () => updateExtensions(devToolsInstaller.REDUX_DEVTOOLS),
        },
      ],
    },
    { type: 'separator' },
    {
      label: isChina ? '开发人员工具' : 'Toggle Developer Tools',
      accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
      click: () => window.webContents.toggleDevTools(),
    },
    {
      label: isChina ? '检查元素' : 'Inspect element',
      click: () => window.inspectElement(x, y),
    },
  ]
}

//
async function updateExtensions(extension) {
  const title = isChina ? '更新扩展插件' : 'Update Extensions'
  try {
    await devToolsInstaller.default(extension, true)
    await dialog.showMessageBox(BrowserWindow.getFocusedWindow(), {
      title,
      type: 'info',
      message: isChina ? '更新成功' : 'Update successfully',
      buttons: [isChina ? '好的' : 'OK'],
    })
  } catch (e) {
    await dialog.showErrorBox(`${title}${isChina ? '失败' : ' Failed'}`, `${e.message}`)
    await open(`https://chrome.google.com/webstore/detail/${extension.id}`)
  }
}
