//
const StyleLintPlugin = require('stylelint-webpack-plugin')
const { customizeCracoWebpack, resolvePackage } = require('../scripts/lib/utils')
const webpack = resolvePackage('webpack')

const {
  RENDERER_CONTEXT,
  RENDERER_CONTEXT_ALIAS,
  RENDERER_ENTRY,
  RENDERER_BUILD_PATH,
} = require('./consts')

const { RENDERER_BUILD_TARGET } = process.env
const target = /^(web|electron-renderer)$/.test(RENDERER_BUILD_TARGET)
  ? RegExp.$1
  : 'electron-renderer'

module.exports = customizeCracoWebpack({
  target,
  entry: RENDERER_ENTRY,
  output: { path: RENDERER_BUILD_PATH },
  resolve: {
    alias: {
      [RENDERER_CONTEXT_ALIAS]: RENDERER_CONTEXT,
    },
  },
  plugins: [
    new StyleLintPlugin({
      configBasedir: process.cwd(),
      context: RENDERER_CONTEXT,
      files: ['**/*.{css,scss}'],
    }),
    new webpack.EnvironmentPlugin({
      IS_ELECTRON: target !== 'web',
    }),
  ],
})
