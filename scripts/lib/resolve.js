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
      paths.push(reactScriptsPath)
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
    const cachedModule = require.cache[require.resolve('./craco.config.js', { paths: [cwd] })]
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
