//
function catchUncaughtException(log) {
  process.on('unhandledRejection', (reason) => log.error(reason))
  process.on('uncaughtException', (err) => {
    log.error(err)
    process.exit(1)
  })
}

//
function getReady() {
  // init logger
  const log = require('./logger').log
  // 捕获全局异常
  catchUncaughtException(log)
  // 清理相关文件与目录
  const path = require('path')
  const fs = require('fs-extra')
  const utils = require('./utils')
  const {
    MAIN_BUILD_PATH,
    MAIN_BUILD_FILE_NAME,
    ADDONS_BUILD_PATH,
  } = require('../../config/consts')
  const index = path.resolve('index.js')
  const main = path.resolve(MAIN_BUILD_PATH, MAIN_BUILD_FILE_NAME)
  const entry = utils.relativePath(process.cwd(), main)
  // 根据配置文件中的定义参数，更新应用的执行入口信息
  fs.writeFileSync(index, `require('${entry}')\n`)
  // 保存至环境变量中，发布时有用到
  process.env.ELECTRON_MAIN_ENTRY_PATH = path.resolve(entry)
  // 清空addons构建输出目录
  utils.emptyDirSync(ADDONS_BUILD_PATH)
}

function loadEnv(NODE_ENV, forced) {
  const dotenv = require('./dotenv')
  const envFromConfig = dotenv.parseEnv(NODE_ENV)
  const envFromProcess = process.env

  Object.assign(envFromConfig, { FORCE_COLOR: 2 }, forced)
  for (const [name, value] of Object.entries(envFromConfig)) {
    const processEnvHasProp = envFromProcess.hasOwnProperty(name)
    const processEnv = envFromProcess[name]
    if (value && value !== 'undefined') {
      // 仅设置环境变量中未声明的值
      if (processEnvHasProp && processEnv && processEnv !== 'undefined') {
        continue
      }
      envFromProcess[name] = value
    } else if (processEnvHasProp && (!processEnv || processEnv === 'undefined')) {
      delete envFromProcess[name]
    }
  }
  Object.assign(envFromProcess, { NODE_ENV })
}

function presetEnv() {
  const { CI } = process.env
  if (CI && CI !== 'false') {
    Object.assign(process.env, {
      NO_COLOR: 'true',
      WRITE_LOGS_TO_FILE: 'false',
    })
  } else {
    delete process.env.CI
  }
  const {
    ENABLE_PRODUCTION_DEBUG = 'false',
    GENERATE_FULL_SOURCEMAP = 'false',
    NO_COLOR = 'false',
    DEBUG = 'false',
  } = process.env

  if (ENABLE_PRODUCTION_DEBUG !== 'false' || GENERATE_FULL_SOURCEMAP !== 'false') {
    process.env.GENERATE_SOURCEMAP = 'true'
  }
  if (NO_COLOR !== 'false') {
    delete process.env.FORCE_COLOR
  } else {
    delete process.env.NO_COLOR
  }
  if (DEBUG === 'false') {
    delete process.env.DEBUG
  }
}

function setEnvironment(NODE_ENV, forced) {
  loadEnv(NODE_ENV, forced)
  presetEnv()
  getReady()
}

module.exports = setEnvironment
