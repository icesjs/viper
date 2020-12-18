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
const resolvePackage = require('./resolve')

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
  let customizeEntry = customizeConfig.entry
  if (customizeEntry) {
    let chunkName
    if (typeof customizeEntry === 'object') {
      const keys = Object.keys(customizeEntry)
      if (!keys.length) {
        delete customizeConfig.entry
        return
      }
      if (keys.length > 1) {
        throw new Error('Does not support the creation of multi-page entry applications')
      }
      chunkName = keys[0]
      customizeEntry = customizeEntry[chunkName]
    }
    if (!Array.isArray(customizeEntry) && Array.isArray(originalConfig.entry)) {
      originalConfig.entry.splice(-1, 1, customizeEntry)
      delete customizeConfig.entry
    }
    if (chunkName) {
      originalConfig.entry = { [chunkName]: originalConfig.entry }
      if (customizeConfig.entry) {
        customizeConfig.entry = { [chunkName]: customizeEntry }
      }
      overrideManifestPluginForEntry(chunkName, originalConfig)
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
  const ownPath = paths['ownPath'] || resolvePackage.resolveReactScriptsPath()
  const modulePath = require.resolve(path.join(ownPath, 'config', 'paths.js'), {
    paths: [resolvePackage.cwd],
  })
  paths[prop] = val
  const cached = require.cache[modulePath].exports
  if (cached[prop] !== val) {
    cached[prop] = val
  }
}

//
function overrideManifestPluginForEntry(chunkName, originalConfig) {
  const ManifestPlugin = resolvePackage('webpack-manifest-plugin')
  for (const plug of originalConfig.plugins) {
    if (plug instanceof ManifestPlugin) {
      const { opts } = plug
      const { generate } = opts
      opts.generate = (seed, files, entrypoints) => {
        const replaced = entrypoints[chunkName]
        delete entrypoints[chunkName]
        entrypoints.main = replaced
        const res = generate(seed, files, entrypoints)
        delete entrypoints.main
        entrypoints[chunkName] = replaced
        return res
      }
    }
  }
}
