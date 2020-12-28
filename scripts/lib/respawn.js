const { EventEmitter } = require('events')
const spawn = require('cross-spawn')

class Runner extends EventEmitter {
  constructor(spawnSettings) {
    super()
    this.spawnSettings = spawnSettings
    this.childProcess = null
    this.stopped = false
  }

  get pid() {
    return this.childProcess ? this.childProcess.pid : 0
  }

  wait() {
    return new Promise((resolve, reject) => {
      this.once('exit', (code) => {
        if (code !== 0) {
          reject(code)
        } else {
          resolve()
        }
      }).start()
    })
  }

  start() {
    if (this.childProcess) {
      return this.childProcess
    }
    const childProcess = spawn(...this.spawnSettings)
    this.childProcess = childProcess
    childProcess.on('exit', (code, signal) => {
      if (!childProcess.killed) {
        this.emit('exit', code, signal)
      }
    })
    childProcess.on('error', (err) => {
      this.emit('err', err)
    })
    this.emit('start', childProcess)
    return childProcess
  }

  stop() {
    const { childProcess } = this
    if (childProcess) {
      this.childProcess = null
      const isWin = process.platform === 'win32'
      const killed = childProcess.kill(isWin ? 'SIGKILL' : 'SIGTERM')
      if (!isWin && !killed) {
        childProcess.kill('SIGKILL')
      }
      this.emit('stop', childProcess)
    }
  }

  restart() {
    this.stop()
    const childProcess = this.start()
    this.emit('restart', childProcess)
  }
}

const respawn = function (cmd, args, opts) {
  if (!Array.isArray(args)) {
    if (args) {
      opts = args
    }
    args = []
  }
  const { env = {}, cwd = process.cwd(), ...spawnOptions } = Object.assign({}, opts)
  if (/\.js$/.test(cmd)) {
    if (process.env.NODE_ENV === 'development') {
      args.unshift('--inspect')
    }
    args.unshift(cmd)
    cmd = 'node'
  }
  return new Runner([cmd, args, { ...spawnOptions, env: { ...process.env, ...env }, cwd }])
}

module.exports = respawn
