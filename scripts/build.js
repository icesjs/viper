const path = require('path')
const concurrently = require('concurrently')
const { RENDERER_BUILD_PATH, MAIN_BUILD_PATH } = require('../config/consts')
const dotenv = require('./lib/dotenv')
const { relativePath, log } = require('./lib/utils')

require('./lib/setup')

run().catch(log.processExitError)

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

  const indexRelativeDir = relativePath(MAIN_BUILD_PATH, RENDERER_BUILD_PATH)
  const indexRelativePath = path.join(indexRelativeDir, 'index.html')

  await concurrently(
    [
      {
        name: '   compile-main   ',
        command: 'webpack -c config/electron.webpack.js --no-color',
        env: {
          ...env,
          APP_INDEX_HTML_PATH: indexRelativePath,
          WEBPACK_ELECTRON_ENTRY_PRELOAD: require.resolve('./lib/preload.prod.js'),
        },
      },
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
