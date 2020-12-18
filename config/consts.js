const path = require('path')
const fs = require('fs')
const cwd = fs.realpathSync(process.cwd())
const resolve = (...args) => path.resolve(cwd, ...args)

// 定义构建相关的路径参数等
module.exports = {
  // renderer
  RENDERER_CONTEXT_ALIAS: '@',
  RENDERER_CONTEXT: resolve('src/renderer/'),
  RENDERER_ENTRY: resolve('src/renderer/index.tsx'),
  RENDERER_BUILD_PATH: resolve('build/renderer/'),
  // main
  MAIN_CONTEXT_ALIAS: '#',
  MAIN_CONTEXT: resolve('src/main/'),
  MAIN_ENTRY: resolve('src/main/index.ts'),
  MAIN_BUILD_PATH: resolve('build/main/'),
  MAIN_BUILD_FILE_NAME: 'index.js',
  // misc
  PROJECT_CONTEXT: cwd,
  CSS_MODULE_LOCAL_IDENT_NAME: '[local]___[hash:base64:5]',
}
