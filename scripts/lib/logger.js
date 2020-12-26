const log = require('electron-log')
const chalk = require('chalk')
const stripColor = require('strip-ansi')

const usedColor = {
  info: 'green',
  warn: 'yellow',
  error: 'red',
  log: 'cyan',
}

const root = process.cwd()
const cRoot = 'cyan'

function createLogger(id = 'builder-scripts', replaceConsole = false) {
  let logger = log.create(id)
  logger.console = { ...console }
  logger.transports.file.level = false
  logger.transports.console.format = '{text}'

  for (const type of Object.keys(usedColor)) {
    logger[type] = getLogHandler(logger, type)
    if (replaceConsole) {
      console[type] = logger[type]
    }
  }

  //
  makeEchoTextProxy(logger)

  if (process.env.WRITE_LOGS_TO_FILE) {
    logger = writeLogsToFile(logger)
  }

  return logger
}

//
function getLogHandler(logger, logType) {
  const log = logger[logType]
  return (...args) => {
    let isError = logType === 'error'
    if (args[0] instanceof Error) {
      isError = true
      args[0] = stringifyError(args[0])
    }
    const isText = /string|number|boolean/.test(typeof args[0])
    if (isText && args.length === 1) {
      const cText = colorify(args[0], (text) => {
        if (isError) {
          return colorifyError(text)
        }
        return chalk[
          /^\s*\w?(error|warning|warn):?\b/i.test(text)
            ? usedColor[RegExp.$1.replace(/ing$/i, '').toLowerCase()]
            : usedColor[logType]
        ](text)
      })

      log.call(logger, `${cText}`)
    } else {
      log.apply(logger, args)
    }
  }
}

//
function stringifyError(err) {
  let stack = err.stack
  const msg = err.message
  if (msg && stack) {
    stack = `${stack}`
    const firstLF = stack.indexOf('\n')
    if (firstLF !== -1) {
      stack = stack.substring(0, firstLF).replace(msg, '') + stack.substring(firstLF)
    }
  }
  return `${/^error:?\s*/i.test(msg) ? msg : `Error: ${msg}`}${stack ? `\n${stack}\n` : ''}`
}

//
function colorify(text, colorSetter) {
  const pieces = `${text}`.match(/.*?(\n+|.$)/g) || [text]
  return pieces.reduce(
    (str, p) =>
      str +
      stripColor(p)
        .replace(/\s*\[webpack-cli]\s*/i, '')
        .match(/[^\n]+|\n+|^/g)
        .map((s) => s.replace(/^[a-z]/, (c) => c.toUpperCase()))
        .filter((s) => s)
        .map((s) => (/\n/.test(s) ? s : colorSetter(s)))
        .join(''),
    ''
  )
}

//
function colorifyError(text) {
  if (/^[^\s]|[/\\]node_modules[/\\]/.test(text)) {
    return chalk[usedColor['error']](text)
  }
  if (text.indexOf(root) !== -1) {
    return chalk[cRoot](text)
  }
  return chalk.gray(text)
}

//
function makeEchoTextProxy(logger) {
  logger.text = new Proxy(logger, {
    get(target, prop) {
      const val = target[prop]
      if (typeof val === 'function') {
        return new Proxy(val, {
          apply(tar, ctx, args) {
            return stripColor(`${args[0] instanceof Error ? stringifyError(args[0]) : args[0]}`)
          },
        })
      }
      return val
    },
  })
}

//
function writeLogsToFile(log, handle = null) {
  const EOL = require('os').EOL
  const path = require('path')
  const { outputFileSync, appendFileSync } = require('fs-extra')
  const env = path.resolve('app.env.json')
  const out = path.resolve('app.out.log')
  const err = path.resolve('app.err.log')
  let logProxy
  //
  process.on('uncaughtException', (err) => {
    logProxy.error(err)
    process.exit(1)
  })
  process.on('unhandledRejection', (reason) => {
    logProxy.error(reason)
  })
  //
  if (typeof handle !== 'function') {
    const timeString = new Date().toLocaleTimeString()
    const pid = process.pid
    outputFileSync(env, JSON.stringify(process.env))
    outputFileSync(out, `[${timeString}] #pid: ${pid}${EOL}`)
    outputFileSync(err, `[${timeString}] #pid: ${pid}${EOL}`)
  }
  //
  logProxy = new Proxy(log, {
    get(target, prop) {
      const val = target[prop]
      if (typeof val === 'function') {
        return (txt, ...args) => {
          if (typeof handle === 'function') {
            handle([txt, ...args], target.text[prop](txt))
          } else {
            val.apply(target, [txt, ...args])
            appendFileSync(
              prop === 'error' || txt instanceof Error ? err : out,
              `[${new Date().toLocaleTimeString()}] ${target.text[prop](txt)}${EOL}`
            )
          }
        }
      }
      return val
    },
  })
  return logProxy
}

//
module.exports = {
  createLogger,
  writeLogsToFile,
  log: createLogger(),
}
