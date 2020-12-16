const path = require('path')
const log = require('electron-log')
const chalk = require('chalk')

function trimWebpackCLITitle(text) {
  return `${text}`.replace(/^\s*\[\s*webpack-cli\s*]\s*/i, '').replace(/^[a-z]/, '$&'.toUpperCase())
}

exports.createLogger = function (id = 'builder') {
  const logger = log.create(id)
  logger.transports.file.level = false
  logger.transports.console.format = '{text}'
  ;['info', 'warn', 'error', 'log'].forEach((name, index) => {
    const color = ['green', 'yellow', 'red', 'cyan'][index]
    const fn = logger[name]
    logger[name] = function (...args) {
      if (args.length === 1 && /string|number|boolean/.test(typeof args[0])) {
        fn.call(logger, chalk[color](trimWebpackCLITitle(args[0])))
      } else {
        fn.apply(logger, args)
      }
    }
    //
    console[name] = logger[name]
  })
  return logger
}

exports.log = exports.createLogger()

exports.resolveProjectPath = function (...args) {
  return path.resolve(__dirname, '..', ...args)
}

exports.resolvePackage = function (pack) {
  try {
    const packPath = require.resolve(pack)
    return require(packPath)
  } catch (e) {
    exports.log.error(`You must install ${pack} manually`)
    throw e
  }
}
