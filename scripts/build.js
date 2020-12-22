const path = require('path')
const concurrently = require('concurrently')
const { RENDERER_BUILD_PATH, MAIN_BUILD_PATH } = require('../config/consts')
const dotenv = require('./lib/dotenv')
const { relativePath, processExitError } = require('./lib/utils')

require('./lib/setup')

run().catch(processExitError)

async function run() {
  const NODE_ENV = 'production'
  const { DEBUG, GENERATE_SOURCEMAP, ...restEnvs } = dotenv.parseEnv(NODE_ENV)
  const env = { ...process.env, ...restEnvs, NODE_ENV }
  const isDebugMode = DEBUG && DEBUG !== 'false'
  if (isDebugMode) {
    env.DEBUG = DEBUG
  } else {
    delete env.DEBUG
  }

  const absIndexPath = path.resolve(RENDERER_BUILD_PATH, 'index.html')
  const relIndexPath = relativePath(MAIN_BUILD_PATH, absIndexPath)

  await concurrently(
    [
      {
        // #进程1 进行main代码构建打包
        name: '   compile-main   ',
        command: 'webpack -c config/electron.webpack.js --no-color',
        env: {
          ...env,
          APP_INDEX_HTML_PATH: relIndexPath,
          WEBPACK_ELECTRON_ENTRY_PRELOAD: require.resolve('./lib/preload.prod.js'),
        },
      },
      // 进程2，进行renderer内容构建打包
      {
        name: ' compile-renderer ',
        command: 'craco build',
        env: { ...env, GENERATE_SOURCEMAP: isDebugMode || GENERATE_SOURCEMAP },
      },
    ],
    {
      killOthers: ['failure', 'failure'],
      successCondition: 'all',
    }
  )

  //

  // 开启调试模式，启动Electron应用
  if (isDebugMode) {
    await concurrently([
      {
        name: '   electron-app   ',
        command: `node scripts/lib/electron`,
        env: { ...env },
      },
    ])
  }
}
