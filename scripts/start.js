// setup需要最先执行
require('./lib/setup')('development')
//
const path = require('path')
const { format: urlFormat } = require('url')
const fetch = require('node-fetch')
const wait = require('wait-on')
const { log, createPrefixedLogger } = require('./lib/logger')
const { getAvailablePort, printErrorAndExit } = require('./lib/utils')
const { runWebpack, runScript } = require('./lib/runner')

// 运行构建
run().catch(printErrorAndExit)

async function run() {
  const {
    HTTPS,
    HOST,
    PORT,
    AUTO_RELAUNCH_DELAY,
    AUTO_RELAUNCH_APP,
    LOG_PREFIX_COLOR_MAIN,
    LOG_PREFIX_COLOR_RENDERER,
    LOG_PREFIX_COLOR_ELECTRON,
  } = process.env
  const port = await getAvailablePort(PORT)
  const indexURL = urlFormat({
    protocol: `http${HTTPS ? 's' : ''}`,
    hostname: HOST || 'localhost',
    port,
  })

  let main
  let electron

  //
  const beforeExit = (callback) => main && main.stop(callback)

  // Renderer
  runScript({
    logger: createPrefixedLogger('renderer', LOG_PREFIX_COLOR_RENDERER),
    script: require.resolve('@craco/craco/scripts/start', { paths: [process.cwd()] }),
    env: { PORT: `${port}`, BROWSER: 'none' },
    beforeExit,
  }).start()

  // Main
  main = runWebpack({
    logger: createPrefixedLogger('main', LOG_PREFIX_COLOR_MAIN),
    config: path.resolve('config/electron.webpack.js'),
    env: {
      APP_INDEX_HTML_URL: indexURL,
      WEBPACK_ELECTRON_ENTRY_PRELOAD: path.join(__dirname, './lib/preload.dev.js'),
    },
    watch: true,
    watchOptions: { aggregateTimeout: Math.max(+AUTO_RELAUNCH_DELAY || 0, 2000) },
    beforeWatchRun: () => log.info('Compiling the main files for changes... '),
    afterWatchRun: AUTO_RELAUNCH_APP && (() => electron && electron.pid && electron.restart()),
  })
  main.then(() => log.info('Watching the main files for updates...'))

  // 等待主进程和渲染进程代码构建完成
  await Promise.all([main, wait({ resources: [indexURL], delay: 2000 })])

  // Electron
  electron = runScript({
    logger: createPrefixedLogger('electron', LOG_PREFIX_COLOR_ELECTRON),
    env: { APP_INDEX_HTML_URL: indexURL },
    script: require('electron'),
    args: ['.'],
    windowsHide: false,
    beforeExit,
  })
    .on('restart', () => {
      sendRecompileRequest(indexURL)
      log.info('Relaunched the Electron.app')
    })
    .start()

  log.info('Launched the Electron.app')
}

function sendRecompileRequest(host) {
  // 需要renderer进程来进行全局的typescript类型检查
  fetch(`${host}/webpack-dev-server/invalidate?${Date.now()}`, {
    method: 'GET',
    cache: 'no-cache',
  }).catch(log.error)
}
