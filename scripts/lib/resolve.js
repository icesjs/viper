const fs = require('fs')
const path = require('path')
const findUp = require('find-up')
const cwd = fs.realpathSync(process.cwd())

let reactScripts

/**
 * 根据模块名解析并加载一个模块，优先从react-scripts模块依赖下解析。
 * 主要用于解析webpack等由react-scripts引入的模块
 * @param name 模块名
 * @returns {*}
 */
function resolveModule(name) {
  if (!reactScripts) {
    reactScripts = resolveReactScripts()
  }
  try {
    const paths = [cwd]
    if (reactScripts) {
      paths.unshift(reactScripts)
    }
    const packPath = require.resolve(name, { paths })
    return require(packPath)
  } catch (e) {
    console.error(`You must install ${name} manually`)
    throw e
  }
}

/**
 * 从指定目录路径开始，向上递归解析模块描述文件（package.json），直到指定的根目录为止。
 * @param context 解析起点
 * @param root 结束解析的根目录，一般为当前工程根目录
 * @param async 是否使用异步模式，异步模式返回Promise
 * @returns {Promise<string | undefined> | *}
 */
function resolvePackage(context, root = cwd, async = false) {
  root = path.normalize(root)
  return (async ? findUp : findUp.sync)(
    (dir) => (root === path.normalize(dir) ? findUp.stop : 'package.json'),
    {
      cwd: context,
    }
  )
}

/**
 * 解析react-scripts模块的路径（可能由配置指定）
 * @returns {string|*}
 */
function resolveReactScripts() {
  if (reactScripts) {
    return reactScripts
  }
  let modulePath
  try {
    const pkg = require(path.resolve('package.json'))
    const cracoConfigPaths = [pkg.cracoConfig, 'craco.config.js', '.cracorc.js', '.cracorc']
    const cracoConfigPath = cracoConfigPaths.find(
      (config) => config && fs.existsSync(path.resolve(config))
    )
    let reactScriptsName
    if (cracoConfigPath) {
      const resolvePath = path.resolve(cracoConfigPath)
      const cachedModule = require.cache[require.resolve(resolvePath)]
      if (cachedModule) {
        reactScriptsName = cachedModule.exports.reactScriptsVersion
      }
    }
    if (!reactScriptsName) {
      reactScriptsName = 'react-scripts'
    }
    const reactScriptsPackage = require.resolve(`${reactScriptsName}/package.json`, {
      paths: [cwd],
    })
    modulePath = path.join(reactScriptsPackage, '..')
  } catch (e) {
    modulePath = ''
  }
  return (reactScripts = modulePath)
}

//
module.exports = {
  resolveModule,
  resolvePackage,
  resolveReactScripts,
}
