const path = require('path')
const respawn = require('respawn')
const chokidar = require('chokidar')
const fetch = require('node-fetch')
const kill = require('tree-kill')
const { debounce } = require('throttle-debounce')
const { MAIN_BUILD_PATH, MAIN_BUILD_FILE_NAME } = require('../../config/consts')
const { log, registerShutdown, PROJECT_CONTEXT: cwd } = require('./utils')

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
  const { NODE_ENV, AUTO_RELAUNCH_APP, AUTO_RELAUNCH_DELAY } = process.env
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
  const mainFilePath = path.join(MAIN_BUILD_PATH, MAIN_BUILD_FILE_NAME)

  const watcher = chokidar.watch(mainFilePath, {
    disableGlobbing: true,
    ignoreInitial: true,
    awaitWriteFinish: false,
    cwd: MAIN_BUILD_PATH,
  })

  log.info('Watching the electron entry file for updates...')

  watcher.on('all', () => {
    log.info('Electron entry file has been updated')
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
  const { APP_INDEX_HTML_URL } = process.env
  const url = `${APP_INDEX_HTML_URL}/webpack-dev-server/invalidate?${Date.now()}`
  //
  await fetch(url, {
    method: 'GET',
    cache: 'no-cache',
  }).catch(log.error)
}
