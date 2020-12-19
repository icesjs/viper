const fs = require('fs')
const path = require('path')
const log = require('electron-log')
const chalk = require('chalk')

module.exports = exports = {
  PROJECT_CONTEXT: fs.realpathSync(process.cwd()),

  //
  relativePath(from, to) {
    let relativePath = path.relative(from, to).replace(/\\/g, '/')
    if (!/^..?\//.test(relativePath)) {
      relativePath = `./${relativePath}`
    }
    return relativePath
  },

  registerShutdown(fn) {
    let run = false
    const wrapper = (...args) => {
      if (!run) {
        run = true
        fn(...args)
      }
    }
    process['on']('SIGINT', wrapper)
    process['on']('SIGTERM', wrapper)
    process['on']('exit', wrapper)
  },

  //
  createLogger(id = 'builder-scripts', replaceConsole = false) {
    const logger = log.create(id)
    logger.transports.file.level = false
    logger.transports.console.format = '{text}'

    const usedLog = ['info', 'warn', 'error', 'log']
    const usedColor = ['green', 'yellow', 'red', 'cyan']

    const trimWebpackCLITitle = (text) =>
      `${text}`.replace(/^\s*\[\s*webpack-cli\s*]\s*/i, '').replace(/^[a-z]/, '$&'.toUpperCase())

    const setColor = (name, index) => {
      const fn = logger[name]
      logger[name] = function (...args) {
        if (args[0] instanceof Error) {
          args[0] = args[0].message
        }
        if (args.length === 1 && /string|number|boolean/.test(typeof args[0])) {
          const text = trimWebpackCLITitle(args[0])
          const cText = chalk[/^[\n\s]*error:/i.test(text) ? usedColor[2] : usedColor[index]](
            trimWebpackCLITitle(args[0])
          )
          fn.call(logger, cText)
        } else {
          fn.apply(logger, args)
        }
      }
      if (replaceConsole) {
        console[name] = logger[name]
      }
    }

    usedLog.forEach(setColor)
    //
    return logger
  },
}

exports.log = exports.createLogger('builder-scripts:default')

exports.log.processExitError = function (error = {}) {
  for (const { exitCode } of Array.isArray(error) ? error : [error]) {
    if (!Number.isNaN(exitCode)) {
      process.exit(exitCode)
    }
  }
}
