const fs = require('fs')
const path = require('path')

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
