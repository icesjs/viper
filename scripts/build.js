// setup需要最先执行
require('./lib/setup')('production')

//
const path = require('path')
const concurrently = require('concurrently')
const { RENDERER_BUILD_PATH, MAIN_BUILD_PATH } = require('../config/consts')
const { relativePath, printProcessErrorAndExit } = require('./lib/utils')
const { PROCESS_DETACHED } = require('./lib/electron.helper')

// 运行构建
run().catch(printProcessErrorAndExit)

async function run() {
  const { DEBUG, GENERATE_SOURCEMAP } = process.env
  const isDebugMode = DEBUG !== 'false'
  const absIndexPath = path.resolve(RENDERER_BUILD_PATH, 'index.html')
  const relIndexPath = relativePath(MAIN_BUILD_PATH, absIndexPath)

  await concurrently(
    [
      {
        // #进程1 进行main代码构建打包
        name: '   compile-main   ',
        command: 'webpack -c config/electron.webpack.js --no-color',
        env: {
          ...process.env,
          APP_INDEX_HTML_PATH: relIndexPath,
          WEBPACK_ELECTRON_ENTRY_PRELOAD: require.resolve('./lib/preload.prod.js'),
        },
      },
      // 进程2，进行renderer内容构建打包
      {
        name: ' compile-renderer ',
        command: 'craco build',
        env: { ...process.env, GENERATE_SOURCEMAP: isDebugMode || GENERATE_SOURCEMAP },
      },
    ],
    {
      killOthers: ['failure', 'failure'],
      successCondition: 'all',
    }
  )

  // 开启调试模式，启动Electron应用
  if (isDebugMode) {
    await concurrently([
      {
        name: '   electron-app   ',
        command: `node scripts/lib/${PROCESS_DETACHED ? 'electron.win' : 'electron.main'}`,
        env: { ...process.env },
      },
    ])
  }
}
