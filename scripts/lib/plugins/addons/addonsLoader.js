const path = require('path')
const { promisify } = require('util')
const fs = require('fs-extra')
const loaderUtils = require('loader-utils')
const bindings = require('bindings')
const { log } = require('../../logger')
const { relativePath, getPackageJson } = require('../../utils')

const {
  getOptions,
  getFileReader,
  getCodeSnippet,
  getBindingsCodeSnippet,
  normalizeModulePath,
  resolveModulePackagePath,
  readAddonsOutputPackageJson,
  LoaderError,
  LoaderWarning,
} = require('./loaderUtils')

// 发布文件资源至webpack
async function emitRawSourceFile(content, options) {
  const {
    flags,
    appBuildPath,
    output: { filename: namePattern, path: outputPath },
  } = options
  const {
    options: { output: compilerOutput },
    // 这里用到了hack属性 _compiler
    // 以后可能会被webpack移除掉
  } = this._compiler

  const isEnvDevelopment = this.mode === 'development'
  const isRendererProcess = this.target === 'electron-renderer'
  const filename = loaderUtils.interpolateName(this, namePattern, {
    context: this.rootContext,
    content,
  })
  const absFilename = path.join(outputPath, filename)
  const rootContext = isEnvDevelopment ? this.rootContext : path.resolve(appBuildPath)
  const relativeFromBuildOutputEmitFilePath = relativePath(compilerOutput.path, absFilename)
  const relativeFromRootContextEmitFilePath = relativePath(rootContext, absFilename)

  // 发布文件到webpack文件管理
  this.emitFile(relativeFromBuildOutputEmitFilePath, content)

  if (isEnvDevelopment && isRendererProcess) {
    // 客户端开发环境，会使用内存文件系统，require的插件，还需要写到物理磁盘上
    await promisify(fs.outputFile)(absFilename, content)
  }

  const modulePath = isRendererProcess
    ? relativeFromRootContextEmitFilePath
    : relativeFromBuildOutputEmitFilePath

  return {
    isFromNodeModules: false,
    modulePath,
    flags,
  }
}

//
async function generateProductionCodeForAddons(source, options) {
  return getCodeSnippet.apply(this, [
    {
      ...(await emitRawSourceFile.apply(this, [source, options])),
      filePath: normalizeModulePath.call(this, this),
      isMainProcess: this.target === 'electron-main',
    },
  ])
}

//
async function getDevelopmentPathsForAddons(source, options, modulePackagePath) {
  // 需要检查该路径是否在当前工程下
  if (relativePath(process.cwd(), fs.realpathSync(modulePackagePath)).startsWith('..')) {
    return await emitRawSourceFile.apply(this, [source, options])
  }

  const { flags } = options
  const { name } = require(modulePackagePath)
  const normalizedResourcePath = path.normalize(this.resourcePath)
  let modulePath

  // 以模块包的形式导入
  if (!flags) {
    let resolvedModuleMain
    try {
      resolvedModuleMain = require.resolve(name, { paths: [this.rootContext] })
    } catch (e) {}
    if (resolvedModuleMain === normalizedResourcePath) {
      modulePath = name
    }
  }
  if (!modulePath) {
    // 以模块包下文件路径形式导入
    const pathname = normalizedResourcePath
      .replace(path.join(modulePackagePath, '..'), '')
      .replace(/^[/\\]/, '')
    modulePath = path.join(name, pathname).replace(/\\/g, '/')
  }
  return {
    isFromNodeModules: true,
    modulePath,
    flags,
  }
}

//
async function generateRequireModuleCode(content, options, modulePackagePath) {
  if (!modulePackagePath || this.mode !== 'development') {
    return await generateProductionCodeForAddons.apply(this, [content, options])
  }
  const paths = await getDevelopmentPathsForAddons.apply(this, [
    content,
    options,
    modulePackagePath,
  ])
  return getCodeSnippet.apply(this, [
    {
      ...paths,
      filePath: normalizeModulePath.call(this, this),
      isMainProcess: this.target === 'electron-main',
    },
  ])
}

//
async function setNativeDependency(source, options, modulePackagePath) {
  if (!(await isCompatibleForInstalledElectron.apply(this, [source]))) {
    throw new Error(
      `This local addon is not compatible for current platform, you need rebuild it first:\n${this.resourcePath}`
    )
  }
  if (!options.makeNativeDependencyPackageJson) {
    return
  }
  if (modulePackagePath) {
    // 写入依赖信息到工程构建配置
    const modulePackageJson = require(modulePackagePath)
    const { name, version } = modulePackageJson
    const { dependencies: projectDeps = {}, devDependencies: projectDevDeps } = getPackageJson()
    const {
      output: { path: outputPath },
    } = options
    const outputPackagePath = path.resolve(outputPath, 'package.json')
    const addonsDependencies = {}
    if (projectDeps[name]) {
      addonsDependencies[name] = projectDeps[name]
    } else if (projectDevDeps[name]) {
      addonsDependencies[name] = projectDevDeps[name]
      this.emitWarning(
        new LoaderWarning(
          `You should install the dependency named of ${name} to 'dependencies' rather than 'devDependencies'`
        )
      )
    } else {
      addonsDependencies[name] = version
    }
    const outputPackage = readAddonsOutputPackageJson.apply(this, [outputPackagePath])
    Object.assign(outputPackage.dependencies, addonsDependencies)
    fs.outputFileSync(outputPackagePath, JSON.stringify(outputPackage))
  }
}

// 插件兼容性检查
const compatibleResultCache = {}
async function isCompatibleForInstalledElectron(content) {
  const hash = loaderUtils.interpolateName(this, '[contenthash]', { content })
  const cachedResult = compatibleResultCache[hash]
  if (cachedResult !== undefined) {
    return cachedResult
  }
  let compatible
  try {
    // 使用electron运行来检查
    await new Promise((resolve, reject) => {
      const spawn = require('cross-spawn')
      spawn(require('electron'), ['checkCompatibility.js'], {
        stdio: 'ignore',
        cwd: __dirname,
        env: {
          NATIVE_LOADER_ADDONS_COMPATIBLE_CHECK_PATH: this.resourcePath,
        },
        windowsHide: true,
      }).once('exit', (code) => (code === 0 ? resolve({ code }) : reject({ code })))
    })
    compatible = true
  } catch (e) {
    if (e.code === 2) {
      process.exit(2)
    }
    compatible = false
  }
  compatibleResultCache[hash] = compatible
  return compatible
}

//
async function readNodeAddonsSourceFromContext(context) {
  const targetNameRegx = /(['"])target_name\1\s*:\s*(['"])(.*?)\2/g
  const readFile = getFileReader(this)
  const gyp = (await readFile(path.join(context, 'binding.gyp'))).toString()
  const targetNames = []
  let regxResult
  while ((regxResult = targetNameRegx.exec(gyp)) !== null) {
    targetNames.push(regxResult[3])
  }
  const findNames = [...targetNames]
  if (!findNames.length) {
    findNames.push('bindings')
  }

  // 使用bindings在编译阶段先查找出对应的addons文件
  const sources = []
  for (const name of findNames) {
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
      log.error(e)
    }
  }
  if (sources.length) {
    return sources
  }
  if (targetNames.length) {
    throw new Error(
      `Can not find the node addon module from ${normalizeModulePath(
        Object.assign(Object.create(this), { resourcePath: context })
      )}, you should rebuild it first`
    )
  }
}

// 有可能在模块下找到了多个的插件
// 这里需要根据运行时函数请求的名称，来加载对应的插件
async function makeModuleCodeWithBindings(addonsSources, options) {
  const addonsList = []
  const isDevEnvironment = this.mode === 'development'
  const isMainProcess = this.target === 'electron-main'
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
      paths = await getDevelopmentPathsForAddons.apply(addonsLoaderContext, [
        source,
        options,
        addonsModulePackagePath,
      ])
    } else {
      paths = await emitRawSourceFile.apply(addonsLoaderContext, [source, options])
    }

    addonsList.push({
      ...paths,
      filePath: normalizeModulePath.call(addonsLoaderContext, addonsLoaderContext),
      isMainProcess,
      name,
    })
  }
  const runtimePath = path.join(__dirname, 'resolverRuntime.js')
  return getBindingsCodeSnippet.apply(this, [
    addonsList,
    loaderUtils.stringifyRequest(this, runtimePath),
  ])
}

//
async function requireNodeAddonsByBindings(options, modulePath) {
  const addonsSources = []
  const moduleRoot = path.resolve(modulePath)
  if (fs.existsSync(path.join(moduleRoot, 'binding.gyp'))) {
    const sources = await readNodeAddonsSourceFromContext.call(this, moduleRoot)
    if (sources) {
      addonsSources.push(...sources)
    }
  }
  return makeModuleCodeWithBindings.apply(this, [addonsSources, options])
}

// 用于将require('bindings')转发到当前loader来处理
const fakeAddonsResolver = path.join(__dirname, 'fakeAddons.node')

function requireNodeAddonsFromResolver(options, callback) {
  if (path.normalize(this.resourcePath) === fakeAddonsResolver) {
    const { resolver, module } = loaderUtils.parseQuery(this.resourceQuery)
    this.clearDependencies()
    if (resolver === 'bindings') {
      return requireNodeAddonsByBindings
        .apply(this, [options, module])
        .then((code) => callback(null, code))
        .catch((e) => callback(new LoaderError(e || 'Unknown Error')))
    }
  }
}

//
async function makeDirectRequireAddonsModuleCode(...args) {
  await setNativeDependency.apply(this, args)
  this.addDependency(this.resourcePath)
  return await generateRequireModuleCode.apply(this, args)
}

//
module.exports = function NodeAddonsLoader(source) {
  if (!/^electron-(?:main|renderer)$/i.test(this.target)) {
    this.callback(
      new LoaderError(
        `Node addons can only be used in electron platform, but current build target is ${this.target}`
      )
    )
    return
  }

  let options
  try {
    options = getOptions(this)
  } catch (e) {
    this.callback(new LoaderError(e))
    return
  }

  const args = [source, options]
  const callback = this.async()

  if (requireNodeAddonsFromResolver.apply(this, [options, callback])) {
    return
  }

  resolveModulePackagePath
    .apply(this, [this.rootContext, this.context])
    .then(makeDirectRequireAddonsModuleCode.bind(this, ...args))
    .then((code) => callback(null, code))
    .catch((e) => callback(new LoaderError(e || 'Unknown Error')))
}

module.exports.raw = true
