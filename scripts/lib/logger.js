const EOL = require('os').EOL
const path = require('path')
const util = require('util')
const fs = require('fs-extra')
const stripColor = require('strip-ansi')
const termSize = require('term-size')
const sliceAnsi = require('slice-ansi')
const widestLine = require('widest-line')
const chalk = require('chalk')
const { formatDate } = require('./utils')

const usedColor = {
  log: '',
  debug: '',
  info: 'green',
  warn: { bg: 'bgYellowBright', ft: 'black' },
  error: 'red',
  markedError: { bg: 'bgRed', ft: 'cyanBright' },
  success: { ft: 'green', bl: true },
  warning: { ft: 'yellow', bl: true },
  failed: { ft: 'red', bl: true },
  errRoot: 'red',
  errFirstRoot: { bg: 'bgCyanBright', ft: 'black' },
  filePaths: { ft: 'cyanBright' },
  errNodeModules: 'red',
  secondary: 'gray',
}

const enableColor = process.env.NO_COLOR !== 'true'
const defaultScriptLogName = 'script'
const root = process.cwd()
const namespace = process.env.npm_package_name
const fileLinkRegex = /[[({]?((?:[a-zA-Z]:|file:)?(?:[/\\][^:*?"<>|/\\,]+)+:\d+:\d+)[})\]]?/g
const filePathsRegex = /^\s*(?:\.{0,2}[/\\])?[a-zA-Z]+:?(?:[/\\](?:[^:*?"<>|/\\,\s]+\s?)+)+\s*(?:[[(][^[()\]]+[)\]])?\s*$/
const prefixRegex = /{\s*(y{1,4}|m{1,2}|d{1,2}|h{1,2}|i{1,2}|s{1,2}|ms|level|name)\s*}/g
const nodeModulesRegex = /^[^\s]|[/\\]node_modules[/\\]/
const warnAndErrorRegex = /^\s*(?:\w+)?(error|warning|warn):?\b/i
const splitLineRegex = /.+\n?|\n|^/g

// 终端列宽信息
const terminalSize = termSize()

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
  for (const level of ['log', 'info', 'error', 'warn', 'debug']) {
    logger[level] = getLogLevelHandle({ id: logger.id, level, ...opts })
  }
  setPlainTextHandle(logger)
  return file ? creteFileLogger(logger, name) : logger
}

function defaultColorFormat(cont, level) {
  return colorify(`${cont}`, (context, line) => {
    if (level === 'error') {
      return colorifyError(context, line)
    }
    const color = warnAndErrorRegex.test(line)
      ? usedColor[RegExp.$1.replace(/ing$/i, '').toLowerCase()]
      : usedColor[level]
    const colorSetter = (color ? getColorSetter(color) : null) || colorifyNormalText
    return colorSetter(line)
  })
}

//
function stripDebugFormatPrefix(content, namespace) {
  if (typeof content === 'object') {
    return content
  }
  if (typeof content !== 'string') {
    content = content + ''
  }
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
function isErrorStackContent(content) {
  let hasError
  let hasStackAt
  for (const line of content.match(splitLineRegex)) {
    if (!hasError) {
      hasError = /^\s*(?:\w+)?error:\s/i.test(line)
    }
    if (!hasStackAt) {
      hasStackAt = /^\s+at\s/.test(line)
    }
    if (hasError && hasStackAt) {
      return true
    }
  }
  return false
}

//
function getLogLevelHandle({ id, level, format, colorFormat, init }) {
  let createDebug
  let debug
  return (msg, ...args) => {
    if (!debug) {
      createDebug = require('debug')
      debug = createDebug(id)
      debug.useColors = false
      init(debug, level)
    }
    const isError = msg instanceof Error
    if (isError) {
      msg = stringifyError(msg)
    } else if (Buffer.isBuffer(msg)) {
      msg = msg.toString()
    } else if (typeof msg === 'object') {
      msg = createDebug.formatters.O.call(debug, msg)
    }
    msg = `${msg}`.replace(/\r\n?/g, '\n').replace(/\u2026/g, '...')
    const msgLevel = isError || isErrorStackContent(msg) ? 'error' : level
    if (typeof colorFormat === 'function') {
      msg = colorFormat(msg, msgLevel)
    }
    if (typeof format === 'function') {
      msg = format(msg, msgLevel)
    }

    debug.apply(debug, [msg, ...args])
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
  const format = process.env.LOG_PREFIX_FORMAT || '[ {name} ]'
  const replacer = (m, g1) =>
    data[/^(?:ms|name|level)$/.test(g1) ? g1 : [...new Set(g1.split(''))].join('')]
  return format.replace(prefixRegex, replacer)
}

//
function getColorSetter(color) {
  let setter = null
  if (enableColor) {
    if (typeof color === 'string') {
      setter = chalk[color]
    } else if (typeof color === 'object') {
      const { bg, ft, bl } = color
      setter = chalk
      if (bg) {
        setter = setter[bg]
      }
      if (ft) {
        setter = setter[ft]
      }
      if (bl) {
        setter = setter['bold']
      }
      if (setter === chalk) {
        setter = null
      }
    }
  }
  return typeof setter === 'function' ? setter : (s) => s
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
  const lines = stripColor(text).match(splitLineRegex)
  const context = { text, lines }
  const format = colorSetter.bind(null, context)
  return lines.map((l) => l.replace(/[^\n]+/, format)).join('')
}

//
function colorifyNormalText(line) {
  if (/\b(?:success|complete)/i.test(line)) {
    return getColorSetter(usedColor.success)(line)
  }
  if (/^\s*Compiled.+?\bwarning/i.test(line)) {
    return getColorSetter(usedColor.warning)(line)
  }
  if (/\bfailed?/i.test(line) || /^\w+\serror\s/i.test(line)) {
    return getColorSetter(usedColor.failed)(line)
  }
  if (/^\s+Line\s\d+:\d+:\s+/.test(line)) {
    return getColorSetter(usedColor.warning)(line)
  }
  if (/^\s+>\s+\d+\s+\|\s+/.test(line)) {
    return getColorSetter(usedColor.markedError)(line)
  }
  if (filePathsRegex.test(line)) {
    return getColorSetter(usedColor.filePaths)(line)
  }
  return line
}

//
function colorifyError(context, line) {
  if (nodeModulesRegex.test(line)) {
    return getColorSetter(usedColor.errNodeModules)(
      line.replace(fileLinkRegex, (t, g1) => getColorSetter(usedColor.secondary)(`[${g1}]`))
    )
  }
  if (line.indexOf(root) !== -1) {
    const { firstRootLine } = context
    line = line.replace(fileLinkRegex, (t, g1) =>
      !firstRootLine ? `[${g1}]` : getColorSetter(usedColor.secondary)(`[${g1}]`)
    )
    if (!firstRootLine) {
      context.firstRootLine = line
      return getColorSetter(usedColor.errFirstRoot)(
        line.replace(/^[\s→]+/, (t) => padStartAndEnd('→', t.length, ' '))
      )
    }
    return getColorSetter(usedColor.errRoot)(line)
  }
  return getColorSetter(usedColor.secondary)(line)
}

//
function setPlainTextHandle(logger) {
  const namespace = '*'
  const debug = require('debug')(namespace)
  debug.useColors = false
  //
  logger.text = new Proxy(logger, {
    get(target, prop) {
      const val = target[prop]
      if (typeof val !== 'function') {
        return val
      }
      return new Proxy(val, {
        apply(tar, ctx, args) {
          let text
          const [msg, ...rest] = args
          debug.log = (content, ...args) => {
            text = util.format(stripDebugFormatPrefix(content, namespace), ...args)
          }
          debug(Buffer.isBuffer(msg) ? msg.toString() : msg, ...rest)
          return stripColor(text).replace(/\r\n?/g, '\n')
        },
      })
    },
  })
}

//
function creteFileLogger(logger, name) {
  const { appendFileSync } = fs
  const out = path.resolve('app.out.log')
  const err = path.resolve('app.err.log')
  return new Proxy(logger, {
    get(target, prop) {
      const val = target[prop]
      if (typeof val !== 'function') {
        return val
      }

      return new Proxy(val, {
        apply(tar, ctx, args) {
          Reflect.apply(tar, target, args)
          const now = new Date()
          const prefix = `[ ${formatDate('h:i:s', now)} ] `
          const text = target.text[prop](...args) + ''
          const content = text
            .replace(/\n$/, '')
            .match(splitLineRegex)
            .map((l) => wrapStringRow(prefix, l, 120))
            .join('')
            .replace(/\n$/, '')
            .replace(/\n/g, EOL)

          const file = prop === 'error' || args[0] instanceof Error ? err : out
          // 这里追加日志内容到文件中
          appendFileSync(file, `${EOL}[${formatDate('y-m-d', now)}] @${name}${EOL}${content + EOL}`)
        },
      })
    },
  })
}

//
function wrapStringRow(prefix, str, maxColumns = terminalSize.columns) {
  const widestLineWidth = widestLine(prefix + str)
  const maxCols = Math.max(maxColumns - 1, 40)
  if (widestLineWidth <= maxCols) {
    str = prefix + str
  } else {
    let strWidth
    const rows = []
    const prefixWidth = widestLine(prefix)
    const maxStrWidth = Math.abs(maxCols - prefixWidth)
    let sub = sliceAnsi(str, 0, maxStrWidth)
    str = sliceAnsi(str, maxStrWidth)
    rows.push(prefix + sub + '\n')
    while ((strWidth = widestLine(str))) {
      if (prefixWidth + strWidth > maxCols) {
        sub = sliceAnsi(str, 0, maxStrWidth)
        str = sliceAnsi(str, maxStrWidth)
        rows.push(prefix + sub + '\n')
      } else {
        rows.push(prefix + str)
        str = ''
      }
    }
    str = rows.join('')
  }
  return stripColor(str).substr(-1) !== '\n' ? str + '\n' : str
}

//
function formatPrefixedLogs({ content, name, level, nameColor }) {
  const color = `${typeof nameColor === 'function' ? nameColor() : nameColor}`
  const maxNameLength = createPrefixedLogger._registeredNames[0].length
  const p = getColorSetter(color)(formatLogPrefix(name, level, maxNameLength)) + ' '
  //
  return content
    .replace(/\r\n?/g, '\n')
    .replace(/\n$/, '')
    .match(splitLineRegex)
    .map((l) => wrapStringRow(p, l))
    .join('')
}

//
function createPrefixedLogger(name, nameColor, contentColorFormat = defaultColorFormat) {
  createPrefixedLogger.registerNames((name = typeof name === 'string' ? name.trim() : 'logger'))
  return createLogger({
    name,
    file: process.env.WRITE_LOGS_TO_FILE !== 'false',
    colorFormat: contentColorFormat,
    init: (debug, level) => {
      const { namespace } = debug
      debug.log = (msg, ...args) => {
        const content = util.format(stripDebugFormatPrefix(msg, namespace), ...args)
        const prefixed = formatPrefixedLogs({ content, level, name, nameColor })
        process.stderr['write'](prefixed.replace(/\n$/, '') + '\n')
      }
    },
  })
}
createPrefixedLogger._registeredNames = [defaultScriptLogName]
createPrefixedLogger.registerNames = (names) => {
  if (!Array.isArray(names)) {
    names = [names]
  }
  createPrefixedLogger._registeredNames.push(...names)
  createPrefixedLogger._registeredNames.sort((a, b) => b.length - a.length)
}

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
