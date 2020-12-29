// setup需要最先执行
require('./lib/setup')('production')
//
const path = require('path')
const { log, createPrefixedLogger } = require('./lib/logger')
const { relativePath } = require('./lib/utils')
const { runScript, runWebpack } = require('./lib/runner')
const { RENDERER_BUILD_PATH, MAIN_BUILD_PATH } = require('../config/consts')

// 运行构建
run().catch((err) => {
  log.error(err)
  process.exit(1)
})

async function run() {
  const {
    ENABLE_PRODUCTION_DEBUG,
    LOG_PREFIX_COLOR_MAIN,
    LOG_PREFIX_COLOR_RENDERER,
    LOG_PREFIX_COLOR_ELECTRON,
  } = process.env
  const absIndexPath = path.resolve(RENDERER_BUILD_PATH, 'index.html')
  const relIndexPath = relativePath(MAIN_BUILD_PATH, absIndexPath)

  // Main
  const mainRunner = runWebpack({
    logger: createPrefixedLogger('main', LOG_PREFIX_COLOR_MAIN),
    config: path.resolve('config/electron.webpack.js'),
    env: {
      APP_INDEX_HTML_PATH: relIndexPath,
      WEBPACK_ELECTRON_ENTRY_PRELOAD: path.join(__dirname, './lib/preload.prod.js'),
    },
  })

  // Renderer
  const rendererRunner = runScript({
    logger: createPrefixedLogger('renderer', LOG_PREFIX_COLOR_RENDERER),
    script: require.resolve('@craco/craco/scripts/build', { paths: [process.cwd()] }),
    exitHandle: (code) => code !== 0 && process.exit(code),
  })

  await Promise.all([mainRunner, rendererRunner.awaitExit()])

  if (ENABLE_PRODUCTION_DEBUG) {
    log.info('Launch the Electron.app for production debug')
    // Electron
    runScript({
      logger: createPrefixedLogger('electron', LOG_PREFIX_COLOR_ELECTRON),
      script: require('electron'),
      args: ['.'],
      windowsHide: false,
    }).start()
  }
}
