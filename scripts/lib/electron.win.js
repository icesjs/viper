const { log } = require('./logger')
const { registerShutdown } = require('./utils')
const {
  createHelperFileSync,
  clearHelperFileSync,
  createHelperProcess,
  createSocketServer,
  closeSocketServer,
  HEADERS_SIGNAL_FLAG,
  HEADERS_SIGNAL_TERM,
  HEADERS_SIGNAL_KILL,
  HEADERS_SIGNAL_INT,
  HEADERS_SIGNAL_EXIT,
} = require('./electron.helper')

log.info('Opening the Electron.app with detached mode')

const helper = createHelperFileSync()
createHelperProcess(helper)
  // 建立与detached进程的socket通信
  .then(initCommunication)
  .catch(log.error)

//
async function initCommunication() {
  // 建立socks通道，进行终端输出同步
  const wss = await createSocketServer()

  clearHelperFileSync(helper)
  handleHeadersSignal(wss)
  handleMessage(wss)

  // 进程关闭时，关闭服务器
  registerShutdown((code) => {
    const signal = Number.isNaN(+code) ? code : ''
    if (signal) {
      code = 1
    }
    closeSocketServer(code, `${signal}`)
  })
}

//
function handleMessage(wss) {
  wss.on('connection', (ws, req) => {
    if (isSignalRequest(req)) {
      return
    }
    ws.on('message', (data) => {
      log.console.log(data)
    })
  })
}

// 被detached的进程可以通过此请求头信号，来关闭当前进程
function handleHeadersSignal(wss) {
  wss.on('connection', (ws, req) => {
    if (isSignalRequest(req)) {
      const SIGNAL = req.headers[HEADERS_SIGNAL_FLAG]
      wss.once('close', () => {
        if (SIGNAL === HEADERS_SIGNAL_EXIT) {
          process.exit(0)
        } else {
          process.exit(1)
        }
      })
      // 关闭服务器
      process.nextTick(() => wss.close())
    }
  })
}

//
function isSignalRequest(req) {
  const SIGNAL = req.headers[HEADERS_SIGNAL_FLAG]
  // 处理进程信号
  const headersSignals = [
    HEADERS_SIGNAL_TERM,
    HEADERS_SIGNAL_KILL,
    HEADERS_SIGNAL_INT,
    HEADERS_SIGNAL_EXIT,
  ]
  return headersSignals.includes(SIGNAL)
}
