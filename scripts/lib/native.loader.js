const fs = require('fs')
const path = require('path')
const { promisify } = require('util')
const findUp = require('find-up')
const { validate } = require('schema-utils')
const { getOptions, interpolateName } = require('loader-utils')

const loaderName = 'native-addons-loader'
const schema = {
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
    flags: {
      description: 'An integer that allows to specify dlopen behavior. See the [process.dlopen]',
      type: 'integer',
    },
    prebuild: {
      description: 'Set to precompiled execution, which is used to generate dependency lists',
      type: 'boolean',
    },
  },
  additionalProperties: false,
}

class Warning extends Error {
  constructor(warning) {
    super(warning)
    this.name = 'Warning'
    this.stack = undefined
  }
}

function gainOptions(loaderContext) {
  const options = Object.assign({}, getOptions(loaderContext))
  validate(schema, options, { baseDataPath: 'options' })

  const { output = {} } = options
  const {
    path: outputPath = 'build/addons',
    filename = loaderContext.mode === 'production'
      ? '[contenthash:10].[ext]'
      : '[path][name].[ext]',
  } = output
  if (!path.isAbsolute(outputPath)) {
    output.path = path.resolve(outputPath)
  }
  output.filename = filename
  options.output = output
  return options
}

function relativePath(from, to) {
  let relativePath = path.relative(from, to).replace(/\\/g, '/')
  if (!/^..?\//.test(relativePath)) {
    relativePath = `./${relativePath}`
  }
  return relativePath
}

function resolveModulePackagePath() {
  const projectRoot = path.normalize(this.rootContext)
  return findUp((dir) => (projectRoot === path.normalize(dir) ? findUp.stop : 'package.json'), {
    cwd: this.context,
  })
}

function requireOutputPackage(pkgPath) {
  const name = 'app-native-addons'
  const version = require(path.resolve(this.rootContext, 'package.json')).version
  const pkg = fs.existsSync(pkgPath) ? require(pkgPath) : {}
  if (pkg.name !== name || pkg.version !== version) {
    return {
      name,
      version,
      dependencies: {},
    }
  }
  const { dependencies } = pkg
  if (!dependencies || typeof dependencies !== 'object') {
    pkg.dependencies = {}
  }
  return pkg
}

//
function generateProductionCodeForAddons(content, options, relativeResourcePath) {
  const {
    flags,
    output: { filename: namePattern, path: outputPath },
  } = options
  const {
    options: { output: compilerOutput },
  } = this._compiler
  // 这里的相对路径求取是根据构建输出目录来的
  const relativePathFromBuildOutput = relativePath(compilerOutput.path, outputPath)
  const relativePathFromRootContext = relativePath(this.rootContext, outputPath)
  const filename = interpolateName(this, namePattern, { content, context: this.rootContext })
  const relativeFromBuildOutputEmitFilePath = path.join(relativePathFromBuildOutput, filename)
  const relativeFromRootContextEmitFilePath = path.join(relativePathFromRootContext, filename)

  this.emitFile(relativeFromBuildOutputEmitFilePath, content)

  const isMainProcess = this.target === 'electron-main'
  const usedFlags = typeof flags !== 'undefined'
  return `
      try {
         /* ${relativeResourcePath} */
         const path = __non_webpack_require__('path');
         if (${JSON.stringify(isMainProcess)}) {
           ${
             usedFlags ? 'process.dlopen(module,' : 'module.exports=__non_webpack_require__('
           } path.join(__dirname, ${JSON.stringify(relativeFromBuildOutputEmitFilePath)}) 
           ${usedFlags ? `,${JSON.stringify(flags)}` : ''})
         } else {
           const { remote } = __non_webpack_require__('electron')
           if (!remote) {
             throw new Error("Can not get remote module from electron. You should set BrowserWindow enableRemoteModule value to true ")
           }
           const appPath = remote.app.getAppPath()
           ${
             usedFlags ? 'remote.process.dlopen(module,' : 'module.exports=remote.require('
           } path.join(appPath, ${JSON.stringify(relativeFromRootContextEmitFilePath)}) 
           ${usedFlags ? `,${JSON.stringify(flags)}` : ''})
         }
      } catch (error) {
          throw new Error('${loaderName}: ' + error)
      }
    `
}

//
function generateRequireModuleCode(content, options, modulePackagePath) {
  const relativeResourcePath = relativePath(this.rootContext, this.resourcePath)
  if (!modulePackagePath || this.mode !== 'development') {
    return generateProductionCodeForAddons.apply(this, [content, options, relativeResourcePath])
  }

  const { name } = require(modulePackagePath)
  const normalizedResourcePath = path.normalize(this.resourcePath)

  let resolvedModuleMain
  try {
    resolvedModuleMain = require.resolve(name, { paths: [this.rootContext] })
  } catch (e) {}
  if (resolvedModuleMain === normalizedResourcePath) {
    return `/* ${relativeResourcePath} */\n module.exports = __non_webpack_require__(${JSON.stringify(
      name
    )})`
  }
  const pathname = normalizedResourcePath
    .replace(path.join(modulePackagePath, '..'), '')
    .replace(/^[/\\]/, '')
  const requirePath = path.join(name, pathname).replace(/\\/g, '/')
  return `/* ${relativeResourcePath} */\n module.exports = __non_webpack_require__(${JSON.stringify(
    requirePath
  )})`
}

//
async function setNativeAddonsDependency(source, options, modulePackagePath) {
  if (modulePackagePath) {
    // 写入依赖信息到工程构建配置
    const modulePackageJson = require(modulePackagePath)
    const { name, version } = modulePackageJson
    const {
      output: { path: outputPath },
    } = options
    const outputPackagePath = path.resolve(outputPath, 'package.json')
    const outputPackage = requireOutputPackage.apply(this, [outputPackagePath])
    outputPackage.dependencies[name] = version
    //
    await promisify(fs.writeFile)(outputPackagePath, JSON.stringify(outputPackage))
  } else {
    this.emitWarning(
      new Warning(`The local addons may need to be recompiled to fit the target environment`)
    )
  }
  // 创建加载模块的代码
  return generateRequireModuleCode.apply(this, [source, options, modulePackagePath])
}

//
module.exports = function NativeAddonsLoader(source) {
  if (!/^electron-(?:main|renderer)$/.test(this.target)) {
    this.callback(new Error('This loader can be used when the target environment is electron'))
    return
  }

  let options
  try {
    options = gainOptions(this)
  } catch (e) {
    this.callback(e)
    return
  }

  const callback = this.async()
  resolveModulePackagePath
    .apply(this, [source, options])
    .then(
      options.prebuild
        ? setNativeAddonsDependency.bind(this, source, options)
        : generateRequireModuleCode.bind(this, source, options)
    )
    .then((code) => callback(null, code))
    .catch((e) => callback(e || new Error('Unknown Error')))
}

module.exports.raw = true
