const path = require('path')
const respawn = require('respawn')
const chokidar = require('chokidar')
const kill = require('tree-kill')
const { debounce } = require('throttle-debounce')
const { log } = require('./utils')

const { MAIN_BUILD_PATH, MAIN_BUILD_FILE_NAME } = require('../../config/consts')
const mainFilePath = path.join(MAIN_BUILD_PATH, MAIN_BUILD_FILE_NAME)
const autoRelaunch = !/^false$/.test(process.env.AUTO_RELAUNCH_APP)

const command = ['electron', `${mainFilePath}`]
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
  const mo = respawn(cmd, opts)
  mo.on('exit', (code) => {
    if (code === 0) {
      log.info('Stopped the Electron.app process')
      mo.stop()
    }
  })
  if (autoRelaunch) {
    let watcher = watchChange(mainFilePath, mo)
    mo.on('spawn', () => {
      log.info('Relaunched the Electron.app')
      if (watcher.closed) {
        watcher = watchChange(mainFilePath, mo)
      }
    })
  }
  mo.start()
  log.info('Created the monitor for running of the Electron.app')
  return mo
}

//
function watchChange(file, mo) {
  let process = null
  const watcher = chokidar.watch(file, {
    disableGlobbing: true,
    ignoreInitial: true,
    awaitWriteFinish: false,
  })
  watcher.on(
    'all',
    debounce(5000, true, () => {
      if (process) {
        let p = process
        process = null
        kill(p['pid'], 'SIGTERM')
        log.info('Electron entry file has been changed. Kill the running Electron.app to restart')
      }
    })
  )
  //
  mo.on('exit', async (code) => {
    process = null
    if (code === 0) {
      await watcher.close()
      watcher.closed = true
      log.info('Closed the electron entry file watcher')
    }
  })
  mo.on('spawn', (p) => (process = p))
  log.info('Watching the electron entry file for updates...')
  return watcher
}
