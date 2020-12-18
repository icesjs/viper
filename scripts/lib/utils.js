const path = require('path')
const log = require('electron-log')
const chalk = require('chalk')
const { mergeWithCustomize } = require('webpack-merge')
const cwd = process.cwd()

module.exports = exports = {
  //
  resolvePackage(pack) {
    try {
      const packPath = require.resolve(pack)
      return require(packPath)
    } catch (e) {
      exports.log.error(`You must install ${pack} manually`)
      throw e
    }
  },

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
    process.on('SIGINT', wrapper)
    process.on('SIGTERM', wrapper)
    process.on('exit', wrapper)
  },

  //
  createLogger(id = 'builder', replaceConsole = false) {
    const logger = log.create(id)
    logger.transports.file.level = false
    logger.transports.console.format = '{text}'

    const trimWebpackCLITitle = (text) =>
      `${text}`.replace(/^\s*\[\s*webpack-cli\s*]\s*/i, '').replace(/^[a-z]/, '$&'.toUpperCase())

    ;['info', 'warn', 'error', 'log'].forEach((name, index) => {
      const color = ['green', 'yellow', 'red', 'cyan'][index]
      const fn = logger[name]
      logger[name] = function (...args) {
        if (args[0] instanceof Error) {
          args[0] = args[0].message
        }
        if (args.length === 1 && /string|number|boolean/.test(typeof args[0])) {
          fn.call(logger, chalk[color](trimWebpackCLITitle(args[0])))
        } else {
          fn.apply(logger, args)
        }
      }
      if (replaceConsole) {
        console[name] = logger[name]
      }
    })
    //
    return logger
  },

  //
  customizeCracoWebpack(customizeConfig = {}) {
    return {
      configure: (originalConfig, context) => {
        //
        overrideEntry(context, originalConfig, customizeConfig)
        overrideOutputPath(context, customizeConfig)
        //
        return mergeWithCustomize({
          customizeObject(a, b, key) {},
          customizeArray(a, b, key) {},
        })(originalConfig, customizeConfig)
      },
    }
  },
}

exports.log = exports.createLogger('builder')

exports.log.processExitError = function (error = {}) {
  for (const { exitCode } of Array.isArray(error) ? error : [error]) {
    if (!Number.isNaN(exitCode)) {
      process.exit(exitCode)
    }
  }
}

//
function overrideEntry(context, originalConfig, customizeConfig) {
  const customizeEntry = customizeConfig.entry
  if (customizeEntry) {
    if (!Array.isArray(customizeEntry) && Array.isArray(originalConfig.entry)) {
      originalConfig.entry.splice(-1, 1, customizeEntry)
      delete customizeConfig.entry
    }
    overrideCRAPaths(context, 'appIndexJs', customizeEntry)
  }
}

//
function overrideOutputPath(context, customizeConfig) {
  if (customizeConfig.output) {
    const outputPath = customizeConfig.output.path
    if (outputPath) {
      overrideCRAPaths(context, 'appBuild', outputPath)
    }
  }
}

//
function overrideCRAPaths({ paths }, prop, val) {
  const cracoConfig = require(path.resolve(cwd, 'craco.config.js'))
  const ownPath =
    paths['ownPath'] ||
    path.join(
      require.resolve(`${cracoConfig['reactScriptsVersion'] || 'react-scripts'}/package.json`, {
        paths: [cwd],
      }),
      '../'
    )
  const modulePath = require.resolve(path.join(ownPath, 'config', 'paths.js'), {
    paths: [cwd],
  })
  paths[prop] = val
  const cached = require.cache[modulePath].exports
  if (cached[prop] !== val) {
    cached[prop] = val
  }
}
