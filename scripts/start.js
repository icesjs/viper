//
const portfinder = require('portfinder')
const concurrently = require('concurrently')
const dotenv = require('./lib/dotenv')
const { format: urlFormat } = require('url')

// go
run().catch(console.error)

async function run() {
  try {
    await start()
  } catch (e) {
    for (const { exitCode } of e) {
      if (!Number.isNaN(exitCode)) {
        process.exit(exitCode)
      }
    }
  }
}

async function start() {
  //
  const NODE_ENV = 'development'
  const envs = dotenv.parseEnv(NODE_ENV)

  const { HTTPS, PORT, HOST, ...restEnvs } = envs
  const env = { ...process.env, ...restEnvs, NODE_ENV }
  const port = await portfinder.getPortPromise({
    port: +PORT,
    stopPort: +PORT + 1000,
  })
  const indexURL = urlFormat({
    port,
    hostname: HOST,
    protocol: `http${HTTPS ? 's' : ''}`,
    slashes: true,
  })
  // exec command
  await concurrently(
    [
      {
        name: '   compile-main   ',
        command: 'webpack -c config/electron.webpack.js -w --no-hot --no-color',
        env: {
          ...env,
          APP_INDEX_HTML_URL: indexURL,
          WEBPACK_ELECTRON_ENTRY_PRELOAD: require.resolve('./lib/preload.dev.js'),
        },
      },
      {
        name: ' compile-renderer ',
        command: 'craco start',
        env: { ...env, PORT: `${port}`, BROWSER: 'none' },
      },
      {
        name: '   electron-app   ',
        command: `wait-on '${indexURL}' && node scripts/lib/electron`,
        env: { ...env },
      },
    ],
    {
      killOthers: ['failure', 'failure', 'success'],
    }
  )
}
