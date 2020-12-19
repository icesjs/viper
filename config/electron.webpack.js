const path = require('path')
const { createLogger } = require('../scripts/lib/utils')
const resolve = require('../scripts/lib/resolve')

//
const webpack = resolve('webpack')
const TerserPlugin = resolve('terser-webpack-plugin')
const CaseSensitivePathsPlugin = resolve('case-sensitive-paths-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')

createLogger('builder-scripts:electron', true)

const {
  MAIN_ENTRY,
  MAIN_BUILD_PATH,
  MAIN_BUILD_FILE_NAME,
  MAIN_CONTEXT,
  MAIN_CONTEXT_ALIAS,
  PROJECT_CONTEXT: context,
} = require('./consts')

const {
  DEBUG,
  NODE_ENV,
  AUTO_OPEN_DEV_TOOLS,
  APP_INDEX_HTML_URL,
  APP_INDEX_HTML_PATH,
  APP_DEV_LOG_LEVEL,
  APP_PRO_LOG_LEVEL,
  RENDERER_BUILD_TARGET,
  WEBPACK_ELECTRON_ENTRY_PRELOAD,
} = process.env

const isEnvDevelopment = NODE_ENV === 'development'
const isEnvProduction = NODE_ENV === 'production'
const mode = isEnvDevelopment ? 'development' : 'production'
const shouldUseSourceMap = DEBUG && DEBUG !== 'false'

//
module.exports = {
  mode,
  context,
  target: 'electron-main',
  entry: [WEBPACK_ELECTRON_ENTRY_PRELOAD, MAIN_ENTRY].filter(Boolean),
  output: {
    path: MAIN_BUILD_PATH,
    filename: MAIN_BUILD_FILE_NAME,
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
    alias: {
      [MAIN_CONTEXT_ALIAS]: MAIN_CONTEXT,
    },
  },
  devtool:
    (isEnvDevelopment || shouldUseSourceMap) &&
    (isEnvDevelopment ? 'eval-source-map' : 'source-map'),
  bail: isEnvProduction,
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        include: path.resolve(context, 'src'),
        options: {
          transpileOnly: true,
        },
      },
      isEnvDevelopment && {
        test: /\.node$/,
        loader: 'node-loader',
        options: {
          name: '[path][name].[ext]',
        },
      },
    ].filter(Boolean),
  },
  optimization: {
    minimize: !isEnvDevelopment,
    minimizer: [
      new TerserPlugin({
        sourceMap: shouldUseSourceMap,
        terserOptions: {
          ecma: 2018,
        },
      }),
    ],
  },
  node: {
    global: false, // 禁止直接使用global对象来修改全局作用域数据
    __dirname: false,
    __filename: false,
  },
  plugins: [
    isEnvDevelopment && new CaseSensitivePathsPlugin(),
    isEnvProduction && new CleanWebpackPlugin(),
    //
    new webpack.EnvironmentPlugin({
      NODE_ENV: mode,
      ELECTRON_APP_DEV_LOG_LEVEL: APP_DEV_LOG_LEVEL,
      ELECTRON_APP_PRO_LOG_LEVEL: APP_PRO_LOG_LEVEL,
      ELECTRON_AUTO_OPEN_DEV_TOOLS: AUTO_OPEN_DEV_TOOLS !== 'false',
      ELECTRON_RENDERER_NODE_INTEGRATION: RENDERER_BUILD_TARGET === 'electron-renderer',
      ...(APP_INDEX_HTML_URL ? { ELECTRON_RENDERER_INDEX_HTML_URL: APP_INDEX_HTML_URL } : {}),
      ...(APP_INDEX_HTML_PATH ? { ELECTRON_RENDERER_INDEX_HTML_PATH: APP_INDEX_HTML_PATH } : {}),
    }),
  ].filter(Boolean),
  //
  stats: {
    all: false,
    warnings: true,
    errors: true,
    errorDetails: true,
    context: MAIN_CONTEXT,
    ...(isEnvDevelopment
      ? {
          entrypoints: true,
        }
      : {
          assets: true,
          env: true,
        }),
  },
}
