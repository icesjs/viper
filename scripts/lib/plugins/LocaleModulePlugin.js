const path = require('path')
const { addBeforeLoader } = require('./pluginUtils')

// 语言模块解析加载插件
class LocaleModulePlugin {
  constructor(options) {
    this.options = Object.assign({}, options)
  }

  apply(compiler) {
    const { options = {} } = compiler
    compiler.options = options
    const rule = Object.assign(
      {
        test: /\.ya?ml$/,
      },
      this.options,
      {
        loader: path.join(__dirname, '../locale/loader.js'),
      }
    )
    addBeforeLoader(options, rule, ['file-loader', 'url-loader'])
  }
}

module.exports = LocaleModulePlugin
