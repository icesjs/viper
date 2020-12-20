const log = require('electron-log')
const chalk = require('chalk')
const stripColor = require('strip-ansi')

const usedColor = {
  info: 'green',
  warn: 'yellow',
  error: 'red',
  log: 'cyan',
}

module.exports = exports = {
  createLogger(id = 'builder-scripts', replaceConsole = false) {
    const logger = log.create(id)
    logger.transports.file.level = false
    logger.transports.console.format = '{text}'

    for (const name of Object.keys(usedColor)) {
      setColor(logger, name, replaceConsole)
    }

    return logger
  },
}

exports.log = exports.createLogger()

//
function setColor(logger, name, replaceConsole) {
  const fn = logger[name]
  logger[name] = function (...args) {
    if (args[0] instanceof Error) {
      args[0] = args[0].message
    }

    if (args.length === 1 && /string|number|boolean/.test(typeof args[0])) {
      const cText = color(args[0], (text) => {
        return chalk[
          /^\s*\w?(error|warning|warn):?\b/i.test(text)
            ? usedColor[RegExp.$1.replace(/ing$/i, '').toLowerCase()]
            : usedColor[name]
        ](text)
      })

      fn.call(logger, `\n${cText}`)
    } else {
      fn.apply(logger, args)
    }
  }
  if (replaceConsole) {
    console[name] = logger[name]
  }
}

//
function color(text, handle) {
  const pieces = `${text}`.match(/.*?(\n+|.$)/g) || [text]
  return pieces.reduce(
    (str, p) =>
      str +
      stripColor(p)
        .replace(/\s*\[webpack-cli]\s*/i, '')
        .match(/[^\n]+|\n+|^/g)
        .map((s) => s.replace(/^[a-z]/, (c) => c.toUpperCase()))
        .map((s) => (/\n/.test(s) ? s : handle(s)))
        .join(''),
    ''
  )
}
