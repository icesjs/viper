const path = require('path')
const respawn = require('respawn')
const chokidar = require('chokidar')
const fetch = require('node-fetch')
const kill = require('tree-kill')
const { debounce } = require('throttle-debounce')
const {
  MAIN_BUILD_PATH,
  MAIN_BUILD_FILE_NAME,
  NATIVE_ADDONS_OUTPUT_PATH,
} = require('../../config/consts')
const { NODE_ENV, AUTO_RELAUNCH_APP, AUTO_RELAUNCH_DELAY, APP_INDEX_HTML_URL } = process.env
const { registerShutdown, PROJECT_CONTEXT: cwd } = require('./utils')
const { log } = require('./logger')

const command = ['electron', '.']
monitorCrash(command, {
  cwd,
  name: command[0],
  stdio: 'inherit',
  maxRestarts: -1,
  kill: 1000,
  sleep: 100,
  fork: false,
})

//
function monitorCrash(cmd, opts) {
  let mo = respawn(cmd, opts)
  const stop = () => {
    if (mo) {
      mo.stop()
      mo = null
      log.info('Stopped the Electron.app process')
    }
  }

  mo.on('exit', (code) => {
    if (code === 0) {
      stop()
    }
  })
  //
  setFileChangeWatcher(mo, sendRecompileRequest)
  mo.start()

  registerShutdown(stop)

  log.info('Created the monitor for the running Electron.app')
  return mo
}

function setFileChangeWatcher(mo, callback) {
  if (NODE_ENV !== 'development') {
    return
  }

  let childProcess
  const autoRelaunch = AUTO_RELAUNCH_APP !== 'false'

  const changeHandle = debounce(+AUTO_RELAUNCH_DELAY || 5000, false, async () => {
    await callback()

    if (childProcess && autoRelaunch) {
      const { pid } = childProcess
      childProcess = null
      kill(pid, 'SIGTERM')

      log.info('Restarting the running Electron.app')
    }
  })

  let watcher
  mo.on('spawn', (child) => {
    childProcess = child
    log.info(`${watcher ? 'Relaunched' : 'Launched'} the Electron.app`)

    if (!watcher) {
      watcher = watchChange(changeHandle)
    }
  })

  mo.on('exit', async (code) => {
    if (code === 0 && watcher) {
      let w = watcher
      watcher = null
      await w.close()
    }
  })
}

//
function watchChange(callback) {
  const mainFilePath = path.resolve(MAIN_BUILD_PATH, MAIN_BUILD_FILE_NAME)
  const addonsDir = path.resolve(NATIVE_ADDONS_OUTPUT_PATH)

  const watcher = chokidar.watch([mainFilePath, addonsDir], {
    disableGlobbing: true,
    ignoreInitial: true,
    awaitWriteFinish: false,
    cwd: MAIN_BUILD_PATH,
  })

  log.info('Watching the electron app file for updates...')

  watcher.on('all', () => {
    log.info(`Electron app file has been updated (will restarting after ${AUTO_RELAUNCH_DELAY} ms)`)
    callback && callback()
  })

  const fn = watcher.close
  watcher['close'] = async () => {
    await fn.call(watcher)
    log.info('Closed the electron entry file watcher')
  }

  registerShutdown(watcher.close)

  return watcher
}

// 发送HTTP请求至开发服务器，请求执行重新编译
async function sendRecompileRequest() {
  const url = `${APP_INDEX_HTML_URL}/webpack-dev-server/invalidate?${Date.now()}`
  //
  await fetch(url, {
    method: 'GET',
    cache: 'no-cache',
  }).catch(log.error)
}
