const path = require('path')
const { resolvePackage } = require('../resolve')
const webpack = resolvePackage('webpack')

class RequireStaticResourcesPlugin {
  constructor(opts) {
    this.options = Object.assign(
      {
        checkGlobalVars: true,
        test: / /,
      },
      opts
    )
    let { checkGlobalVars } = this.options
    const defaultIgnored = [
      path.resolve(path.relative(process.cwd(), __filename).replace(/[\\/].*/g, '')),
    ]
    if (typeof checkGlobalVars === 'boolean' || typeof checkGlobalVars !== 'object') {
      checkGlobalVars = {
        enabled: !!checkGlobalVars,
        ignored: defaultIgnored,
        strict: true,
      }
    } else {
      const ignored = Array.isArray(checkGlobalVars.ignored) ? checkGlobalVars.ignored : []
      Object.assign(
        {
          enabled: true,
          strict: true,
        },
        checkGlobalVars,
        {
          ignored: [...ignored, ...defaultIgnored],
        }
      )
    }
    this.options.checkGlobalVars = checkGlobalVars
  }

  apply(compiler) {
    const { checkGlobalVars } = this.options
    const { options = {} } = compiler
    const { mode, node = {} } = options
    node.__dirname = false
    node.__filename = false
    options.node = node
    compiler.options = options
    //
    if (checkGlobalVars.enabled) {
      if (mode !== 'development' && !checkGlobalVars.strict) {
        // 产品模式，非严格检查，不处理路径变量
        return
      }
      new webpack.DefinePlugin({
        __dirname: webpack.DefinePlugin.runtimeValue(({ module }) =>
          this.checkGlobalRuntimeValue(mode, '__dirname', module.context)
        ),
        __filename: webpack.DefinePlugin.runtimeValue(({ module }) =>
          this.checkGlobalRuntimeValue(mode, '__filename', module.resource)
        ),
      }).apply(compiler)
    }
  }

  checkGlobalRuntimeValue(mode, name, value) {
    const { strict, ignored } = this.options.checkGlobalVars
    const isIgnoredPath = ignored.some((path) => value.startsWith(path))
    if (mode !== 'development') {
      // 产品模式，严格检查
      if (isIgnoredPath) {
        // 忽略检查的路径，返回路径变量
        return name
      }
    } else if (!strict || isIgnoredPath) {
      // 开发模式
      // 非严格检查，或忽略的路径，返回真实路径值
      return JSON.stringify(value)
    }
    // 严格检查非忽略的路径资源，抛出编译错误
    throw new Error(
      `The ${name} variable is forbidden because of the path of resources will change after packaging\nPlease use import or require to get the required resources`
    )
    // throw new Error(
    //   `The ${name} variable is forbidden because of the path of resources will change after packaging\nPlease use import or require to get the required resources`
    // )
  }
}

module.exports = RequireStaticResourcesPlugin
