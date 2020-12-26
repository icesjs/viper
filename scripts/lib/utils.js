const fs = require('fs')
const path = require('path')
const findUp = require('find-up')
const portfinder = require('portfinder')
const { log } = require('./logger')

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
  async getAvailablePort(defaultPort) {
    defaultPort = +defaultPort || 5000
    return portfinder.getPortPromise({
      port: defaultPort,
      stopPort: defaultPort + 1000,
    })
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

  //
  printProcessErrorAndExit(error = {}) {
    let hasError
    for (const err of Array.isArray(error) ? error : [error]) {
      const { exitCode, code, message } = err
      if (err instanceof Error && (code || message)) {
        hasError = true
        log.error(`${code ? `\n${code}` : ''}${message ? `\n${message}` : ''}`)
      } else if (!Number.isNaN(exitCode)) {
        process.exit(exitCode)
      }
    }
    if (hasError) {
      process.exit(1)
    }
  },
}
