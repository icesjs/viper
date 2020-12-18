//
const StyleLintPlugin = require('stylelint-webpack-plugin')
const resolvePackage = require('../scripts/lib/resolve')
const webpack = resolvePackage('webpack')

const {
  PROJECT_CONTEXT,
  RENDERER_CONTEXT,
  RENDERER_CONTEXT_ALIAS,
  RENDERER_ENTRY,
  RENDERER_BUILD_PATH,
} = require('./consts')

const { RENDERER_BUILD_TARGET } = process.env
const target = !/^(web|electron-renderer)$/.test(RENDERER_BUILD_TARGET)
  ? 'electron-renderer'
  : RegExp.$1

//
const customizeWebpackConfig = {
  target,
  entry: {
    index: RENDERER_ENTRY,
  },
  output: { path: RENDERER_BUILD_PATH },
  resolve: {
    alias: {
      [RENDERER_CONTEXT_ALIAS]: RENDERER_CONTEXT,
    },
  },
  plugins: [
    new StyleLintPlugin({
      configBasedir: PROJECT_CONTEXT,
      context: RENDERER_CONTEXT,
      files: ['**/*.{css,scss}'],
    }),
    new webpack.EnvironmentPlugin({
      IS_ELECTRON: target !== 'web',
    }),
  ],
}

//
module.exports = {
  configure: customizeWebpackConfig,
}
