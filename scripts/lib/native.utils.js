const path = require('path')
const fs = require('fs-extra')
const schemaUtils = require('schema-utils')
const loaderUtils = require('loader-utils')
const findUp = require('find-up')
const { relativePath, getPackageJson } = require('./utils')

class LoaderWarning extends Error {
  constructor(warning) {
    super(warning)
    this.name = 'Warning'
    this.stack = undefined
    this.message = `Warning: ${this.message}`
  }
}

class LoaderError extends Error {
  constructor(error) {
    super(error)
    this.name = 'Error'
    this.stack = undefined
    this.message = `Error: ${this.message}`
  }
}

const loaderName = 'native-addons-loader'

const optionsSchema = {
  title: `${loaderName} options`,
  type: 'object',
  properties: {
    output: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The output filename that the native addons file will be use',
        },
        path: {
          type: 'string',
          description: 'The output path that the native addons info will be generated in',
        },
      },
      additionalProperties: false,
    },
    buildPath: {
      description: 'Compiler build output path',
      type: 'string',
    },
    appBuildPath: {
      description: 'App build dir, for packaged',
      type: 'string',
    },
    flags: {
      description: 'An integer that allows to specify dlopen behavior. See the [process.dlopen]',
      type: 'integer',
    },
    makeNativeDependencyPackageJson: {
      description: 'Used to generate dependency lists',
      type: 'boolean',
    },
  },
  additionalProperties: false,
}

//
module.exports = exports = {
  loaderName,
  LoaderError,
  LoaderWarning,
  //
  getBindingsCodeSnippet(addonsList, runtime) {
    return `/* ${addonsList.map(({ filePath }) => filePath).join('\n * ')} */
      const runtime = require(${runtime});
      module.exports = exports = function fakedBindings(bindingsOptions) {
        return runtime(bindingsOptions, ${JSON.stringify(
          addonsList.map(({ filePath, ...addon }) => addon)
        )}, ${JSON.stringify(loaderName)})
      }
      exports.getRoot = function getRoot(){return ''}
      exports.getFileName = function getFileName(){return ''}
    `
  },

  //
  getCodeSnippet({ isFromNodeModules, isMainProcess, modulePath, filePath, flags }) {
    const usedFlags = typeof flags !== 'undefined'
    return `
      try {
         /* ${filePath} */
         const path = __non_webpack_require__('path')
         if (${JSON.stringify(isMainProcess)}) {
           ${usedFlags ? 'process.dlopen(module,' : 'module.exports=__non_webpack_require__('}
           ${isFromNodeModules ? '' : 'path.join(__dirname,'}
           ${JSON.stringify(modulePath)}
           ${isFromNodeModules ? '' : ')'}
           ${usedFlags ? `,${JSON.stringify(flags)}` : ''})
         } else {
           const { remote } = __non_webpack_require__('electron')
           if (!remote) {
             throw new Error('Can not get remote module from electron. (enableRemoteModule)')
           }
           const appPath = remote.app.getAppPath();
           ${usedFlags ? 'remote.process.dlopen(module,' : 'module.exports=remote.require('}
           ${isFromNodeModules ? '' : 'path.join(appPath,'}
           ${JSON.stringify(modulePath)}
           ${isFromNodeModules ? '' : ')'}
           ${usedFlags ? `,${JSON.stringify(flags)}` : ''})
         }
      } catch (error) {
          throw new Error('${loaderName}: ' + error)
      }
    `
  },

  //
  getFileReader(loaderContext) {
    const fis = (loaderContext && loaderContext.fs) || fs
    return (fp) =>
      new Promise((resolve, reject) => {
        fis.readFile(fp, (err, data) => {
          if (err) {
            reject(err)
          } else {
            resolve(data)
          }
        })
      })
  },

  //
  getOptions(loaderContext) {
    const options = Object.assign({}, loaderUtils.getOptions(loaderContext))
    schemaUtils.validate({ ...optionsSchema }, options, { baseDataPath: 'options' })

    const { output = {}, appBuildPath = 'build/', makeNativeDependencyPackageJson = true } = options
    const { path: outputPath = 'build/addons/', filename } = output
    if (!path.isAbsolute(outputPath)) {
      output.path = path.resolve(outputPath)
    }
    if (!path.isAbsolute(appBuildPath)) {
      options.appBuildPath = path.resolve(appBuildPath)
    }
    let namePattern = filename
    if (loaderContext.mode !== 'development') {
      namePattern = '[contenthash:16].[ext]'
    } else if (!filename) {
      namePattern = '[path][name].[ext]'
    }
    output.filename = namePattern
    options.output = output
    options.makeNativeDependencyPackageJson = makeNativeDependencyPackageJson
    return options
  },

  //
  resolveModulePackagePath(rootContext, context) {
    const projectRoot = path.normalize(rootContext)
    return findUp((dir) => (projectRoot === path.normalize(dir) ? findUp.stop : 'package.json'), {
      cwd: context,
    })
  },

  //
  normalizeModulePath(loaderContext) {
    return relativePath(loaderContext.rootContext, loaderContext.resourcePath, false).replace(
      /^node_modules[/\\]/,
      ''
    )
  },

  //
  readAddonsOutputPackageJson(pkgPath) {
    const { name, version } = getPackageJson()
    const pkg = fs.existsSync(pkgPath) ? fs.readJSONSync(pkgPath) : {}
    if (pkg.name !== name || pkg.version !== version) {
      return {
        name,
        version,
        description: 'List of native addons dependency required by this project.',
        dependencies: {},
      }
    }
    const { dependencies } = pkg
    if (!dependencies || typeof dependencies !== 'object') {
      pkg.dependencies = {}
    }
    return pkg
  },
}
