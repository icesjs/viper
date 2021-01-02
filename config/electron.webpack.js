const path = require('path')
const NodeAddonsWebpackPlugin = require('../scripts/lib/native.plugin')
const BundleAnalyzerPlugin = require('../scripts/lib/analyzer.plugin')
const { resolvePackage: resolve } = require('../scripts/lib/resolve')
const { updateJsonFile } = require('../scripts/lib/utils')

//
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const webpack = resolve('webpack')
const TerserPlugin = resolve('terser-webpack-plugin')
const CaseSensitivePathsPlugin = resolve('case-sensitive-paths-webpack-plugin')

const {
  MAIN_ENTRY,
  MAIN_BUILD_PATH,
  MAIN_BUILD_FILE_NAME,
  MAIN_CONTEXT,
  MAIN_CONTEXT_ALIAS,
} = require('./consts')
const context = process.cwd()

const {
  NODE_ENV,
  AUTO_OPEN_DEV_TOOLS,
  APP_INDEX_HTML_URL,
  APP_INDEX_HTML_PATH,
  APP_DEV_LOG_LEVEL,
  APP_PRO_LOG_LEVEL,
  RENDERER_BUILD_TARGET,
  WEBPACK_ELECTRON_ENTRY_PRELOAD,
  GENERATE_FULL_SOURCEMAP = 'false',
  GENERATE_SOURCEMAP = 'false',
  ENABLE_NODE_ADDONS = 'false',
  ENABLE_BUNDLE_ANALYZER = 'false',
} = process.env

const isEnvDevelopment = NODE_ENV === 'development'
const isEnvProduction = NODE_ENV === 'production'
const mode = isEnvDevelopment ? 'development' : 'production'

const shouldUseSourceMap = GENERATE_SOURCEMAP !== 'false'

const MAIN_PRELOAD = path.join(__dirname, 'preload.main.js')

// 同步更新sourceMap开关
updateJsonFile(
  'tsconfig.json',
  {
    compilerOptions: { sourceMap: isEnvDevelopment || shouldUseSourceMap },
  },
  false
)

//
module.exports = {
  mode,
  context,
  target: 'electron-main',
  entry: [WEBPACK_ELECTRON_ENTRY_PRELOAD, MAIN_PRELOAD, MAIN_ENTRY].filter(Boolean),
  output: {
    path: MAIN_BUILD_PATH,
    filename: MAIN_BUILD_FILE_NAME,
    publicPath: '/test/public',
  },
  resolve: {
    extensions: ['.ts', '.js', '.mjs', '.json'],
    alias: {
      [MAIN_CONTEXT_ALIAS]: MAIN_CONTEXT,
    },
  },
  devtool: isEnvDevelopment
    ? GENERATE_FULL_SOURCEMAP !== 'false'
      ? 'source-map'
      : 'eval-source-map'
    : shouldUseSourceMap && 'source-map',
  bail: isEnvProduction,
  module: {
    strictExportPresence: true,
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        include: path.resolve(context, 'src'),
        options: {
          transpileOnly: true,
        },
      },
    ].filter(Boolean),
  },
  optimization: {
    minimize: !(isEnvDevelopment || GENERATE_FULL_SOURCEMAP !== 'false'),
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
    __dirname: false,
    __filename: false,
  },
  plugins: [
    ENABLE_NODE_ADDONS !== 'false' && new NodeAddonsWebpackPlugin(), // 支持node addon的构建与打包
    isEnvDevelopment && new CaseSensitivePathsPlugin(),
    isEnvProduction && new CleanWebpackPlugin(),
    isEnvProduction && ENABLE_BUNDLE_ANALYZER !== 'false' && new BundleAnalyzerPlugin(),
    //
    new webpack.EnvironmentPlugin({
      NODE_ENV: mode,
      IS_ELECTRON: true,
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
    colors: true,
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
