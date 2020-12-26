const path = require('path')
const fetch = require('node-fetch')
const respawn = require('./respawn')
const watch = require('./watch')
const { createLogger } = require('./logger')
const { registerShutdown, getInstalledCommandPath } = require('./utils')

const log = createLogger('builder-scripts:app', true)

const {
  MAIN_BUILD_PATH,
  MAIN_BUILD_FILE_NAME,
  NATIVE_ADDONS_OUTPUT_PATH,
} = require('../../config/consts')

const { NODE_ENV, AUTO_RELAUNCH_APP, AUTO_RELAUNCH_DELAY, APP_INDEX_HTML_URL } = process.env

run().catch(log.error)

async function run() {
  const exe = getInstalledCommandPath('electron')
  const monitor = respawn(exe, ['.'], {
    sleep: 300,
    maxRestarts: 3,
    stdio: 'inherit', // 不要改变此项的值
  })

  monitor.start().then(() => {})

  log.info('Launched the Electron.app')

  const watcher = createFileWatcher()
  if (watcher) {
    watcher.on('all', () => {
      monitor.restart()
      log.info(`Electron entry files has been updated`)
    })
    log.info('Watching the entry file of electron for updates...')
    watcher.on('close', () => {
      log.info('Closed the electron entry file watcher')
    })
  }

  monitor.on('restart', () => {
    log.info('Relaunching the Electron.app')
    sendRecompileRequest()
  })

  monitor.on('error', async (err) => {
    if (err.exitCode !== 15) {
      // exitCode=15 为开发菜单里重启时的设置的退出码
      log.error(err)
      if (watcher) {
        await watcher.close()
      }
    }
  })

  monitor.on('exit', async () => {
    if (watcher) {
      await watcher.close()
    }
  })

  registerShutdown(async () => {
    await Promise.all([watcher && watcher.close(), monitor.stop()])
  })
}

// 监听主进程入口文件变更，触发应用重启
function createFileWatcher() {
  if (NODE_ENV === 'development' && AUTO_RELAUNCH_APP) {
    const entryPath = path.resolve(MAIN_BUILD_PATH, MAIN_BUILD_FILE_NAME)
    const addonsPath = path.resolve(NATIVE_ADDONS_OUTPUT_PATH)
    const watcher = watch([entryPath, addonsPath], {
      debounceDelay: +AUTO_RELAUNCH_DELAY || 5000,
      debounceAtBegin: false,
      cwd: MAIN_BUILD_PATH,
    })
    watcher.once('close', () => {
      log.info('Closed the electron entry file watcher')
    })
    return watcher
  }
}

// 发送HTTP请求至开发服务器，请求执行重新编译
async function sendRecompileRequest() {
  const url = `${APP_INDEX_HTML_URL}/webpack-dev-server/invalidate?${Date.now()}`
  await fetch(url, {
    method: 'GET',
    cache: 'no-cache',
  }).catch(log.error)
}
