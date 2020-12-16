//
const path = require('path')
const portfinder = require('portfinder')
const concurrently = require('concurrently')
const dotenv = require('./dotenv')

//
const NODE_ENV = 'development'
const envs = dotenv.parseEnv(NODE_ENV)

const {
  PORT = 3000,
  HTTPS: https = false,
  HOST: host = 'localhost',
  AUTO_OPEN_DEV_TOOLS = 'false',
  AUTO_RELAUNCH_APP = 'true',
  ...restEnvs
} = envs
//
//
;(async () => {
  const port = await portfinder.getPortPromise({
    port: +PORT,
    stopPort: +PORT + 1000,
  })
  const indexURL = `http${https ? 's' : ''}://${host}:${port}`
  const env = { ...process.env, ...restEnvs, NODE_ENV }
  //
  concurrently(
    [
      {
        name: '  compile-main  ',
        command: 'webpack -c config/electron.webpack.js -w --no-hot --no-color --stats minimal',
        env: {
          ...env,
          AUTO_OPEN_DEV_TOOLS,
          APP_INDEX_HTML_URL: indexURL,
          WEBPACK_ELECTRON_ENTRY_PRELOAD: path.resolve(__dirname, './preload.dev.js'),
        },
      },
      {
        name: 'compile-renderer',
        command: 'craco start',
        env: { ...env, PORT: `${port}`, BROWSER: 'none' },
      },
      {
        name: '  electron-app  ',
        command: `wait-on '${indexURL}' && node scripts/electron`,
        env: { ...env, AUTO_RELAUNCH_APP },
      },
    ],
    {
      killOthers: ['failure', 'failure', 'success'],
    }
  ).catch((details) => {
    for (const { exitCode } of details) {
      if (!Number.isNaN(exitCode)) {
        process.exit(exitCode)
      }
    }
  })
})()
