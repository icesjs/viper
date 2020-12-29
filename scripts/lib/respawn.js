const { EventEmitter } = require('events')
const spawn = require('cross-spawn')

class Runner extends EventEmitter {
  constructor(spawnSettings) {
    super()
    this.spawnSettings = spawnSettings
    this.childProcess = null
    this.processResult = null
    this.on('exit', (code, signal) => {
      this.processResult = { code, signal }
    })
  }

  get pid() {
    return this.childProcess ? this.childProcess.pid : 0
  }

  get stopped() {
    return !!this.childProcess
  }

  then(resolve, reject) {
    return new Promise((resolve, reject) => {
      const determine = (res) => {
        if (res.code !== 0) {
          reject(res)
        } else {
          resolve(res)
        }
      }
      if (!this.processResult) {
        this.once('exit', (code, signal) => determine({ code, signal }))
        this.start()
      } else {
        determine(this.processResult)
      }
    }).then(resolve, reject)
  }

  catch(reject) {
    return this.then((res) => res, reject)
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

  restart() {
    this.stop()
    const childProcess = this.start()
    this.emit('restart', childProcess)
    return childProcess
  }

  stop() {
    const { childProcess } = this
    if (childProcess) {
      this.childProcess = null
      this.processResult = null
      const isWin = process.platform === 'win32'
      const killed = childProcess.kill(isWin ? 'SIGKILL' : 'SIGTERM')
      if (!isWin && !killed) {
        childProcess.kill('SIGKILL')
      }
      this.emit('stop', childProcess)
    }
    return this
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
