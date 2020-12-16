const { resolveProjectPath } = require('../scripts/utils')

module.exports = {
  MAIN_CONTEXT_ALIAS: '#',
  RENDERER_CONTEXT_ALIAS: '@',
  BUILD_PATH: resolveProjectPath('build/'),
  MAIN_ENTRY: resolveProjectPath('src/electron.ts'),
  MAIN_BUILD_FILE_NAME: 'electron.js',
  //
  PROJECT_CONTEXT: resolveProjectPath('.'),
  MAIN_CONTEXT: resolveProjectPath('src/main/'),
  RENDERER_CONTEXT: resolveProjectPath('src/renderer/'),
  RENDERER_TARGET: 'electron-renderer',
  //
  CSS_MODULE_LOCAL_IDENT_NAME: '[local]___[hash:base64:5]',
}
