const fs = require('fs')
const path = require('path')

module.exports = exports = {
  PROJECT_CONTEXT: fs.realpathSync(process.cwd()),

  //
  relativePath(from, to) {
    let relativePath = path.relative(from, to).replace(/\\/g, '/')
    if (!/^..?\//.test(relativePath)) {
      relativePath = `./${relativePath}`
    }
    return relativePath
  },

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
