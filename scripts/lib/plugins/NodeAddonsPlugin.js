const path = require('path')
const { addBeforeLoader, loaderByName } = require('@craco/craco')
const { APP_BUILD_PATH, ADDONS_BUILD_PATH } = require('../../../config/constants')

/**
 * 对node addon进行webpack构建与打包支持
 */
class NodeAddonsWebpackPlugin {
  constructor(options) {
    this.options = Object.assign(
      {
        outputPath: ADDONS_BUILD_PATH, // 插件构建输出目录
        appBuildPath: APP_BUILD_PATH, // 打包的应用的根路径
        makeDependenciesJson: true, // 创建添加了插件依赖的package.json（可以当作清单查看）
        outputNamePattern: '', // 插件构建输出文件的名称模式
        flags: undefined, // 使用process.dlopen加载插件时的第二个参数
      },
      options
    )
  }

  /**
   * 获取loader的规则定义
   */
  getAddonsLoaderRule(buildPath) {
    const {
      outputPath,
      appBuildPath,
      makeDependenciesJson,
      outputNamePattern,
      flags,
    } = this.options
    return {
      test: /\.node$/,
      // 内部处理node插件的loader
      loader: path.join(__dirname, 'addons/addonsLoader.js'),
      options: {
        makeNativeDependencyPackageJson: makeDependenciesJson,
        appBuildPath,
        buildPath,
        output: {
          path: outputPath,
          filename: outputNamePattern,
        },
        flags,
      },
    }
  }

  apply(compiler) {
    let compilerOptions = compiler.options || {}
    compilerOptions = this.setResolve(compilerOptions)
    compilerOptions = this.setModuleLoader(compilerOptions)
    compiler.options = compilerOptions
  }

  /**
   * 添加loader配置
   */
  setModuleLoader(compilerOptions) {
    let { module, output } = compilerOptions
    let { rules } = module || {}
    if (!Array.isArray(rules)) {
      rules = []
    }
    module.rules = rules
    compilerOptions.module = module

    const rule = this.getAddonsLoaderRule((output || {}).path)
    if (!addBeforeLoader(compilerOptions, this.getLoaderMatcher('file-loader'), rule).isAdded) {
      if (!addBeforeLoader(compilerOptions, this.getLoaderMatcher('url-loader'), rule).isAdded) {
        rules.push(rule)
      }
    }
    return compilerOptions
  }

  /**
   * 根据loader名称获取规则匹配函数
   * @param loaderName 要匹配的loader名称
   */
  getLoaderMatcher(loaderName) {
    const pathMatcher = loaderByName(loaderName)
    return (rule) => {
      if (typeof rule === 'string') {
        return rule === loaderName || pathMatcher(rule)
      }
      if (typeof rule.loader === 'string') {
        return rule.loader === loaderName || pathMatcher(rule)
      }
    }
  }

  /**
   * 添加resolve配置
   */
  setResolve(compilerOptions) {
    let resolve = compilerOptions.resolve || {}
    let { extensions, plugins } = resolve
    if (!Array.isArray(extensions)) {
      extensions = []
    }
    if (!extensions.includes('.node')) {
      extensions.push('.node')
    }
    if (!Array.isArray(plugins)) {
      plugins = []
    }
    plugins.push(new BindingsModuleResolvePlugin())
    resolve.extensions = extensions
    resolve.plugins = plugins
    compilerOptions.resolve = resolve
    return compilerOptions
  }
}

/**
 * webpack模块解析插件，用于将使用bindings导入的node插件转换为webpack导入
 */
class BindingsModuleResolvePlugin {
  apply(resolver) {
    const target = resolver.ensureHook('resolve')
    const forward = path.join(__dirname, 'addons/fakeAddons.node')
    resolver
      .getHook('described-resolve')
      .tapAsync('BindingsModuleResolvePlugin', (request, resolveContext, callback) => {
        if (!request.module || request.request !== 'bindings') {
          return callback()
        }
        const { descriptionFileRoot } = request
        if (!descriptionFileRoot) {
          return callback()
        }
        const modulePath = path.relative(process.cwd(), descriptionFileRoot)
        // 修改模块请求，通过loader来处理addon的引入
        resolver.doResolve(
          target,
          Object.assign(request, {
            request: forward,
            query: `?resolver=bindings&module=${modulePath}`,
          }),
          `Forwarded module request to ${forward}`,
          resolveContext,
          callback
        )
      })
  }
}

module.exports = NodeAddonsWebpackPlugin
