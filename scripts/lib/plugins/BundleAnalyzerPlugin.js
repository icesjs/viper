const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
const { formatDate } = require('../utils')

class BundleAnalyzerWebpackPlugin {
  constructor(options) {
    this.options = Object.assign(
      {
        analyzerMode: 'server',
        analyzerPort: 'auto',
      },
      options
    )
  }

  apply(compiler) {
    const { options } = compiler
    const { target = 'web' } = options || {}
    const analyzerOptions = this.getAnalyzerOptions(target)
    new BundleAnalyzerPlugin(analyzerOptions).apply(compiler)
  }

  getAnalyzerOptions(target) {
    const options = { ...this.options }
    const { analyzerMode, reportTitle } = options
    if (!reportTitle && analyzerMode === 'server') {
      const targetName = target.replace(/^electron-/i, '').replace(/^./, (c) => c.toUpperCase())
      options.reportTitle = `${targetName} - ${formatDate('h:i:s')}`
    }
    const analyzerPort = +process.env.ANALYZER_SERVER_PORT || 'auto'
    return { ...options, analyzerPort }
  }
}

module.exports = BundleAnalyzerWebpackPlugin
