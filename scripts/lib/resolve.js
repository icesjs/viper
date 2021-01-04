const fs = require('fs')
const path = require('path')
const cwd = fs.realpathSync(process.cwd())

let reactScriptsPath

function resolvePackage(pack) {
  if (!reactScriptsPath) {
    reactScriptsPath = resolveReactScriptsPath()
  }
  try {
    const paths = [cwd]
    if (reactScriptsPath) {
      paths.unshift(reactScriptsPath)
    }
    const packPath = require.resolve(pack, { paths })
    return require(packPath)
  } catch (e) {
    console.error(`You must install ${pack} manually`)
    throw e
  }
}

function resolveReactScriptsPath() {
  let ownPath
  try {
    const pkg = require(path.resolve('package.json'))
    const cracoConfigPath = pkg.cracoConfig || 'craco.config.js'
    const cachedModule = require.cache[require.resolve(cracoConfigPath, { paths: [cwd] })]
    const cracoConfig = (cachedModule ? cachedModule.exports : null) || {}
    ownPath = path.join(
      require.resolve(`${cracoConfig['reactScriptsVersion'] || 'react-scripts'}/package.json`, {
        paths: [cwd],
      }),
      '../'
    )
  } catch (e) {
    ownPath = ''
  }
  return (reactScriptsPath = ownPath)
}

//
module.exports = {
  resolvePackage,
  resolveReactScriptsPath,
}
