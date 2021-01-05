const path = require('path')
const crypto = require('crypto')
const { promisify } = require('util')
const fs = require('fs-extra')
const unzip = require('unzip-crx-3')
const { app } = require('electron')

/**
 * 加载扩展至会话
 * @param win
 * @param crxFolder
 * @returns {Promise<void>}
 */
async function loadExtensions(win, crxFolder) {
  const { webContents } = win
  if (!webContents.isDevToolsOpened()) {
    await webContents.session.loadExtension(crxFolder)
    if (!webContents.isLoading()) {
      await new Promise(async (resolve) => {
        webContents.once('dom-ready', resolve)
        webContents.reloadIgnoringCache()
      })
    }
    return
  }
  await new Promise((resolve, reject) => {
    webContents.once('devtools-closed', async () => {
      try {
        await webContents.session.loadExtension(crxFolder)
        webContents.once('dom-ready', () => {
          webContents.openDevTools()
          resolve()
        })
        webContents.reloadIgnoringCache()
      } catch (e) {
        reject(e)
      }
    })
    webContents.closeDevTools()
  })
}

/**
 * 安装浏览器插件
 * @param win
 * @param crx
 * @param force
 * @returns {Promise<void>}
 */
async function installExtensions(win, crx, force = false) {
  const home = fs.realpathSync(app.getPath('userData'))
  const crxFolder = path.join(home, 'extensions', crx.id)
  let installed = !!(fs.existsSync(crxFolder) && fs.readdirSync(crxFolder).length)
  if (installed && force) {
    await fs.emptyDir(crxFolder)
    installed = false
  }
  if (!installed) {
    await fs.ensureDir(crxFolder)
    await unzip(crx.path, crxFolder)
    fs.removeSync(path.join(crxFolder, '_metadata'))
    changePermissions(crxFolder, 755)
  }
  await loadExtensions(win, crxFolder)
}

/**
 * 从本地文件安装插件
 * @param win
 * @param crx
 * @param force
 * @returns {Promise<*>}
 */
async function installFromLocalFile(win, crx, force) {
  const content = await promisify(fs.readFile)(crx.path)
  const hash = crypto.createHash('sha1')
  hash.update(content)
  const extensions = { ...crx, id: hash.digest('hex').substr(0, 32) }
  await installExtensions(win, extensions, force)
}

/**
 * 更改目录权限
 * @param dir
 * @param mode
 */
function changePermissions(dir, mode) {
  for (const file of fs.readdirSync(dir)) {
    const absPath = path.join(dir, file)
    fs.chmodSync(absPath, parseInt(mode, 8))
    if (fs.statSync(absPath).isDirectory()) {
      changePermissions(absPath, mode)
    }
  }
}

/**
 * 获取插件的基本信息
 * @param store
 * @param crx
 * @returns {{path: string, name: string, version: (*|string)}}
 */
function getExtensionsBasicInfo(store, crx) {
  const basename = path.basename(crx, '.crx')
  const version = basename.match(/[-_]?\d+(?:\.\d+)*(?:[-_][a-zA-Z])?$/g)
  const crxName = version ? basename.replace(version[0], '') : basename
  return {
    path: path.join(store, crx),
    name: crxName.replace(
      /^(.)|([-_])(.)/g,
      (m, c1, c2, c3) => `${c2 ? ' ' : ''}${(c1 || c3).toUpperCase()}`
    ),
    version: version ? version[0].substr(1) : '',
  }
}

/**
 * 获取本地插件列表
 * @param dir
 * @returns {{path: string, name: string, version: (*|string)}[]|*[]}
 */
function getLocalExtensions(dir) {
  const store = path.resolve(dir)
  if (fs.existsSync(store)) {
    return fs
      .readdirSync(store)
      .filter((file) => file.endsWith('.crx'))
      .map((crx) => getExtensionsBasicInfo(store, crx))
  }
  return []
}

/**
 * 从目录安装该目录下的所有插件
 * @param win
 * @param dir
 * @param force
 * @returns {Promise<void>}
 */
async function installFromLocalStore(win, dir, force) {
  for (const crx of getLocalExtensions(dir)) {
    try {
      await installFromLocalFile(win, crx, force)
    } catch (e) {
      console.error(e)
    }
  }
}

module.exports = {
  installFromLocalStore,
  installFromLocalFile,
  getLocalExtensions,
}
