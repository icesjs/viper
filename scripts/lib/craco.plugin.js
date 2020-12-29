//
module.exports = {
  //
  overrideCracoConfig({ cracoConfig }) {
    const { webpack = {} } = cracoConfig
    const { configure } = webpack || {}
    if (configure !== null && typeof configure === 'object') {
      webpack.configure = customizeCracoWebpackConfigure(configure)
    }
    return cracoConfig
  },

  //
  overrideWebpackConfig({ webpackConfig }) {
    const { target } = webpackConfig
    if (target === 'electron-renderer') {
      addNativeAddonsLoader(webpackConfig)
    }
    customizeOptimization(webpackConfig)
    return webpackConfig
  },
}

const path = require('path')
const { mergeWithCustomize } = require('webpack-merge')
const { addBeforeLoader, loaderByName } = require('@craco/craco')
const { resolvePackage, resolveReactScriptsPath } = require('./resolve')
const { ADDONS_BUILD_PATH } = require('../../config/consts')
const cwd = process.cwd()

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

function customizeOptimization(webpackConfig) {
  const { optimization = {} } = webpackConfig
  const { GENERATE_FULL_SOURCEMAP } = process.env
  if (GENERATE_FULL_SOURCEMAP !== 'false') {
    optimization.minimize = false
    webpackConfig.optimization = optimization
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
    if (Array.isArray(originalConfig.entry)) {
      // 老版本构建脚本，hmr使用entry形式
      const replaced = Array.isArray(customizeEntry) ? customizeEntry : [customizeEntry]
      originalConfig.entry.splice(-1, 1, ...replaced)
    } else {
      // 新版本构建脚本，react v17使用fast refresh
      originalConfig.entry = customizeEntry
    }
    delete customizeConfig.entry
    if (chunkName) {
      originalConfig.entry = { [chunkName]: originalConfig.entry }
      overrideManifestPluginForEntry(chunkName, originalConfig)
    }
    overrideCRAPaths(
      context,
      'appIndexJs',
      Array.isArray(customizeEntry) ? customizeEntry[customizeEntry.length - 1] : customizeEntry
    )
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
  const ownPath = paths['ownPath'] || resolveReactScriptsPath()
  const modulePath = require.resolve(path.join(ownPath, 'config', 'paths.js'), {
    paths: [cwd],
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
  const { extensions = [], alias = {} } = resolve
  const { rules = [] } = module

  if (!extensions.includes('.node')) {
    extensions.push('.node')
  }

  const addonsLoader = {
    test: /\.node$/,
    loader: path.join(cwd, 'scripts/lib/native.loader.js'),
    options: {
      output: {
        path: ADDONS_BUILD_PATH,
      },
    },
  }
  let { isAdded } = addBeforeLoader(webpackConfig, loaderByName('file-loader'), addonsLoader)
  if (!isAdded) {
    isAdded = addBeforeLoader(webpackConfig, loaderByName('url-loader'), addonsLoader).isAdded
  }
  if (!isAdded) {
    rules.push(addonsLoader)
  }

  Object.assign(alias, { ...require('./native.loader.js').aliasMap })

  resolve.extensions = extensions
  resolve.alias = alias
  webpackConfig.resolve = resolve
  module.rules = rules
  webpackConfig.module = module
}
