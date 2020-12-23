const fs = require('fs')
const path = require('path')
const findUp = require('find-up')

module.exports = exports = {
  PROJECT_CONTEXT: fs.realpathSync(process.cwd()),

  //
  relativePath(from, to, addDotPrefix = true) {
    let relativePath = path.relative(from, to).replace(/\\/g, '/')
    if (addDotPrefix && !/^..?\//.test(relativePath)) {
      relativePath = `./${relativePath}`
    }
    return relativePath
  },

  //
  getInstalledCommandPath(module, cliName = module, cwd = process.cwd()) {
    const moduleMain = require.resolve(module, { paths: [cwd] })
    if (moduleMain) {
      const pkg = findUp.sync('package.json', { cwd: path.dirname(moduleMain) })
      if (pkg) {
        const modulePath = path.dirname(pkg)
        let { bin } = require(pkg)
        if (typeof bin === 'object') {
          bin = bin[cliName]
        }
        if (bin) {
          return path.join(modulePath, bin)
        }
      }
    }
  },

  //
  isProtectedDirectory(pathLike) {
    const absPath = path.resolve(pathLike)
    const protectedDir = [
      'config',
      'assets',
      'node_modules',
      'public',
      'resources',
      'scripts',
      'src',
      'test',
      'tests',
      '__tests__',
    ]
    for (const dir of protectedDir) {
      if (path.resolve(dir) === absPath) {
        return true
      }
    }
  },

  //
  registerShutdown(fn) {
    let run = false
    const wrapper = (...args) => {
      if (!run) {
        run = true
        fn(...args)
      }
    }
    process['on']('SIGINT', wrapper)
    process['on']('SIGTERM', wrapper)
    process['on']('exit', wrapper)
  },

  processExitError(error = {}) {
    for (const { exitCode } of Array.isArray(error) ? error : [error]) {
      if (!Number.isNaN(exitCode)) {
        process.exit(exitCode)
      }
    }
  },
}
