const os = require('os')
const path = require('path')
const crypto = require('crypto')
const execa = require('execa')
const WebSocket = require('ws')
const { outputFileSync, removeSync, realpathSync } = require('fs-extra')
const { getAvailablePort } = require('./utils')
const { log } = require('./logger')

//
let socketServer
let socketServerPort = process.env.DETACHED_WEB_SOCKET_PORT
const localSocketOrigin = 'http://localhost.socket'
//
const HEADERS_SIGNAL_FLAG = 'x-type-signal'
const HEADERS_SIGNAL_TERM = 'SIGTERM'
const HEADERS_SIGNAL_KILL = 'SIGKILL'
const HEADERS_SIGNAL_INT = 'SIGINT'
const HEADERS_SIGNAL_EXIT = 'SIGTERM'
// electron进程需要detached模式运行
const PROCESS_DETACHED =
  process.platform === 'win32' && process.env.NOT_DETACH_ELECTRON_ON_WINDOWS === 'false'

//
function createHelperFileSync() {
  // 生成vbs辅助程序文件，进行cli隐藏
  const tmpdir = realpathSync(os.tmpdir())
  const hash = crypto.createHash('sha1')
  const content = [
    'Dim WinScriptHost',
    'Set WinScriptHost = CreateObject("WScript.Shell")',
    `WinScriptHost.Run Chr(34) & "${path.join(__dirname, 'electron.cmd')}" & Chr(34), 0`,
    'Set WinScriptHost = Nothing',
  ].join(os.EOL)
  hash.update(`${content}#${Date.now()}`)
  const helperProgramFile = path.join(tmpdir, `${hash.digest('hex').substr(0, 18)}.tmp.vbs`)
  outputFileSync(helperProgramFile, content)
  return helperProgramFile
}

//
function clearHelperFileSync(filename) {
  try {
    removeSync(filename)
  } catch (e) {}
}

async function createSocketServer() {
  // 单例
  if (socketServer) {
    return socketServer
  }
  socketServerPort = await getAvailablePort(socketServerPort)
  //
  socketServer = new WebSocket.Server({
    host: 'localhost',
    port: socketServerPort,
    path: '/',
  })

  // 简单校验连接来源
  socketServer.on('connection', (ws, req) => {
    const origin = req.headers['origin']
    if (origin !== localSocketOrigin) {
      ws.terminate()
    }
  })

  setSocketHeartbeatChecker(socketServer)
  return socketServer
}

//
function closeSocketServer(code, data, callback) {
  if (socketServer) {
    let wss = socketServer
    socketServer = null
    for (const ws of wss.clients) {
      if (ws.isAlive) {
        ws.close(/*+code || 0, data*/)
      }
    }
    process.nextTick(() => wss.close(callback))
  }
}

//
function setSocketHeartbeatChecker(socketServer) {
  socketServer.on('connection', (ws) => {
    ws.isAlive = true
    ws.on('pong', () => {
      ws.isAlive = true
    })
  })

  const interval = setInterval(() => {
    for (const ws of socketServer.clients) {
      if (!ws.isAlive) {
        ws.terminate()
      } else {
        ws.isAlive = false
        ws.ping((err) => err && log.error(err))
      }
    }
  }, 2000)

  socketServer.once('close', () => {
    clearInterval(interval)
  })
}

//
async function createSocketConnection(opts = {}) {
  const ws = new WebSocket(`ws://localhost:${socketServerPort}/`, {
    ...opts,
    origin: localSocketOrigin,
  })
  await new Promise((resolve, reject) => {
    ws['once']('open', resolve)
    ws['once']('error', reject)
  })
  return ws
}

//
async function createSocketStream(opts = {}) {
  const ws = new WebSocket(`ws://localhost:${socketServerPort}/`, {
    origin: localSocketOrigin,
  })
  const ss = WebSocket.createWebSocketStream(ws, { encoding: 'utf8', ...opts })
  await new Promise((resolve, reject) => {
    ws['once']('open', resolve)
    ws['once']('error', reject)
  })
  return ss
}

// 通过vbs执行终端程序，来隐藏命令提示符窗口
async function createHelperProcess(helper) {
  await execa(helper, {
    cwd: realpathSync(process.cwd()),
    env: process.env,
    windowsHide: true,
    detached: true,
    stdio: 'ignore',
  })
}

module.exports = {
  PROCESS_DETACHED,
  createHelperProcess,
  createHelperFileSync,
  clearHelperFileSync,
  createSocketServer,
  closeSocketServer,
  createSocketConnection,
  createSocketStream,
  HEADERS_SIGNAL_FLAG,
  HEADERS_SIGNAL_TERM,
  HEADERS_SIGNAL_KILL,
  HEADERS_SIGNAL_INT,
  HEADERS_SIGNAL_EXIT,
}
