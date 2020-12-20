//
module.exports = {
  //
  overrideCracoConfig: ({ cracoConfig }) => {
    const { webpack = {} } = cracoConfig
    const { configure } = webpack || {}
    if (configure !== null && typeof configure === 'object') {
      webpack.configure = customizeCracoWebpackConfigure(configure)
    }
    return cracoConfig
  },

  //
  overrideWebpackConfig: ({ webpackConfig }) => {
    const { target, optimization = {} } = webpackConfig
    if (target === 'electron-renderer') {
      addNativeAddonsLoader(webpackConfig)
    }
    const { DEBUG } = process.env
    if (DEBUG && DEBUG !== 'false') {
      optimization.minimize = false
      webpackConfig.optimization = optimization
    }
    return webpackConfig
  },
  //
  overrideDevServerConfig: ({ devServerConfig }) => {
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
const { addBeforeLoader, loaderByName } = require('@craco/craco')
const resolvePackage = require('./resolve')
const { NATIVE_ADDONS_OUTPUT_PATH } = require('../../config/consts')

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

//
function addNativeAddonsLoader(webpackConfig) {
  const { resolve = {}, module = {} } = webpackConfig
  const { extensions = [] } = resolve
  const { rules = [] } = module

  if (!extensions.includes('.node')) {
    extensions.push('.node')
  }

  const addonsLoader = {
    test: /\.node$/,
    loader: path.join(resolvePackage.cwd, 'scripts/lib/native.loader.js'),
    options: {
      output: {
        path: NATIVE_ADDONS_OUTPUT_PATH,
      },
      prebuild: true,
    },
  }
  let { isAdded } = addBeforeLoader(webpackConfig, loaderByName('file-loader'), addonsLoader)
  if (!isAdded) {
    isAdded = addBeforeLoader(webpackConfig, loaderByName('url-loader'), addonsLoader).isAdded
  }
  if (!isAdded) {
    rules.push(addonsLoader)
  }

  resolve.extensions = extensions
  webpackConfig.resolve = resolve
  module.rules = rules
  webpackConfig.module = module
}
