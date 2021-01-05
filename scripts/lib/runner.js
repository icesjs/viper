const chalk = require('chalk')
const { log } = require('./logger')
const { resolveModule } = require('./resolve')
const respawn = require('./respawn')
const webpack = resolveModule('webpack')

function runWebpack({ config, logger, env, watch, watchOptions, beforeWatchRun, afterWatchRun }) {
  Object.assign(process.env, env)
  const { stats: statsOptions, ...options } = require(config)
  const compiler = webpack(options)
  compiler.hooks.done.tapAsync('done', (stats, done) => {
    !stats.hasErrors() && logger.info(chalk.green('Compiled successfully!'))
    done()
  })

  //
  let watching
  const task = new Promise((resolve, reject) =>
    process.nextTick(() => {
      let isFirstRun = true
      const callback = (err, stats) => {
        if (err) {
          if (isFirstRun) {
            logger.error(err)
            return reject(err)
          } else {
            throw err
          }
        }
        logger.log(stats['toString'](statsOptions))
        if (!isFirstRun) {
          return typeof afterWatchRun === 'function' && afterWatchRun()
        }
        isFirstRun = false
        if (watch) {
          resolve()
        } else {
          if (stats.hasErrors()) {
            reject('Failed to compile!')
          } else {
            resolve()
          }
        }
      }
      //
      if (watch) {
        if (typeof beforeWatchRun === 'function') {
          compiler.hooks.watchRun.tapAsync('watch-run', async (compilation, done) => {
            !isFirstRun && (await beforeWatchRun(compilation))
            done()
          })
        }
        watching = compiler.watch(watchOptions || {}, callback)
      } else {
        compiler.run(callback)
      }
    })
  )
  //
  task.stop = (callback = () => {}) => (watching ? watching.close(callback) : callback())
  return task
}

function runScript({
  script,
  args = [],
  logger = log,
  crashRestarts = 0,
  exitHandle = null,
  beforeExit = null,
  stderrAsError = false,
  env = {},
  ...options
}) {
  if (!Array.isArray(runScript.runners)) {
    runScript.runners = []
  }
  const runners = runScript.runners
  // 子进程输出内容会pipe到父进程，不需要写入日志文件
  env.WRITE_LOGS_TO_FILE = 'false'
  const runner = respawn(script, args, { ...options, env })
  runners.push(runner)
  if (typeof exitHandle !== 'function') {
    const clear = (code) => {
      let task
      while ((task = runners.pop())) {
        task !== runner && task.stop()
      }
      process.exitCode = code
      const exit = () => process.nextTick(() => process.exit())
      if (typeof beforeExit === 'function') {
        try {
          beforeExit(exit)
        } catch (e) {
          log.error(e)
          exit()
        }
      } else {
        exit()
      }
    }
    exitHandle = (code, signal) => {
      if (code === 0 || process.env.NODE_ENV !== 'development') {
        clear(code)
      } else {
        // code=15为开发菜单里定义的重启退出代码
        if (code !== 15) {
          log.error(`The process was crashed${signal ? ' with signal' + signal : ''}`)
          if (!crashRestarts--) {
            return clear(code)
          }
          log.info(`Starting the process again...`)
        }
        runner.restart()
      }
    }
  } else {
    const originalExitHandle = exitHandle
    exitHandle = (...args) => {
      runners.splice(runners.indexOf(runner), 1)
      originalExitHandle(...args)
    }
  }

  return runner
    .on('start', ({ stdout, stderr }) => {
      stdout && stdout.on('data', logger.log)
      stderr && stderr.on('data', logger[stderrAsError ? 'error' : 'log'])
    })
    .on('exit', exitHandle)
}

module.exports = {
  runWebpack,
  runScript,
}
