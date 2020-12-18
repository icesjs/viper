//
const { format: urlFormat } = require('url')
const portfinder = require('portfinder')
const concurrently = require('concurrently')
const dotenv = require('./lib/dotenv')
const { log } = require('./lib/utils')

//
require('./lib/setup')

run().catch(log.processExitError)

async function run() {
  //
  const NODE_ENV = 'development'
  const { HTTPS, HOST, PORT, ...restEnvs } = dotenv.parseEnv(NODE_ENV)
  const env = { ...process.env, ...restEnvs, NODE_ENV }
  const port = await portfinder.getPortPromise({
    port: +PORT,
    stopPort: +PORT + 1000,
  })
  const indexURL = urlFormat({
    protocol: `http${HTTPS ? 's' : ''}`,
    hostname: HOST || 'localhost',
    port,
  })
  // exec command
  await concurrently(
    [
      {
        // 进程1
        // 自定义的webpack构建main代码的进程
        // main代码变更后，需要通过进程2的ts编译器执行类型检查，并推送可能的错误信息到electron窗口显示
        name: '   compile-main   ',
        command: 'webpack -c config/electron.webpack.js -w --no-hot --no-color',
        env: {
          ...env,
          APP_INDEX_HTML_URL: indexURL,
          WEBPACK_ELECTRON_ENTRY_PRELOAD: require.resolve('./lib/preload.dev.js'),
        },
      },
      // 进程2
      // react-scripts定义的webpack构建renderer代码的进程
      // 除了执行web内容构建外，还负责对整个工程的ts文件进行类型检查，并将提示信息输出到应用窗口显示
      {
        name: ' compile-renderer ',
        command: 'craco start',
        env: { ...env, HTTPS, HOST, PORT: `${port}`, BROWSER: 'none' },
      },
      // 进程3
      // 监听electron运行状况的进程
      // 通过监听进程1构建输出的文件发生的变化，或者应用崩溃时，对electron应用进行重启
      // ts类型检查错误提示信息，需要通过进程2的wds推送到应用窗口显示
      // 需要通过进程3来感知进程1新构建的结束，并通知进程2进行invalidate操作，触发ts检查，并推送提示信息到窗口
      // 进程2的开发服务器(wds)在启用状态下，可以通过发送http请求至自定义的中间件，来实现该目的
      {
        name: '   electron-app   ',
        command: `wait-on '${indexURL}' && node scripts/lib/electron`,
        env: { ...env, APP_INDEX_HTML_URL: indexURL },
      },
    ],
    {
      killOthers: ['failure', 'failure', 'success'],
      successCondition: 'all',
    }
  )
}
