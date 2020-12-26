const { EventEmitter } = require('events')
const chokidar = require('chokidar')
const { debounce } = require('throttle-debounce')

class Watcher extends EventEmitter {
  constructor({ debounceDelay, debounceAtBegin, settings }) {
    super()
    this.debounceDelay = debounceDelay
    this.debounceAtBegin = debounceAtBegin
    this.watcher = chokidar.watch(...settings)
    this.closed = false
    this.emit('watch')
  }

  on(event, callback) {
    this.watcher.on(event, debounce(this.debounceDelay, this.debounceAtBegin, callback))
    return this
  }

  close() {
    if (this.closed) {
      return Promise.resolve()
    }
    this.closed = true
    this.emit('close')
    return this.watcher.close()
  }
}

const watch = function (files, opts) {
  const { debounceDelay = 2000, debounceAtBegin = false, ...options } = Object.assign({}, opts)
  return new Watcher({
    debounceDelay,
    debounceAtBegin,
    settings: [
      files,
      Object.assign(options, {
        ignoreInitial: true,
      }),
    ],
  })
}

module.exports = watch
