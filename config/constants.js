const path = require('path')
const fs = require('fs')
const cwd = fs.realpathSync(process.cwd())
const resolve = (...args) => path.resolve(cwd, ...args)

// 定义构建相关的路径参数等
module.exports = {
  // 应用构建输出路径，该目录会作为app打包发布
  APP_BUILD_PATH: resolve('build/'),
  // 相关资源的输出路径，需要在打包目录下
  MAIN_BUILD_PATH: resolve('build/main/'),
  RENDERER_BUILD_PATH: resolve('build/renderer/'),
  ADDONS_BUILD_PATH: resolve('build/addons/'),
  // renderer
  RENDERER_CONTEXT_ALIAS: '@',
  RENDERER_CONTEXT: resolve('src/renderer/'),
  RENDERER_ENTRY: resolve('src/renderer/index.tsx'),
  // main
  MAIN_CONTEXT_ALIAS: '#',
  MAIN_CONTEXT: resolve('src/main/'),
  MAIN_ENTRY: resolve('src/main/index.ts'),
  MAIN_BUILD_FILE_NAME: 'index.js',
  // misc
  CSS_MODULE_LOCAL_IDENT_NAME: '[local]___[hash:base64:5]',
}
