const { EventEmitter } = require('events')
const spawn = require('cross-spawn')

class Runner extends EventEmitter {
  constructor(spawnSettings) {
    super()
    this.spawnSettings = spawnSettings
    this.childProcess = null
    this.processResult = null
  }

  get pid() {
    return this.childProcess ? this.childProcess.pid : 0
  }

  get stopped() {
    return !this.childProcess
  }

  then(resolve, reject) {
    return new Promise((resolve, reject) => {
      const { processResult } = this
      const determine = (res) => (res.code !== 0 ? reject(res) : resolve(res))
      if (!processResult) {
        this.once('exit', () => determine(this.processResult))
        this.start()
      } else {
        determine(processResult)
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
    let childProcess = spawn(...this.spawnSettings)
    const exit = (code, signal) => {
      if (!childProcess) {
        return
      }
      const cp = childProcess
      childProcess = null
      if (cp === this.childProcess) {
        this.childProcess = null
        this.processResult = { code, signal }
      }
      if (!cp.killed) {
        // 发布进程任务运行结束
        this.emit('exit', code, signal)
      } else {
        // 通过restart重启情况
        this.emit('killed', cp)
      }
    }
    //
    this.childProcess = childProcess
      .on('error', (err) => this.emit('err', err))
      .once('close', exit)
      .once('exit', exit)
    //
    this.emit('start', childProcess)
    return this
  }

  restart() {
    this.stop().start().emit('restart', this.childProcess)
    return this
  }

  stop() {
    const { childProcess } = this
    this.processResult = null
    if (childProcess) {
      this.childProcess = null
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
