const path = require('path')
const respawn = require('respawn')
const chokidar = require('chokidar')
const kill = require('tree-kill')
const { debounce } = require('throttle-debounce')
const { MAIN_BUILD_PATH, MAIN_BUILD_FILE_NAME } = require('../../config/consts')
const { log, registerShutdown } = require('./utils')

const command = ['electron', '.']
monitorCrash(command, {
  cwd: process.cwd(),
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
  setRelaunchWatcher(mo)
  //
  mo.start()

  registerShutdown(stop)

  log.info('Created the monitor for the running Electron.app')
  return mo
}

function setRelaunchWatcher(mo) {
  const { AUTO_RELAUNCH_APP, NODE_ENV } = process.env
  if (AUTO_RELAUNCH_APP !== 'false' && NODE_ENV === 'development') {
    let watcher
    const mainFilePath = path.join(MAIN_BUILD_PATH, MAIN_BUILD_FILE_NAME)
    //
    mo.on('spawn', () => {
      log.info(`${watcher ? 'Relaunched' : 'Launched'} the Electron.app`)
      if (!watcher || watcher.closed) {
        watcher = watchChange(mainFilePath, mo)
      }
    })
  }
}

//
function watchChange(file, mo) {
  let process = null
  let watcher = chokidar.watch(file, {
    disableGlobbing: true,
    ignoreInitial: true,
    awaitWriteFinish: false,
    cwd: MAIN_BUILD_PATH,
  })

  watcher.on(
    'all',
    debounce(5000, true, () => {
      if (process) {
        let p = process
        process = null
        kill(p['pid'], 'SIGTERM')
        log.info('Electron entry file has been changed. Restarting the running Electron.app')
      }
    })
  )

  const close = async () => {
    if (watcher) {
      process = null
      await watcher.close()
      watcher.closed = true
      watcher = null
      log.info('Closed the electron entry file watcher')
    }
  }
  //
  mo.on('exit', async (code) => {
    process = null
    if (code === 0) {
      await close()
    }
  })

  mo.on('spawn', (p) => (process = p))

  registerShutdown(close)

  log.info('Watching the electron entry file for updates...')
  return watcher
}
