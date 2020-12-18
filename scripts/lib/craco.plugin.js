//
module.exports = {
  //
  overrideCracoConfig: ({
    // pluginOptions,
    // context: { env, paths },
    cracoConfig,
  }) => {
    const { webpack = {} } = cracoConfig
    const { configure } = webpack || {}
    if (configure !== null && typeof configure === 'object') {
      webpack.configure = customizeCracoWebpackConfigure(configure)
    }
    return cracoConfig
  },

  //
  overrideWebpackConfig: ({
    // cracoConfig,
    // pluginOptions,
    // context,
    webpackConfig,
  }) => {
    return webpackConfig
  },

  //
  overrideDevServerConfig: ({
    // cracoConfig,
    // pluginOptions,
    // context: { env, paths, allowedHost },
    devServerConfig,
  }) => {
    const { hot, before } = devServerConfig || {}
    if (hot) {
      if (typeof before === 'function') {
        devServerConfig.before = (...args) => {
          customizeDevServerBefore(...args)
          return before(...args)
        }
      }
    }
    return devServerConfig
  },
}

const path = require('path')
const { mergeWithCustomize } = require('webpack-merge')
const cwd = process.cwd()

//
function customizeDevServerBefore(app, server) {
  //
}

//
function customizeCracoWebpackConfigure(customizeConfig = {}) {
  return (originalConfig, context) => {
    overrideEntry(context, originalConfig, customizeConfig)
    overrideOutputPath(context, customizeConfig)
    //
    return mergeWithCustomize({
      customizeObject(a, b, key) {},
      customizeArray(a, b, key) {},
    })(originalConfig, customizeConfig)
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
