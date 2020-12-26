const { EventEmitter } = require('events')
const execa = require('execa')

// 子进程运行监视
class Monitor extends EventEmitter {
  constructor({ sleep, maxRestarts, spawnSettings }) {
    super()
    this.spawnSettings = spawnSettings
    this.sleep = sleep
    this.maxRestarts = maxRestarts
    this.childProcess = null
    this.stopped = false
    this.restarts = 0
    this.promise = null
  }

  // 启动监听
  async start() {
    if (this.childProcess) {
      return this.childProcess
    }
    // 初始化进程
    const childProcess = execa(...this.spawnSettings)
    this.childProcess = childProcess
    this.stopped = false
    this.emit('start', childProcess)
    try {
      // 等待进程执行
      const res = await childProcess
      // 执行结束
      this.childProcess = null
      this.stopped = true
      this.restarts = 0
      if (!childProcess.killed) {
        this.emit('exit', res)
      } else {
        res.killed = true
      }
      return res
      //
    } catch (err) {
      let res = err
      // 执行异常
      this.childProcess = null
      if (!childProcess.killed) {
        this.emit('error', res)
        // 计数重启
        if (!this.stopped && ++this.restarts < this.maxRestarts) {
          await this.sleep()
          if (!this.childProcess && !this.stopped) {
            res = await this.start()
          }
        }
      } else {
        res.killed = true
      }
      // j计数重启后的新的结果
      return res
    }
  }

  // 结束监听
  async stop() {
    const { childProcess } = this
    if (childProcess) {
      this.stopped = true
      this.restarts = 0
      childProcess.kill(process.platform === 'win32' ? 'SIGKILL' : 'SIGTERM', {
        forceKillAfterTimeout: 2000,
      })
      this.emit('stop', childProcess)
      return childProcess
    }
    return {}
  }

  // 重启
  async restart() {
    await this.stop()
    const res = this.start()
    this.emit('restart', res)
    return res
  }
}

//
const getDefaultSleepHandler = (sleepTime) => {
  return async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, +sleepTime || 1000)
    })
  }
}

//
const respawn = function (cmd, args, opts) {
  if (args && !Array.isArray(args)) {
    opts = args
    args = []
  }
  const {
    sleep, // 返回启动间隔时间的函数
    maxRestarts, // Infinity表示不限制重新启动次数，0表示不进行重启
    ...spawnOptions
  } = Object.assign({}, opts)
  return new Monitor({
    sleep: typeof sleep === 'function' ? sleep : getDefaultSleepHandler(sleep),
    maxRestarts: Number.isNaN(+maxRestarts) ? 3 : Math.max(0, Math.floor(+maxRestarts)),
    spawnSettings: [
      cmd,
      args,
      Object.assign(
        {
          stdio: 'inherit',
          windowsHide: true,
        },
        spawnOptions
      ),
    ],
  })
}

module.exports = respawn
