const util = require('util')
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
const rootColor = 'cyan'
const namespace = process.env.npm_package_name

function createLogger(opts) {
  opts = Object.assign(
    {
      name: 'script',
      file: false,
      format: null,
      colorFormat: defaultColorFormat,
      init: defaultDebugInit,
    },
    opts
  )
  const { name, file } = opts
  const logger = { id: `${namespace}:${name}` }
  for (const level of Object.keys(usedColor)) {
    logger[level] = getLogLevelHandle({ id: logger.id, level, ...opts })
  }
  setPlainTextHandle(logger)
  return file ? creteFileLogger(logger) : logger
}

function defaultColorFormat(cont, level) {
  const noop = (str) => str
  return colorify(`${cont}`, (line) => {
    if (level === 'error') {
      return colorifyError(line)
    }
    const color = /^\s*\w?(error|warning|warn):?\b/i.test(line)
      ? usedColor[RegExp.$1.replace(/ing$/i, '').toLowerCase()]
      : usedColor[level]
    const colorSetter = (color ? chalk[color] : null) || noop
    return colorSetter(line)
  })
}

//
function stripDebugFormatPrefix(content, namespace) {
  const index = content.indexOf(namespace)
  if (index !== -1) {
    content = content.substring(index + namespace.length + 1)
  }
  return content
}

//
function defaultDebugInit(debug) {
  const debugLog = require('debug').log
  const { namespace } = debug
  debug.log = (msg, ...args) => {
    debugLog.apply(debug, [stripDebugFormatPrefix(msg, namespace), ...args])
  }
}

//
function getLogLevelHandle({ id, level, format, colorFormat, init }) {
  let debug
  return (msg, ...args) => {
    if (!debug) {
      debug = require('debug')(id)
      debug.useColors = false
      init(debug, level)
    }
    const msgLevel = msg instanceof Error ? 'error' : level

    if (Buffer.isBuffer(msg)) {
      msg = msg.toString()
    } else if (msg instanceof Error) {
      msg = stringifyError(msg)
    } else if (typeof msg === 'object') {
      msg = debug.formatters.O.call(debug, msg)
    }
    msg = `${msg}`.replace(/\r\n?/g, '\n').replace(/\u2026/g, '...')

    if (typeof colorFormat === 'function') {
      msg = colorFormat(msg, msgLevel)
    }
    if (typeof format === 'function') {
      msg = format(msg, msgLevel)
    }

    debug(msg, ...args)
  }
}

function padStartAndEnd(s, l = 2, f = '0') {
  s = `${s}`
  if (!l || s.length > l) {
    return s
  }
  const sl = Math.floor((l - s.length) / 2)
  return s.padStart(sl + s.length, f).padEnd(l, f)
}

//
function formatLogPrefix(name, level, maxNameLen) {
  const pad = padStartAndEnd
  const date = new Date()
  // {y} {m} {d} {h} {i} {s} {ms} {level} {name}
  const data = {
    name: pad(name, maxNameLen, ' '),
    level: pad(level, 5, ' '),
    y: date.getFullYear(),
    m: pad(date.getMonth() + 1),
    d: pad(date.getDate()),
    h: pad(date.getHours()),
    i: pad(date.getMinutes()),
    s: pad(date.getSeconds()),
    ms: pad(date.getMilliseconds(), 4),
  }
  return (process.env.LOG_PREFIX_FORMAT || '[ {name} ]').replace(
    /{\s*(y|m|d|h|i|s|ms|level|name)\s*}/g,
    (m, g1) => data[g1]
  )
}

//
function stringifyError(err) {
  if (err instanceof Error) {
    return err.stack || err.message
  }
  return `${err}`
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
    return chalk[rootColor](text)
  }
  return chalk.gray(text)
}

//
function setPlainTextHandle(logger) {
  logger.text = new Proxy(logger, {
    get(target, prop) {
      const val = target[prop]
      if (typeof val !== 'function') {
        return val
      }
      return new Proxy(val, {
        apply(tar, ctx, args) {
          return stripColor(stringifyError(args[0]))
        },
      })
    },
  })
}

//
function creteFileLogger(log) {
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

//
function formatPrefixedLogs({ content, name, level, nameColor }) {
  const color = `${typeof nameColor === 'function' ? nameColor() : nameColor}`
  const maxNameLength = createPrefixedLogger.registeredNames[0].length
  const p = (chalk[color] || chalk['gray'])(formatLogPrefix(name, level, maxNameLength)) + ' '
  //
  return content
    .replace(/\r\n?/g, '\n')
    .replace(/^\s*\n|\n\s*$/, '')
    .match(/[^\n]+|\n+|^/g)
    .map((l) => (/\n(\n+)?/.test(l) ? `\n${RegExp.$1.replace(/\n/g, `${p}\n`)}` : `${p}${l}`))
    .join('')
}

//
function createPrefixedLogger(name, nameColor, contentColorFormat = (str) => str) {
  const registered = createPrefixedLogger.registeredNames
  registered.push((name = name.trim()))
  registered.sort((a, b) => b.length - a.length)
  return createLogger({
    name,
    file: process.env.WRITE_LOGS_TO_FILE !== 'false',
    colorFormat: contentColorFormat,
    init: (debug, level) => {
      const { namespace } = debug
      debug.log = (msg, ...args) => {
        const content = util.format(stripDebugFormatPrefix(msg, namespace), ...args)
        const prefixed = formatPrefixedLogs({ content, level, name, nameColor })
        process.stderr.write(prefixed + '\n')
      }
    },
  })
}
//
createPrefixedLogger.registeredNames = [defaultScriptLogName]

//
let defaultScriptLog
function getDefaultLog() {
  if (!defaultScriptLog) {
    defaultScriptLog = createPrefixedLogger(
      defaultScriptLogName,
      () => process.env.LOG_PREFIX_COLOR_SCRIPT,
      defaultColorFormat
    )
  }
  return defaultScriptLog
}

module.exports = {
  createLogger,
  createPrefixedLogger,
  get log() {
    return getDefaultLog()
  },
}
