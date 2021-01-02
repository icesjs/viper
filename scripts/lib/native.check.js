// 检查插件模块是否与已安装的electron兼容
function checkAddonsCompatible() {
  const module = process.env.NATIVE_LOADER_ADDONS_COMPATIBLE_CHECK_PATH
  if (module) {
    try {
      require(module)
      process.exit(0)
    } catch (e) {
      process.exit(1)
    }
  } else {
    require('./logger').log.error(
      'Not found NATIVE_LOADER_ADDONS_COMPATIBLE_CHECK_PATH from process env to test'
    )
    setTimeout(() => process.exit(2), 1000)
  }
}

// 执行检查
checkAddonsCompatible()
