// setup需要最先执行
require('./lib/setup')('production')
//

const path = require('path')
const { promisify } = require('util')
const fs = require('fs-extra')
const { log, createPrefixedLogger } = require('./lib/logger')
const { relativePath, getPackageJson, printErrorAndExit } = require('./lib/utils')
const { runScript, runWebpack } = require('./lib/runner')
const { RENDERER_BUILD_PATH, MAIN_BUILD_PATH, APP_BUILD_PATH } = require('../config/consts')

// 运行构建
run().catch(printErrorAndExit)

async function run() {
  const {
    ENABLE_PRODUCTION_DEBUG,
    LOG_PREFIX_COLOR_MAIN,
    LOG_PREFIX_COLOR_RENDERER,
    LOG_PREFIX_COLOR_ELECTRON,
  } = process.env
  const absIndexPath = path.resolve(RENDERER_BUILD_PATH, 'index.html')
  const relIndexPath = relativePath(MAIN_BUILD_PATH, absIndexPath)

  // Renderer
  const renderer = runScript({
    logger: createPrefixedLogger('renderer', LOG_PREFIX_COLOR_RENDERER),
    script: require.resolve('@craco/craco/scripts/build', { paths: [process.cwd()] }),
    exitHandle: (code) => code !== 0 && process.exit(code),
  }).start()

  // Main
  const main = runWebpack({
    logger: createPrefixedLogger('main', LOG_PREFIX_COLOR_MAIN),
    config: path.resolve('config/electron.webpack.js'),
    env: {
      APP_INDEX_HTML_PATH: relIndexPath,
      WEBPACK_ELECTRON_ENTRY_PRELOAD: path.join(__dirname, './lib/preload.prod.js'),
    },
  })

  await Promise.all([renderer, main, createPackageJson()])

  if (ENABLE_PRODUCTION_DEBUG !== 'false') {
    log.info('Launch the Electron.app for debug production')
    // Electron
    runScript({
      logger: createPrefixedLogger('electron', LOG_PREFIX_COLOR_ELECTRON),
      script: require('electron'),
      args: ['.'],
      windowsHide: false,
      cwd: APP_BUILD_PATH,
    }).start()
  }
}

// 生成打包用的package.json
async function createPackageJson() {
  const { name, version } = getPackageJson()
  const mainFile = process.env.ELECTRON_MAIN_ENTRY_PATH
  const main = relativePath(APP_BUILD_PATH, mainFile, false)
  await promisify(fs.outputFile)(
    path.resolve(APP_BUILD_PATH, 'package.json'),
    JSON.stringify({
      main,
      name,
      version,
      private: true,
    })
  )
}
