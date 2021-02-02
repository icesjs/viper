const path = require('path')
const { addBefore: addBeforeLoader } = require('@ices/use-loader')
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
      loader: path.join(__dirname, '../addons/loader.js'),
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
    const { options = {} } = compiler
    compiler.options = options
    this.setResolve(options)
    this.setModuleLoader(options)
  }

  /**
   * 添加loader配置
   */
  setModuleLoader(compilerOptions) {
    const { output = {} } = compilerOptions
    addBeforeLoader(
      compilerOptions,
      ({ name, isUseItem }) => !isUseItem && name === 'file-loader',
      this.getAddonsLoaderRule(output.path)
    )
  }

  /**
   * 添加resolve配置
   */
  setResolve(compilerOptions) {
    const { resolve = {} } = compilerOptions
    const { extensions = [], plugins = [] } = resolve
    resolve.extensions = extensions
    resolve.plugins = plugins
    compilerOptions.resolve = resolve
    if (!extensions.includes('.node')) {
      extensions.push('.node')
    }
    plugins.push(new BindingsModuleResolvePlugin())
  }
}

/**
 * webpack模块解析插件，用于将使用bindings导入的node插件转换为webpack导入
 */
class BindingsModuleResolvePlugin {
  apply(resolver) {
    const target = resolver.ensureHook('resolve')
    const forward = path.join(__dirname, '../addons/fakeAddons.node')
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
