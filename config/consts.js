const path = require('path')
const cwd = process.cwd()
const resolve = (...args) => path.resolve(cwd, ...args)

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
  MAIN_BUILD_FILE_NAME: 'app.js',
  // misc
  CSS_MODULE_LOCAL_IDENT_NAME: '[local]___[hash:base64:5]',
}
