const path = require('path')
const { resolveModule } = require('../resolve')
const webpack = resolveModule('webpack')
/**
 * 检查全局变量路径定义，并发布错误警告
 * Options:
 * - ignored
 * - ignoredLoaders
 * - strict
 */
class CheckGlobalPathsPlugin {
  constructor(opts) {
    this.options = Object.assign(
      {
        ignored: null,
        ignoredLoader: null,
        strict: true,
      },
      opts
    )
    const cwd = process.cwd()
    const defaultIgnoredLoaders = [
      // 使用bindingsRuntime处理插件导入时，也会使用__dirname变量，这里也不做检查
      path.join(__dirname, 'addons/bindingsRuntime.js'),
    ]
    const defaultIgnored = [
      // 脚本目录下的代码会用一些辅助构建的变量，所以要忽略处理
      path.resolve(path.relative(cwd, __filename).replace(/[\\/].*/g, '')),
    ]
    const { ignored, ignoredLoaders } = this.options
    const userIgnored = (Array.isArray(ignored) ? ignored : [ignored]).filter(
      (item) =>
        item && (typeof item === 'string' || item instanceof RegExp || typeof item === 'function')
    )
    const userIgnoredLoaders = (Array.isArray(ignoredLoaders) ? ignoredLoaders : [ignoredLoaders])
      .filter((item) => item && typeof item === 'string')
      // 如果不是绝对路径，则当成模块解析其路径
      .map((item) => (path.isAbsolute(item) ? item : require.resolve(item, { paths: [cwd] })))
    //
    Object.assign(this.options, {
      ignored: [...defaultIgnored, ...userIgnored].map((item) =>
        typeof item === 'string' ? path.normalize(item) : item
      ),
      ignoredLoaders: [...defaultIgnoredLoaders, ...userIgnoredLoaders].map((item) =>
        path.normalize(item)
      ),
    })
  }

  apply(compiler) {
    const { options = {} } = compiler
    const { mode, target, node = {} } = options
    compiler.options = options
    this.target = target
    this.mode = mode
    this.isEnvElectron = /^electron-(?:main|renderer)$/.test(target)
    if (this.isEnvElectron) {
      node.__dirname = false
      node.__filename = false
    } else {
      node.__dirname = 'mock'
      node.__filename = 'mock'
    }
    options.node = node
    this.checkGlobalVars(compiler)
  }

  /**
   * 检查全局路径变量
   * @param compiler
   */
  checkGlobalVars(compiler) {
    const { strict } = this.options
    if (!this.isEnvElectron || (!strict && this.mode !== 'development')) {
      // 非electron目标运行环境构建，webpack使用mock的值，不做处理
      // 产品模式，非严格检查，不处理路径变量
      return
    }
    // 定义运行时值，对全局路径变量进行检查
    new webpack.DefinePlugin({
      __dirname: webpack.DefinePlugin.runtimeValue(({ module }) =>
        this.checkRuntimeValue('__dirname', module.context, module)
      ),
      __filename: webpack.DefinePlugin.runtimeValue(({ module }) =>
        this.checkRuntimeValue('__filename', module.resource, module)
      ),
    }).apply(compiler)
  }

  /**
   * 检查全局路径变量运行时值
   * @param name
   * @param value
   * @param module
   * @returns {string|*}
   */
  checkRuntimeValue(name, value, module) {
    if (this.isIgnoredLoaderRequest(module)) {
      // 使用loader转化后的资源路径，不进行检查，返回变量名
      return name
    }
    const { strict } = this.options
    if (this.mode !== 'development') {
      // 产品模式，严格检查
      if (this.isIgnored(name, value, module)) {
        // 忽略检查的路径，返回路径变量
        return name
      }
    } else if (!strict || this.isIgnored(name, value, module)) {
      // 开发模式
      // 非严格检查，或忽略的路径，返回真实路径值
      return JSON.stringify(value)
    }
    // 严格检查非忽略的路径资源，抛出编译错误
    const error = new Error(
      `The ${name} variable is forbidden because of the path of resources will change after packaging. Please use import or require to get the required resources ${this.getSourceFileLocation(
        module
      )}`
    )
    error.stack = ''
    throw error
  }

  /**
   * 判断给定的路径值是否是忽略检查的路径
   * @param name
   * @param value
   * @param module
   * @returns {boolean}
   */
  isIgnored(name, value, module) {
    const { ignored } = this.options
    return ignored.some((item) => {
      if (typeof item === 'string') {
        return value.startsWith(item)
      }
      if (item instanceof RegExp) {
        return item.test(value)
      }
      if (typeof item === 'function') {
        return !!item(name, value, module)
      }
      return false
    })
  }

  /**
   * 判断当前模块所使用的loader是否是需要忽略检查的
   * @param module
   * @returns {boolean}
   */
  isIgnoredLoaderRequest(module) {
    const { request } = module
    const { ignoredLoaders } = this.options
    // 其中包含被loader处理的资源，如果也与当前模块匹配的话，同样忽略
    const appliedLoaders = request.split('!').map((res) => path.normalize(res.replace(/\?.*/, '')))
    return ignoredLoaders.some((res) => appliedLoaders.includes(res))
  }

  getSourceFileLocation(module) {
    return `(found in: ${module.resource})`
  }
}

module.exports = CheckGlobalPathsPlugin
