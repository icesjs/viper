const path = require('path')
const { resolvePackage: resolve, createLogger } = require('../scripts/lib/utils')

//
const webpack = resolve('webpack')
const TerserPlugin = resolve('terser-webpack-plugin')
const CaseSensitivePathsPlugin = resolve('case-sensitive-paths-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')

createLogger('webpack:electron', true)

const {
  MAIN_ENTRY,
  MAIN_BUILD_PATH,
  MAIN_BUILD_FILE_NAME,
  MAIN_CONTEXT,
  MAIN_CONTEXT_ALIAS,
} = require('./consts')

const {
  NODE_ENV,
  GENERATE_SOURCEMAP,
  AUTO_OPEN_DEV_TOOLS,
  APP_INDEX_HTML_URL,
  APP_INDEX_HTML_PATH,
  APP_DEV_LOG_LEVEL,
  APP_PRO_LOG_LEVEL,
  RENDERER_BUILD_TARGET,
  WEBPACK_ELECTRON_ENTRY_PRELOAD,
} = process.env
const isDev = NODE_ENV === 'development'
const isProd = NODE_ENV === 'production'
const mode = isDev ? 'development' : 'production'
const shouldUseSourceMap = GENERATE_SOURCEMAP !== 'false'
const context = process.cwd()

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
  devtool: (isDev || shouldUseSourceMap) && 'source-map',
  bail: isProd,
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
    ],
  },
  optimization: {
    minimize: isProd,
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
    global: false,
    __dirname: false,
    __filename: false,
  },
  plugins: [
    isDev && new CaseSensitivePathsPlugin(),
    isProd && new CleanWebpackPlugin(),
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
    ...(isDev
      ? {
          entrypoints: true,
        }
      : {
          assets: true,
          env: true,
        }),
  },
}
