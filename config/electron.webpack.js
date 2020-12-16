const path = require('path')
const { resolvePackage: resolve } = require('../scripts/utils')
//
const webpack = resolve('webpack')
const TerserPlugin = resolve('terser-webpack-plugin')
const CaseSensitivePathsPlugin = resolve('case-sensitive-paths-webpack-plugin')

const {
  PROJECT_CONTEXT,
  BUILD_PATH,
  MAIN_ENTRY,
  MAIN_BUILD_FILE_NAME,
  MAIN_CONTEXT,
  MAIN_CONTEXT_ALIAS,
} = require('./consts')

const {
  NODE_ENV,
  GENERATE_SOURCEMAP = 'false',
  AUTO_OPEN_DEV_TOOLS = 'false',
  APP_INDEX_HTML_URL = '',
  APP_DEV_LOG_LEVEL = '',
  APP_PRO_LOG_LEVEL = '',
  WEBPACK_ELECTRON_ENTRY_PRELOAD = '',
} = process.env
const isDev = NODE_ENV === 'development'
const mode = isDev ? 'development' : 'production'

//
module.exports = {
  mode,
  target: 'electron-main',
  context: PROJECT_CONTEXT,
  entry: [WEBPACK_ELECTRON_ENTRY_PRELOAD, MAIN_ENTRY].filter(Boolean),
  output: {
    path: BUILD_PATH,
    filename: MAIN_BUILD_FILE_NAME,
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      [MAIN_CONTEXT_ALIAS]: MAIN_CONTEXT,
    },
  },
  devtool: (isDev || !/^false$/.test(GENERATE_SOURCEMAP)) && 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        include: path.resolve(PROJECT_CONTEXT, 'src'),
        options: {
          transpileOnly: true,
        },
      },
    ],
  },
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          ecma: 2018,
        },
      }),
    ],
  },
  node: {
    __dirname: false,
    __filename: false,
  },
  plugins: [
    isDev && new CaseSensitivePathsPlugin(),
    //
    new webpack.EnvironmentPlugin({
      ELECTRON_RENDERER_INDEX_HTML_URL: APP_INDEX_HTML_URL,
      ELECTRON_AUTO_OPEN_DEV_TOOLS: AUTO_OPEN_DEV_TOOLS,
      ELECTRON_APP_DEV_LOG_LEVEL: APP_DEV_LOG_LEVEL,
      ELECTRON_APP_PRO_LOG_LEVEL: APP_PRO_LOG_LEVEL,
      NODE_ENV: mode,
    }),
  ].filter(Boolean),
  //
  stats: isDev ? 'minimal' : 'normal',
}
