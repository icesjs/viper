const fs = require('fs')
const path = require('path')
const { promisify } = require('util')
const findUp = require('find-up')
const { validate } = require('schema-utils')
const loaderUtils = require('loader-utils')
const { relativePath } = require('./utils')
const { log } = require('./logger')

const {
  optionsScheme,
  getFileReader,
  getCodeSnippet,
  getBindingsCodeSnippet,
} = require('./native.utils')

class Warning extends Error {
  constructor(warning) {
    super(warning)
    this.name = 'Warning'
    this.stack = undefined
  }
}

//
function gainOptions(loaderContext) {
  const options = Object.assign({}, loaderUtils.getOptions(loaderContext))
  validate({ ...optionsScheme }, options, { baseDataPath: 'options' })

  const { output = {}, makeNativeDependencyPackageJson = true } = options
  const { path: outputPath = 'build', filename } = output
  if (!path.isAbsolute(outputPath)) {
    output.path = path.resolve(outputPath)
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
}

//
function resolveModulePackagePath(rootContext, context) {
  const projectRoot = path.normalize(rootContext)
  return findUp((dir) => (projectRoot === path.normalize(dir) ? findUp.stop : 'package.json'), {
    cwd: context,
  })
}

//
function normalizeModulePath(loaderContext) {
  return relativePath(loaderContext.rootContext, loaderContext.resourcePath, false).replace(
    /^node_modules[/\\]/,
    ''
  )
}

//
function requireOutputPackage(pkgPath) {
  const projectPackage = require(path.resolve(this.rootContext, 'package.json'))
  const { name, version, main, author } = projectPackage
  let mainPath = path.resolve(main)
  try {
    mainPath = require.resolve(mainPath)
  } catch (e) {}
  const relativeMainPath = relativePath(path.dirname(pkgPath), mainPath)
  const pkg = fs.existsSync(pkgPath) ? require(pkgPath) : {}
  if (pkg.name !== name || pkg.version !== version || pkg.main !== relativeMainPath) {
    return {
      name,
      version,
      main: relativeMainPath,
      dependencies: {},
      author,
    }
  }
  const { dependencies } = pkg
  if (!dependencies || typeof dependencies !== 'object') {
    pkg.dependencies = {}
  }
  return pkg
}

// 发布文件资源至webpack
function emitRawSourceFile(content, options) {
  const {
    flags,
    output: { filename: namePattern, path: outputPath },
  } = options
  const {
    options: { output: compilerOutput },
    // 这里用到了hack属性 _compiler
    // 以后可能会被webpack移除掉
  } = this._compiler

  const filename = loaderUtils.interpolateName(this, namePattern, {
    content,
    context: this.rootContext,
  })
  const absFilename = path.join(outputPath, filename)
  const relativeFromBuildOutputEmitFilePath = relativePath(compilerOutput.path, absFilename)
  const relativeFromRootContextEmitFilePath = relativePath(this.rootContext, absFilename)

  this.emitFile(relativeFromBuildOutputEmitFilePath, content)

  return {
    flags,
    isFromNodeModules: false,
    fromBuildOutputModulePath: relativeFromBuildOutputEmitFilePath,
    fromRootContextModulePath: relativeFromRootContextEmitFilePath,
  }
}

//
function generateProductionCodeForAddons(source, options) {
  return getCodeSnippet.apply(this, [
    {
      ...emitRawSourceFile.apply(this, [source, options]),
      modulePath: normalizeModulePath.call(this, this),
      isMainProcess: this.target === 'electron-main',
    },
  ])
}

//
function getDevelopmentPathsForAddons(options, modulePackagePath) {
  const { flags } = options
  const { name } = require(modulePackagePath)
  const normalizedResourcePath = path.normalize(this.resourcePath)

  // 以模块包的形式导入
  if (!flags) {
    let resolvedModuleMain
    try {
      resolvedModuleMain = require.resolve(name, { paths: [this.rootContext] })
    } catch (e) {}
    if (resolvedModuleMain === normalizedResourcePath) {
      return {
        fromBuildOutputModulePath: name,
        fromRootContextModulePath: name,
        isFromNodeModules: true,
        flags,
      }
    }
  }

  // 以模块包下文件路径形式导入
  const pathname = normalizedResourcePath
    .replace(path.join(modulePackagePath, '..'), '')
    .replace(/^[/\\]/, '')
  const requirePath = path.join(name, pathname).replace(/\\/g, '/')
  return {
    fromBuildOutputModulePath: requirePath,
    fromRootContextModulePath: requirePath,
    isFromNodeModules: true,
    flags,
  }
}

//
function generateRequireModuleCode(content, options, modulePackagePath) {
  if (!modulePackagePath || this.mode !== 'development') {
    return generateProductionCodeForAddons.apply(this, [content, options])
  }
  const paths = getDevelopmentPathsForAddons.apply(this, [options, modulePackagePath])
  return getCodeSnippet.apply(this, [
    {
      ...paths,
      modulePath: normalizeModulePath.call(this, this),
      isMainProcess: this.target === 'electron-main',
    },
  ])
}

//
async function setNativeDependency(source, options, modulePackagePath) {
  if (!options.makeNativeDependencyPackageJson) {
    return
  }
  if (modulePackagePath) {
    // 写入依赖信息到工程构建配置
    const modulePackageJson = require(modulePackagePath)
    const { name, version } = modulePackageJson
    const {
      dependencies: projectDeps = {},
      devDependencies: projectDevDeps,
    } = require(path.resolve('package.json'))
    const {
      output: { path: outputPath },
    } = options
    const outputPackagePath = path.resolve(outputPath, 'package.json')
    const outputPackage = requireOutputPackage.apply(this, [outputPackagePath])

    if (projectDeps[name]) {
      outputPackage.dependencies[name] = projectDeps[name]
    } else if (projectDevDeps[name]) {
      outputPackage.dependencies[name] = projectDevDeps[name]
      this.emitWarning(
        new Warning(
          `You should install the dependency named of ${name} to 'dependencies' rather than 'devDependencies'`
        )
      )
    } else {
      outputPackage.dependencies[name] = version
    }

    await promisify(fs.writeFile)(outputPackagePath, JSON.stringify(outputPackage))
  } else {
    this.emitWarning(
      new Warning(`The native addons may need to be recompiled to fit the target environment`)
    )
  }
}

// 用于将require('bindings')转发到当前loader来处理
const fakedAddonsResolver = path.join(__dirname, 'native.loader.node')
const nativeAddonsModuleResolverMap = {
  // bindings是比较多使用的一个包，与webpack有兼容性问题，且不能在electron环境良好使用
  bindings$: `${fakedAddonsResolver}?resolver=bindings`,
}

//
async function readNativeAddonsSourceFromContext(context) {
  const targetNameRegx = /(['"])target_name\1\s*:\s*(['"])(.*?)\2/g
  const readFile = getFileReader(this)
  const gyp = (await readFile(path.join(context, 'binding.gyp'))).toString()
  const names = []
  let regxResult
  while ((regxResult = targetNameRegx.exec(gyp)) !== null) {
    names.push(regxResult[3])
  }
  if (!names.includes('bindings')) {
    names.push('bindings')
  }

  // 使用bindings在编译阶段先查找出对应的addons文件
  const bindings = require('bindings')
  const sources = []

  for (const name of names) {
    try {
      if (name === 'bindings' && sources.length) {
        break
      }
      const moduleContext = context
      const filePath = bindings({
        bindings: name,
        module_root: moduleContext,
        path: true,
      })
      if (filePath) {
        sources.push({
          path: filePath,
          context: moduleContext,
          name: name.endsWith('.node') ? name : `${name}.node`,
          source: await readFile(filePath),
        })
      }
    } catch (e) {
      const { DEBUG } = process.env
      if (DEBUG && DEBUG !== 'false') {
        log.error(e.message)
      }
    }
  }
  if (sources.length) {
    return sources
  }
}

// 有可能在模块下找到了多个的插件
// 这里需要根据运行时函数请求的名称，来加载对应的插件
async function makeModuleCodeWithBindings(addonsSources, options) {
  const addonsList = []
  const isDevEnvironment = this.mode === 'development'
  for (const { name, path: resourcePath, source, context } of addonsSources) {
    const addonsLoaderContext = Object.assign(Object.create(this), {
      resourcePath,
      context,
      options,
    })
    const addonsModulePackagePath = path.join(context, 'package.json')
    await setNativeDependency.apply(addonsLoaderContext, [source, options, addonsModulePackagePath])
    this.addDependency(resourcePath)
    let paths
    // 计算路径信息
    if (isDevEnvironment) {
      paths = getDevelopmentPathsForAddons.apply(addonsLoaderContext, [
        options,
        addonsModulePackagePath,
      ])
    } else {
      paths = emitRawSourceFile.apply(addonsLoaderContext, [source, options])
    }

    addonsList.push({
      ...paths,
      name,
      modulePath: normalizeModulePath.call(addonsLoaderContext, addonsLoaderContext),
      isMainProcess: this.target === 'electron-main',
    })
  }
  return getBindingsCodeSnippet.apply(this, [addonsList])
}

//
async function requireNativeAddonsByBindings(options) {
  // 这里用到了hack属性 _module
  // 以后可能会被webpack移除掉
  const module = this._module
  const { reasons } = Object.assign({}, module)
  const addonsSources = []
  if (Array.isArray(reasons)) {
    for (const { module } of reasons) {
      const { context } = Object.assign({}, module)
      if (!context || typeof context !== 'string') {
        continue
      }
      const modulePackagePath = await resolveModulePackagePath.apply(this, [
        this.rootContext,
        context,
      ])
      if (!modulePackagePath) {
        continue
      }
      const moduleRoot = path.dirname(modulePackagePath)
      if (fs.existsSync(path.join(moduleRoot, 'binding.gyp'))) {
        const sources = await readNativeAddonsSourceFromContext.call(this, moduleRoot)
        if (sources) {
          addonsSources.push(...sources)
        }
      }
    }
  }

  return makeModuleCodeWithBindings.apply(this, [addonsSources, options])
}

//
function requireNativeAddonsFromResolver(options, callback) {
  if (path.normalize(this.resourcePath) === fakedAddonsResolver) {
    const { resolver } = loaderUtils.parseQuery(this.resourceQuery)
    this.clearDependencies()
    if (resolver === 'bindings') {
      return requireNativeAddonsByBindings
        .apply(this, [options])
        .then((code) => callback(null, code))
        .catch(callback)
    }
  }
}

//
async function makeDirectRequireAddonsModuleCode(...args) {
  await setNativeDependency.apply(this, args)
  this.addDependency(this.resourcePath)
  return generateRequireModuleCode.apply(this, args)
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

  const args = [source, options]
  const callback = this.async()

  if (requireNativeAddonsFromResolver.apply(this, [options, callback])) {
    return
  }

  resolveModulePackagePath
    .apply(this, [this.rootContext, this.context])
    .then(makeDirectRequireAddonsModuleCode.bind(this, ...args))
    .then((code) => callback(null, code))
    .catch((e) => callback(e || new Error('Unknown Error')))
}

module.exports.raw = true

module.exports.aliasMap = nativeAddonsModuleResolverMap
