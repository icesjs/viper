// 用于辅助导入node插件

const path = require('path')

// 在插件列表里查询指定名称的插件
function getAddonsByBindingName(name = 'bindings.node', addonsList) {
  for (const addons of addonsList) {
    const addonName = addons.name
    if (name === addonName || `${name}.node` === addonName) {
      return addons
    }
  }
}

// 导出插件对象或路径
function getAddonsModuleExports(addons, onlyPath) {
  const { modulePath, isFromNodeModules, isMainProcess, flags } = addons
  const usedFlags = typeof flags !== 'undefined'
  // eslint-disable-next-line no-undef
  const requireFn = typeof __webpack_require__ === 'function' ? __non_webpack_require__ : require
  const module = { exports: {} }

  if (isMainProcess) {
    const requirePath = isFromNodeModules ? modulePath : path.join(__dirname, modulePath)
    if (onlyPath) {
      module.exports = requirePath
    } else {
      if (usedFlags) {
        process.dlopen(module, requirePath, flags)
      } else {
        module.exports = requireFn(requirePath)
      }
    }
  } else {
    const { remote } = requireFn('electron')
    if (!remote) {
      throw new Error(`Can not get remote module from electron. (enableRemoteModule).`)
    }
    const appPath = remote.app.getAppPath()
    const requirePath = isFromNodeModules ? modulePath : path.join(appPath, modulePath)
    if (onlyPath) {
      module.exports = requirePath
    } else {
      if (usedFlags) {
        remote.process.dlopen(module, requirePath, flags)
      } else {
        module.exports = remote.require(requirePath)
      }
    }
  }

  return module.exports
}

// 替换bindings模块的插件导入运行时
// 已转换打包路径
function fakedBindingsRuntime(bindingsOptions, addonsList, loaderName) {
  if (typeof bindingsOptions === 'string') {
    bindingsOptions = { bindings: bindingsOptions }
  }
  const { bindings, path: onlyPath } = Object.assign({}, bindingsOptions)
  const addons = getAddonsByBindingName(bindings, addonsList)
  if (!addons) {
    throw new Error(`${loaderName}: Could not load the addons file.`)
  }
  try {
    // 获取插件导出对象或路径
    return getAddonsModuleExports(addons, onlyPath)
  } catch (e) {
    throw new Error(`${loaderName}: ${e.message}`)
  }
}

//
module.exports = fakedBindingsRuntime
