//
const path = require('path')
const StyleLintPlugin = require('stylelint-webpack-plugin')
const LocalePlugin = require('@ices/locale-webpack-plugin')
const NodeAddonsPlugin = require('../../scripts/lib/plugins/NodeAddonsPlugin')
const CheckGlobalPathsPlugin = require('../../scripts/lib/plugins/CheckGlobalPathsPlugin')
const BundleAnalyzerPlugin = require('../../scripts/lib/plugins/BundleAnalyzerPlugin')
const { resolveModule } = require('../../scripts/lib/resolve')

const webpack = resolveModule('webpack')

const {
  RENDERER_CONTEXT,
  RENDERER_CONTEXT_ALIAS,
  RENDERER_ENTRY,
  RENDERER_BUILD_PATH,
} = require('../constants')
const cwd = process.cwd()

const {
  RENDERER_BUILD_TARGET,
  ENABLE_NODE_ADDONS = 'false',
  ENABLE_BUNDLE_ANALYZER = 'false',
} = process.env

if (!/^(web|electron-renderer)$/.test(RENDERER_BUILD_TARGET)) {
  throw new Error('Renderer build target must set to web or electron-renderer')
}

const isEnvProduction = process.env.NODE_ENV === 'production'
const RENDERER_PRELOAD = path.join(__dirname, '../preload/renderer.js')
const target = RENDERER_BUILD_TARGET

//
const customizeWebpackConfig = {
  target,
  entry: {
    index: [RENDERER_PRELOAD, RENDERER_ENTRY],
  },
  output: { path: RENDERER_BUILD_PATH },
  resolve: {
    alias: {
      [RENDERER_CONTEXT_ALIAS]: RENDERER_CONTEXT,
    },
  },
  // 这是个publicAssets是自定义的属性，并不属于webpack配置项
  // 用于修改public静态资源目录，craco.plugin.js插件会处理这个属性
  publicAssets: path.resolve('public/web/'),
  plugins: [
    // 支持node addon的构建与打包
    // 注意，node addon仅在渲染模块以electron-renderer模式打包时可用
    ENABLE_NODE_ADDONS !== 'false' && new NodeAddonsPlugin(),
    isEnvProduction && ENABLE_BUNDLE_ANALYZER !== 'false' && new BundleAnalyzerPlugin(),
    // 检查__dirname和__filename变量的使用，并抛出编译错误
    new CheckGlobalPathsPlugin(),
    // 加载yml本地化定义模块
    new LocalePlugin(),
    //
    new StyleLintPlugin({
      configBasedir: cwd,
      context: RENDERER_CONTEXT,
      files: ['**/*.{css,scss}'],
    }),
    new webpack.EnvironmentPlugin({
      IS_ELECTRON: target !== 'web',
    }),
  ].filter(Boolean),
}

//
module.exports = {
  configure: customizeWebpackConfig,
}
