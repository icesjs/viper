const { log } = require('./logger')
const { resolvePackage } = require('./resolve')
const respawn = require('./respawn')
const webpack = resolvePackage('webpack')

function runWebpack({ config, logger, env, watch, watchOptions, beforeWatchRun, afterWatchRun }) {
  Object.assign(process.env, env)
  const { stats: statsOptions, ...options } = require(config)
  const compiler = webpack(options)
  compiler.hooks.done.tapAsync('done', (stats, done) => {
    !stats.hasErrors() && logger.info('Compiled successfully!')
    done()
  })
  //
  return new Promise((resolve, reject) => {
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
      resolve()
    }
    //
    if (watch) {
      if (typeof beforeWatchRun === 'function') {
        compiler.hooks.watchRun.tapAsync('watch-run', async (compilation, done) => {
          !isFirstRun && (await beforeWatchRun(compilation))
          done()
        })
      }
      compiler.watch(watchOptions || {}, callback)
    } else {
      compiler.run(callback)
    }
  })
}

function runScript({ logger, script, exitHandle, args = [], crashRestarts = 3, ...options }) {
  const runner = respawn(script, args, options)
  if (typeof exitHandle !== 'function') {
    exitHandle = (code, signal) => {
      if (code === 0 || process.env.NODE_ENV !== 'development') {
        process.exit(code)
      }
      // code=15为开发菜单里定义的重启退出代码
      if (code !== 15) {
        log.error(`The process was crashed${signal ? ' with signal' + signal : ''}`)
        if (!crashRestarts--) {
          process.exit(code)
        }
        log.info(`Starting the process again...`)
      }
      runner.restart()
    }
  }
  return runner
    .on('start', ({ stdout, stderr }) => {
      stdout && stdout.on('data', logger.info)
      stderr && stderr.on('data', logger.error)
    })
    .on('exit', exitHandle)
}

module.exports = {
  runWebpack,
  runScript,
}
