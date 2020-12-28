const log = require('electron-log')
const chalk = require('chalk')
const stripColor = require('strip-ansi')

const usedColor = {
  info: 'green',
  warn: 'yellow',
  error: 'red',
  log: '',
}

const defaultScriptLogName = 'script'
const root = process.cwd()
const cRoot = 'cyan'

function createLogger(...args) {
  const { id, replaceConsole, format, colorFormat, file } = getObjectOptions(args)

  let logger = log.create(id)
  logger.console = { ...console }
  logger.transports.file.level = false
  logger.transports.console.format = format

  for (const type of Object.keys(usedColor)) {
    logger[type] = getLogHandler(logger, type, colorFormat)
    if (replaceConsole) {
      console[type] = logger[type]
    }
  }
  makeEchoTextLogger(logger)
  if (file) {
    logger = makeWriteFileLogger(logger)
  }

  return logger
}

function getObjectOptions(args) {
  let options
  if (typeof args[0] === 'object') {
    options = args[0]
  } else {
    options = {
      id: args[0],
      replaceConsole: args[1],
      format: args[2],
    }
  }
  return Object.assign(
    {
      id: 'builder-scripts',
      replaceConsole: false,
      format: '{text}',
    },
    options
  )
}

//
function getLogHandler(logger, type, colorFormat) {
  const getColorSetter = (text) => {
    const color = /^\s*\w?(error|warning|warn):?\b/i.test(text)
      ? usedColor[RegExp.$1.replace(/ing$/i, '').toLowerCase()]
      : usedColor[type]
    return color ? chalk[color] : (str) => str
  }
  const originalLog = logger[type]

  return (...args) => {
    if (args.length > 1) {
      originalLog.apply(logger, args)
      return
    }

    let msg = args[0]
    const isError = type === 'error' || msg instanceof Error
    if (isError) {
      msg = stringifyError(msg)
    }

    if (typeof msg === 'string' || Buffer.isBuffer(msg)) {
      msg = `${msg}`.replace(/\r\n?/g, '\n').replace(/\u2026/g, '...')
    }

    let cText
    if (typeof colorFormat === 'function') {
      cText = colorFormat(msg)
    } else {
      cText = colorify(`${msg}`, (line) => {
        if (isError) {
          return colorifyError(line)
        }
        return getColorSetter(line)(line)
      })
    }

    originalLog.call(logger, `${cText}`)
  }
}

//
function stringifyError(err) {
  let msg
  let stack
  if (err instanceof Error) {
    msg = err.message
    stack = err.stack
    if (msg && stack) {
      stack = `${stack}`
      const firstLF = stack.indexOf('\n')
      if (firstLF !== -1) {
        stack = stack.substring(0, firstLF).replace(msg, '') + stack.substring(firstLF)
      }
    }
  } else {
    msg = `${err}`
  }
  return `${msg}${stack ? stack : ''}`
}

//
function colorify(text, colorSetter) {
  const pieces = `${text}`.match(/.*?(\n+|.$)/g) || [text]
  return pieces.reduce(
    (str, p) =>
      str +
      stripColor(p)
        .match(/[^\n]+|\n+|^/g)
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
function makeEchoTextLogger(logger) {
  logger.text = new Proxy(logger, {
    get(target, prop) {
      const val = target[prop]
      if (typeof val !== 'function') {
        return val
      }
      return new Proxy(val, {
        apply(tar, ctx, args) {
          return stripColor(`${args[0] instanceof Error ? stringifyError(args[0]) : args[0]}`)
        },
      })
    },
  })
}

//
function makeWriteFileLogger(log) {
  const EOL = require('os').EOL
  const path = require('path')
  const { outputFileSync, appendFileSync } = require('fs-extra')
  const env = path.resolve('app.env.json')
  const out = path.resolve('app.out.log')
  const err = path.resolve('app.err.log')

  const timeString = new Date().toLocaleTimeString()
  const pid = process.pid
  outputFileSync(env, JSON.stringify(process.env))
  outputFileSync(out, `[${timeString}] #pid: ${pid}${EOL}`)
  outputFileSync(err, `[${timeString}] #pid: ${pid}${EOL}`)

  return new Proxy(log, {
    get(target, prop) {
      const val = target[prop]
      if (typeof val !== 'function') {
        return val
      }
      return new Proxy(val, {
        apply(tar, ctx, args) {
          Reflect.apply(tar, target, args)
          let text = `[${new Date().toLocaleTimeString()}] ${target.text[prop](args[0])}`
          text = text.replace(/^\s*\r?\n|\s*\r?\n$/, '').replace(/\r?\n/g, EOL) + EOL
          appendFileSync(prop === 'error' || args[0] instanceof Error ? err : out, text)
        },
      })
    },
  })
}

function createNamedLogger(name, nameColor, stripColor) {
  const names = (createNamedLogger.registeredNames = createNamedLogger.registeredNames || [
    defaultScriptLogName,
  ])
  const id = name.trim()
  names.push(id)
  names.sort((a, b) => b.length - a.length)
  return createLogger({
    id,
    colorFormat: !stripColor && ((str) => str),
    file: process.env.WRITE_LOGS_TO_FILE !== 'false',
    format: ({ data }) => {
      const maxLen = names[0].length
      const padLength = Math.floor((maxLen - id.length) / 2)
      const name = id.padEnd(padLength + id.length).padStart(maxLen)
      const color = typeof nameColor === 'function' ? nameColor() : nameColor
      const p = (chalk[color] || chalk['gray'])(`[ ${name} ] `)
      return data
        .join('')
        .replace(/^\s*\n|\n\s*$/, '')
        .match(/[^\n]+|\n+|^/g)
        .map((l) => (/\n(\n+)?/.test(l) ? `\n${RegExp.$1.replace(/\n/g, `${p}\n`)}` : `${p}${l}`))
        .join('')
    },
  })
}

let defaultScriptLog
module.exports = {
  createLogger,
  createNamedLogger,
  get log() {
    if (!defaultScriptLog) {
      defaultScriptLog = createNamedLogger(
        defaultScriptLogName,
        () => process.env.LOG_PREFIX_COLOR_SCRIPT,
        true
      )
    }
    return defaultScriptLog
  },
}
