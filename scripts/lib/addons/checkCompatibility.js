// 检查插件模块是否与已安装的electron兼容
function checkAddonsCompatibility() {
  const module = process.env.NATIVE_LOADER_ADDONS_COMPATIBLE_CHECK_PATH
  if (module) {
    try {
      require(module)
      process.exit(0)
    } catch (e) {
      process.exit(1)
    }
  } else {
    process.exit(2)
  }
}

// 执行检查
checkAddonsCompatibility()
